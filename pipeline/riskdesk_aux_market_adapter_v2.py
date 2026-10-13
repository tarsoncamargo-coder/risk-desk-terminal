"""Risk Desk V10 - auxiliary market adapter V2.
Yahoo best-effort intraday context for DXY, VIX and VXN.

Governance:
- no official-source claim
- no trading signal
- stale data is never promoted to live
- DXY/VIX/VXN failures do not fabricate substitutes
"""
from __future__ import annotations

import json
import math
import os
import time
from datetime import datetime, timezone, time as dtime
from urllib.parse import quote
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from supabase import create_client

VERSION = "V10.0.0J7B_FREE_FIX3"
POLL_SECONDS = 60
FRESH_MINUTES = {"DXY": 20, "VIX": 20, "VXN": 20}
MAX_TRANSPORT_LAG_MINUTES = {"DXY": 3, "VIX": 3, "VXN": 3}
SYMBOLS = {
    "DXY": {"symbol": "DX-Y.NYB", "source": "YAHOO_DXY", "component": "DXY_ADAPTER"},
    "VIX": {"symbol": "^VIX", "source": "YAHOO_VIX", "component": "VIX_ADAPTER"},
    "VXN": {"symbol": "^VXN", "source": "YAHOO_VXN", "component": "VXN_ADAPTER"},
}
SUPABASE_URL = os.environ.get("RISKDESK_SUPABASE_URL", "").strip()
SUPABASE_SECRET_KEY = os.environ.get("RISKDESK_SUPABASE_SECRET_KEY", "").strip()
NY = ZoneInfo("America/New_York")


def utcnow():
    return datetime.now(timezone.utc)


def iso(dt):
    return dt.astimezone(timezone.utc).isoformat()


def is_expected_session(asset, now_utc):
    """Conservative freshness expectation, not an exchange-calendar claim."""
    ny = now_utc.astimezone(NY)
    wd = ny.weekday()
    tm = ny.time()

    if asset in {"VIX", "VXN"}:
        return wd < 5 and dtime(9, 30) <= tm <= dtime(16, 15)

    # DXY/ICE-style near-24h expectation, with weekend and daily maintenance guard.
    if wd == 5:
        return False
    if wd == 6:
        return tm >= dtime(18, 0)
    if wd == 4:
        return tm < dtime(17, 0)
    return not (dtime(17, 0) <= tm < dtime(18, 0))


def yahoo_urls(symbol):
    encoded = quote(symbol, safe="")
    bases = [
        "https://query1.finance.yahoo.com/v8/finance/chart/",
        "https://query2.finance.yahoo.com/v8/finance/chart/",
    ]
    queries = [
        "?interval=1m&range=5d&includePrePost=true&events=div%2Csplits",
        "?interval=5m&range=5d&includePrePost=true&events=div%2Csplits",
    ]
    return [base + encoded + q for base in bases for q in queries]


def fetch_latest_yahoo(symbol):
    errors = []
    for url in yahoo_urls(symbol):
        try:
            req = Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 RiskDesk/10",
                    "Accept": "application/json,text/plain,*/*",
                    "Cache-Control": "no-cache",
                },
            )
            with urlopen(req, timeout=12) as resp:
                payload = json.loads(resp.read().decode("utf-8"))

            chart = payload.get("chart") or {}
            result = chart.get("result") or []
            if not result:
                errors.append(str((chart.get("error") or {}).get("description") or "empty_result"))
                continue

            item = result[0]
            timestamps = item.get("timestamp") or []
            quotes = ((item.get("indicators") or {}).get("quote") or [{}])[0]
            closes = quotes.get("close") or []

            valid = []
            for ts, close in zip(timestamps, closes):
                try:
                    px = float(close)
                except Exception:
                    continue
                if not math.isfinite(px) or px <= 0:
                    continue
                valid.append((datetime.fromtimestamp(int(ts), tz=timezone.utc), px))

            if valid:
                valid.sort(key=lambda x: x[0])
                return valid[-1], None

            errors.append("no_valid_close")
        except Exception as exc:
            errors.append(f"{type(exc).__name__}:{str(exc)[:160]}")

    return None, " | ".join(errors[-4:])


def classify_quote_state(expected_session, age_minutes, freshness_limit_minutes, transport_lag_minutes, max_transport_lag_minutes):
    if not expected_session:
        return "STALE", "OUTSIDE_EXPECTED_SESSION", "OFF_SESSION_SOURCE"
    if transport_lag_minutes is not None and transport_lag_minutes > max_transport_lag_minutes:
        return "STALE", "DELAYED_SOURCE", "DELAYED_SOURCE"
    if age_minutes is not None and age_minutes <= freshness_limit_minutes:
        return "OK", "FRESH", "OK"
    return "ERROR", "STALE_DURING_EXPECTED_SESSION", "STALE_SOURCE"


def latest_persisted(client, asset):
    res = (
        client.table("live_market_minute")
        .select("ts_utc,price,source,quality_status")
        .eq("asset", asset)
        .order("ts_utc", desc=True)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    row = res.data[0]
    ts = datetime.fromisoformat(str(row["ts_utc"]).replace("Z", "+00:00")).astimezone(timezone.utc)
    return ts, float(row["price"]), row.get("source"), row.get("quality_status")


def heartbeat(client, component, status, details):
    client.table("live_pipeline_heartbeat").upsert(
        {
            "component": component,
            "last_seen_utc": iso(utcnow()),
            "status": status,
            "details": details,
            "source_version": VERSION,
        },
        on_conflict="component",
    ).execute()


def persist_quote(client, asset, cfg, ts, price, quality_status):
    body = {
        "ts_utc": iso(ts),
        "asset": asset,
        "symbol": cfg["symbol"],
        "price": price,
        "source": cfg["source"],
        "contract": None,
        "volume": None,
        "quality_status": quality_status,
        "received_at": iso(utcnow()),
    }
    client.table("live_market_minute").upsert(
        body, on_conflict="ts_utc,asset,source"
    ).execute()


def run_asset(client, asset, cfg):
    now = utcnow()
    expected = is_expected_session(asset, now)
    fetched, fetch_error = fetch_latest_yahoo(cfg["symbol"])

    latest_ts = None
    latest_px = None
    source_mode = "FETCH"

    transport_lag_min = None
    if fetched is not None:
        latest_ts, latest_px = fetched
        age_min = max(0.0, (now - latest_ts).total_seconds() / 60.0)
        transport_lag_min = age_min
        status, state, quality = classify_quote_state(
            expected,
            age_min,
            FRESH_MINUTES[asset],
            transport_lag_min,
            MAX_TRANSPORT_LAG_MINUTES[asset],
        )
        persist_quote(client, asset, cfg, latest_ts, latest_px, quality)
    else:
        persisted = latest_persisted(client, asset)
        source_mode = "PERSISTED_FALLBACK"
        if persisted:
            latest_ts, latest_px, _, persisted_quality = persisted
        else:
            persisted_quality = None
        age_min = None if latest_ts is None else max(0.0, (now - latest_ts).total_seconds() / 60.0)
        if latest_ts is None:
            status = "ERROR" if expected else "STALE"
            state = "NO_VALID_QUOTE_DURING_EXPECTED_SESSION" if expected else "OUTSIDE_EXPECTED_SESSION"
            quality = "NO_DATA"
        elif persisted_quality == "DELAYED_SOURCE":
            status, state, quality = "STALE", "DELAYED_SOURCE", "DELAYED_SOURCE"
        elif not expected:
            status, state, quality = "STALE", "OUTSIDE_EXPECTED_SESSION", "OFF_SESSION_SOURCE"
        elif age_min is not None and age_min <= FRESH_MINUTES[asset]:
            status, state, quality = "OK", "FRESH_PERSISTED", persisted_quality or "OK"
        else:
            status, state, quality = "ERROR", "STALE_DURING_EXPECTED_SESSION", persisted_quality or "STALE_SOURCE"

    details = {
        "asset": asset,
        "symbol": cfg["symbol"],
        "source": cfg["source"],
        "source_mode": source_mode,
        "state": state,
        "expected_session": expected,
        "latest_ts_utc": iso(latest_ts) if latest_ts else None,
        "latest_price": latest_px,
        "age_minutes": round(age_min, 2) if age_min is not None else None,
        "transport_lag_minutes": round(transport_lag_min, 2) if transport_lag_min is not None else None,
        "max_transport_lag_minutes": MAX_TRANSPORT_LAG_MINUTES[asset],
        "freshness_limit_minutes": FRESH_MINUTES[asset],
        "quality_status": quality,
        "fetch_error": fetch_error,
        "official_source": False,
        "context_only": True,
        "operational_authorized": False,
    }
    heartbeat(client, cfg["component"], status, details)
    return status, details


def main():
    if not SUPABASE_URL:
        raise SystemExit("[ERRO] RISKDESK_SUPABASE_URL nao definida.")
    if not SUPABASE_SECRET_KEY:
        raise SystemExit("[ERRO] RISKDESK_SUPABASE_SECRET_KEY nao definida.")

    client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
    print("Risk Desk AUX V2 iniciado: DXY + VIX + VXN. Ctrl+C para encerrar.")

    last_print = None
    while True:
        try:
            summary = {}
            for asset, cfg in SYMBOLS.items():
                status, details = run_asset(client, asset, cfg)
                summary[asset] = {
                    "status": status,
                    "age_min": details["age_minutes"],
                    "state": details["state"],
                }

            heartbeat(
                client,
                "AUX_MARKET_ADAPTER",
                "ERROR" if any(v["status"] == "ERROR" for v in summary.values())
                else "STALE" if any(v["status"] == "STALE" for v in summary.values())
                else "OK",
                {
                    "assets": summary,
                    "context_only": True,
                    "operational_authorized": False,
                },
            )

            printable = json.dumps(summary, ensure_ascii=False, sort_keys=True)
            if printable != last_print:
                print(datetime.now().strftime("%H:%M:%S"), printable)
                last_print = printable

        except KeyboardInterrupt:
            try:
                heartbeat(client, "AUX_MARKET_ADAPTER", "STOPPED", {"message": "Encerrado pelo usuario."})
            except Exception:
                pass
            return
        except Exception as exc:
            print("[ERRO]", type(exc).__name__, str(exc))
            try:
                heartbeat(
                    client,
                    "AUX_MARKET_ADAPTER",
                    "ERROR",
                    {"error": type(exc).__name__, "message": str(exc)[:500]},
                )
            except Exception:
                pass

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
