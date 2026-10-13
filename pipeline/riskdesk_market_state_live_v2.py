"""Risk Desk V10 - Market State live engine V2.

Builds auditable pre-event/live cross-asset windows from live_market_minute.
No weighted macro score, no probability of profit and no trade authorization.

Orientation convention (risk-on positive):
- NQ futures price up -> positive
- ZQ futures price up -> positive (lower implied policy rate)
- ZT/ZN futures price up -> positive (lower yield proxy)
- DXY up -> negative
- VXN/VIX up -> negative

Composite label is deliberately strict:
- minimum 3 fresh oriented factors and NQ required
- all non-zero orientations >= 0 -> RISK_ON
- all non-zero orientations <= 0 -> RISK_OFF
- both signs -> MIXED
- all zero -> NEUTRAL
This is a descriptive state machine, not a score.
"""
from __future__ import annotations

import json
import math
import os
import time
from datetime import datetime, timedelta, timezone

from supabase import create_client

VERSION = "V10.0.0J7D-FIX2"
POLL_SECONDS = 60
WINDOWS = [
    ("PRE1440", 1440),
    ("PRE240", 240),
    ("PRE60", 60),
    ("PRE30", 30),
    ("PRE15", 15),
    ("PRE5", 5),
]
ASSETS = ("NQ", "ZQ", "ZT", "ZN", "DXY", "VIX", "VXN")
ENDPOINT_MAX_GAP_MINUTES = {
    "NQ": 6,
    "ZQ": 8,
    "ZT": 6,
    "ZN": 6,
    "DXY": 20,
    "VIX": 20,
    "VXN": 20,
}
BASELINE_TOLERANCE_MINUTES = {
    "NQ": 10,
    "ZQ": 15,
    "ZT": 10,
    "ZN": 10,
    "DXY": 20,
    "VIX": 20,
    "VXN": 20,
}
SUPABASE_URL = os.environ.get("RISKDESK_SUPABASE_URL", "").strip()
SUPABASE_SECRET_KEY = os.environ.get("RISKDESK_SUPABASE_SECRET_KEY", "").strip()

BASELINE_CACHE = {}
FROZEN_ENDPOINT_CACHE = {}


def utcnow():
    return datetime.now(timezone.utc)


def parse_dt(value):
    if isinstance(value, datetime):
        dt = value
    else:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def iso(dt):
    return dt.astimezone(timezone.utc).isoformat()


def minute_floor(dt):
    return dt.replace(second=0, microsecond=0)


def safe_pct(start_price, end_price):
    try:
        a = float(start_price)
        b = float(end_price)
        if not math.isfinite(a) or not math.isfinite(b) or a <= 0:
            return None
        return 100.0 * (b / a - 1.0)
    except Exception:
        return None


def target_event(client):
    cur = client.table("riskdesk_product_current_event_v1").select("*").limit(1).execute().data or []
    if cur:
        return cur[0], "CURRENT"
    nxt = client.table("riskdesk_product_next_event_v1").select("*").limit(1).execute().data or []
    if nxt:
        return nxt[0], "NEXT"
    return None, None


def regime_context(client):
    rows = (
        client.table("riskdesk_product_playbook_v1")
        .select("playbook_code,playbook_status")
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        return None, None
    return rows[0].get("playbook_code"), rows[0].get("playbook_status")


def sigma_context(client, now):
    rows = (
        client.table("live_sigma_state")
        .select("as_of_utc,status,z_current")
        .order("as_of_utc", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        return "UNAVAILABLE", None
    row = rows[0]
    ts = parse_dt(row["as_of_utc"])
    age = (now - ts).total_seconds() / 60.0
    if age > 20:
        return "STALE", None
    status = str(row.get("status") or "UNAVAILABLE")
    z = row.get("z_current")
    try:
        z = float(z) if z is not None else None
    except Exception:
        z = None
    return status, z


def quote_after(client, asset, target):
    tol = BASELINE_TOLERANCE_MINUTES[asset]
    lo = target - timedelta(minutes=2)
    hi = target + timedelta(minutes=tol)
    rows = (
        client.table("live_market_minute")
        .select("ts_utc,price,source,quality_status")
        .eq("asset", asset)
        .gte("ts_utc", iso(lo))
        .lte("ts_utc", iso(hi))
        .order("ts_utc")
        .limit(50)
        .execute()
        .data
        or []
    )
    if not rows:
        return None
    row = min(rows, key=lambda r: abs((parse_dt(r["ts_utc"]) - target).total_seconds()))
    return {
        "ts": parse_dt(row["ts_utc"]),
        "price": float(row["price"]),
        "source": row.get("source"),
        "quality": row.get("quality_status"),
    }


def quote_before(client, asset, target):
    gap = ENDPOINT_MAX_GAP_MINUTES[asset]
    lo = target - timedelta(minutes=gap)
    rows = (
        client.table("live_market_minute")
        .select("ts_utc,price,source,quality_status")
        .eq("asset", asset)
        .gte("ts_utc", iso(lo))
        .lte("ts_utc", iso(target))
        .order("ts_utc", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        return None
    row = rows[0]
    ts = parse_dt(row["ts_utc"])
    age = (target - ts).total_seconds() / 60.0
    if age > gap + 0.01:
        return None
    return {
        "ts": ts,
        "price": float(row["price"]),
        "source": row.get("source"),
        "quality": row.get("quality_status"),
    }


def baseline_quote(client, event_id, window_name, asset, target):
    key = (event_id, window_name, asset)
    if key not in BASELINE_CACHE:
        BASELINE_CACHE[key] = quote_after(client, asset, target)
    return BASELINE_CACHE[key]


def frozen_endpoint_quote(client, event_id, window_name, asset, target):
    key = (event_id, window_name, asset)
    if key not in FROZEN_ENDPOINT_CACHE:
        FROZEN_ENDPOINT_CACHE[key] = quote_before(client, asset, target)
    return FROZEN_ENDPOINT_CACHE[key]


def sign_reading(value, pos, neg, neutral="NEUTRAL"):
    if value is None:
        return "UNAVAILABLE"
    if value > 0:
        return pos
    if value < 0:
        return neg
    return neutral


def market_state_from_oriented(oriented):
    available = [v for v in oriented.values() if v is not None]
    if oriented.get("NQ") is None or len(available) < 3:
        return None
    pos = any(v > 0 for v in available)
    neg = any(v < 0 for v in available)
    if pos and neg:
        return "MIXED"
    if pos:
        return "RISK_ON"
    if neg:
        return "RISK_OFF"
    return "NEUTRAL"


def signature(raw):
    bits = []
    for asset in ("NQ", "ZQ", "ZT", "ZN", "DXY", "VXN", "VIX"):
        v = raw.get(asset)
        if v is None:
            direction = "NA"
        elif v > 0:
            direction = "UP"
        elif v < 0:
            direction = "DOWN"
        else:
            direction = "FLAT"
        bits.append(f"{asset}:{direction}")
    return "|".join(bits)


def build_window(client, event, event_role, name, minutes, now, regime_reading, regime_status):
    event_id = event["event_id"]
    event_ts = parse_dt(event["scheduled_ts_utc"])
    start_ts = event_ts - timedelta(minutes=minutes)

    if now < start_ts:
        return {
            "as_of_utc": iso(minute_floor(now)),
            "event_id": event_id,
            "window": name,
            "event_ts_utc": iso(event_ts),
            "baseline_ts_utc": iso(start_ts),
            "endpoint_ts_utc": None,
            "window_status": "WAITING",
            "data_status": "WAITING",
            "missing_assets": list(ASSETS),
            "active_factors": 0,
            "market_state": None,
            "context_only": True,
            "source_version": VERSION,
            "composite_authorized": False,
            "trade_signal_authorized": False,
            "regime_reading": regime_reading,
            "regime_status": regime_status,
            "cross_asset_signature": "WAITING_EVENT_WINDOW",
            "policy_reading": "UNAVAILABLE",
            "rates_2y_reading": "UNAVAILABLE",
            "rates_10y_reading": "UNAVAILABLE",
            "risk_reading": "UNAVAILABLE",
            "dollar_reading": "UNAVAILABLE",
            "vix_reading": "UNAVAILABLE",
            "vxn_reading": "UNAVAILABLE",
            "sigma_reading": "NOT_APPLICABLE_TO_PRE_EVENT_WINDOW",
            "sigma_z": None,
        }

    frozen = now >= event_ts
    desired_endpoint = event_ts - timedelta(minutes=1) if frozen else minute_floor(now) - timedelta(minutes=1)
    window_status = "FROZEN" if frozen else "ROLLING"

    raw = {}
    missing = []
    for asset in ASSETS:
        b = baseline_quote(client, event_id, name, asset, start_ts)
        e = (
            frozen_endpoint_quote(client, event_id, name, asset, desired_endpoint)
            if frozen
            else quote_before(client, asset, desired_endpoint)
        )
        if not b or not e:
            raw[asset] = None
            missing.append(asset)
        else:
            raw[asset] = safe_pct(b["price"], e["price"])
            if raw[asset] is None:
                missing.append(asset)

    oriented = {
        "NQ": raw["NQ"],
        "ZQ": raw["ZQ"],
        "ZT": raw["ZT"],
        "ZN": raw["ZN"],
        "DXY": -raw["DXY"] if raw["DXY"] is not None else None,
        "VOL": (
            -raw["VXN"] if raw["VXN"] is not None
            else -raw["VIX"] if raw["VIX"] is not None
            else None
        ),
    }
    active = sum(v is not None for v in oriented.values())
    state = market_state_from_oriented(oriented)

    if raw["NQ"] is None:
        data_status = "STALE_OR_UNAVAILABLE"
    elif active >= 3:
        data_status = "OK"
    else:
        data_status = "PARTIAL"

    return {
        "as_of_utc": iso(minute_floor(now)),
        "event_id": event_id,
        "window": name,
        "event_ts_utc": iso(event_ts),
        "baseline_ts_utc": iso(start_ts),
        "endpoint_ts_utc": iso(desired_endpoint),
        "window_status": window_status,
        "nq_raw_pct": raw["NQ"],
        "zq_raw_pct": raw["ZQ"],
        "zt_raw_pct": raw["ZT"],
        "zn_raw_pct": raw["ZN"],
        "dxy_raw_pct": raw["DXY"],
        "vix_raw_pct": raw["VIX"],
        "vxn_raw_pct": raw["VXN"],
        "nq_oriented": oriented["NQ"],
        "zq_oriented": oriented["ZQ"],
        "zt_oriented": oriented["ZT"],
        "zn_oriented": oriented["ZN"],
        "dxy_oriented": oriented["DXY"],
        "macro_score": None,
        "active_factors": active,
        "market_state": state,
        "context_only": True,
        "source_version": VERSION,
        "policy_reading": sign_reading(raw["ZQ"], "DOVISH_REPRICING", "HAWKISH_REPRICING"),
        "rates_2y_reading": sign_reading(raw["ZT"], "YIELD_2Y_DOWN_PROXY", "YIELD_2Y_UP_PROXY"),
        "rates_10y_reading": sign_reading(raw["ZN"], "YIELD_10Y_DOWN_PROXY", "YIELD_10Y_UP_PROXY"),
        "risk_reading": sign_reading(raw["NQ"], "RISK_ON", "RISK_OFF"),
        "dollar_reading": sign_reading(raw["DXY"], "DOLLAR_UP", "DOLLAR_DOWN"),
        "vix_reading": sign_reading(raw["VIX"], "VIX_UP", "VIX_DOWN"),
        "vxn_reading": sign_reading(raw["VXN"], "VXN_UP", "VXN_DOWN"),
        "sigma_reading": "NOT_APPLICABLE_TO_PRE_EVENT_WINDOW",
        "sigma_z": None,
        "cross_asset_signature": signature(raw),
        "data_status": data_status,
        "missing_assets": missing,
        "composite_authorized": False,
        "trade_signal_authorized": False,
        "regime_reading": regime_reading,
        "regime_status": regime_status,
    }


def build_live(client, event, now, regime_reading, regime_status):
    event_id = event["event_id"]
    event_ts = parse_dt(event["scheduled_ts_utc"])
    name = "LIVE"

    if now < event_ts:
        return {
            "as_of_utc": iso(minute_floor(now)),
            "event_id": event_id,
            "window": name,
            "event_ts_utc": iso(event_ts),
            "baseline_ts_utc": iso(event_ts),
            "endpoint_ts_utc": None,
            "window_status": "WAITING",
            "data_status": "WAITING",
            "missing_assets": list(ASSETS),
            "active_factors": 0,
            "market_state": None,
            "context_only": True,
            "source_version": VERSION,
            "composite_authorized": False,
            "trade_signal_authorized": False,
            "regime_reading": regime_reading,
            "regime_status": regime_status,
            "cross_asset_signature": "WAITING_RELEASE",
            "policy_reading": "UNAVAILABLE",
            "rates_2y_reading": "UNAVAILABLE",
            "rates_10y_reading": "UNAVAILABLE",
            "risk_reading": "UNAVAILABLE",
            "dollar_reading": "UNAVAILABLE",
            "vix_reading": "UNAVAILABLE",
            "vxn_reading": "UNAVAILABLE",
            "sigma_reading": "WAITING_RELEASE",
            "sigma_z": None,
        }

    end_cap = event_ts + timedelta(minutes=90)
    frozen = now > end_cap
    desired_endpoint = end_cap if frozen else minute_floor(now) - timedelta(minutes=1)
    window_status = "FROZEN" if frozen else "ROLLING"

    raw = {}
    missing = []
    for asset in ASSETS:
        b = baseline_quote(client, event_id, name, asset, event_ts)
        e = (
            frozen_endpoint_quote(client, event_id, name, asset, desired_endpoint)
            if frozen
            else quote_before(client, asset, desired_endpoint)
        )
        if not b or not e:
            raw[asset] = None
            missing.append(asset)
        else:
            raw[asset] = safe_pct(b["price"], e["price"])
            if raw[asset] is None:
                missing.append(asset)

    oriented = {
        "NQ": raw["NQ"],
        "ZQ": raw["ZQ"],
        "ZT": raw["ZT"],
        "ZN": raw["ZN"],
        "DXY": -raw["DXY"] if raw["DXY"] is not None else None,
        "VOL": (
            -raw["VXN"] if raw["VXN"] is not None
            else -raw["VIX"] if raw["VIX"] is not None
            else None
        ),
    }
    active = sum(v is not None for v in oriented.values())
    state = market_state_from_oriented(oriented)
    sigma_reading, sigma_z = sigma_context(client, now)

    if raw["NQ"] is None:
        data_status = "STALE_OR_UNAVAILABLE"
    elif active >= 3:
        data_status = "OK"
    else:
        data_status = "PARTIAL"

    return {
        "as_of_utc": iso(minute_floor(now)),
        "event_id": event_id,
        "window": name,
        "event_ts_utc": iso(event_ts),
        "baseline_ts_utc": iso(event_ts),
        "endpoint_ts_utc": iso(desired_endpoint),
        "window_status": window_status,
        "nq_raw_pct": raw["NQ"],
        "zq_raw_pct": raw["ZQ"],
        "zt_raw_pct": raw["ZT"],
        "zn_raw_pct": raw["ZN"],
        "dxy_raw_pct": raw["DXY"],
        "vix_raw_pct": raw["VIX"],
        "vxn_raw_pct": raw["VXN"],
        "nq_oriented": oriented["NQ"],
        "zq_oriented": oriented["ZQ"],
        "zt_oriented": oriented["ZT"],
        "zn_oriented": oriented["ZN"],
        "dxy_oriented": oriented["DXY"],
        "macro_score": None,
        "active_factors": active,
        "market_state": state,
        "context_only": True,
        "source_version": VERSION,
        "policy_reading": sign_reading(raw["ZQ"], "DOVISH_REPRICING", "HAWKISH_REPRICING"),
        "rates_2y_reading": sign_reading(raw["ZT"], "YIELD_2Y_DOWN_PROXY", "YIELD_2Y_UP_PROXY"),
        "rates_10y_reading": sign_reading(raw["ZN"], "YIELD_10Y_DOWN_PROXY", "YIELD_10Y_UP_PROXY"),
        "risk_reading": sign_reading(raw["NQ"], "RISK_ON", "RISK_OFF"),
        "dollar_reading": sign_reading(raw["DXY"], "DOLLAR_UP", "DOLLAR_DOWN"),
        "vix_reading": sign_reading(raw["VIX"], "VIX_UP", "VIX_DOWN"),
        "vxn_reading": sign_reading(raw["VXN"], "VXN_UP", "VXN_DOWN"),
        "sigma_reading": sigma_reading,
        "sigma_z": sigma_z,
        "cross_asset_signature": signature(raw),
        "data_status": data_status,
        "missing_assets": missing,
        "composite_authorized": False,
        "trade_signal_authorized": False,
        "regime_reading": regime_reading,
        "regime_status": regime_status,
    }


def heartbeat(client, status, details):
    client.table("live_pipeline_heartbeat").upsert(
        {
            "component": "MARKET_STATE_ENGINE",
            "last_seen_utc": iso(utcnow()),
            "status": status,
            "details": details,
            "source_version": VERSION,
        },
        on_conflict="component",
    ).execute()


def cycle(client):
    now = utcnow()
    event, event_role = target_event(client)
    if not event:
        info = {"state": "NO_TARGET_EVENT", "context_only": True, "operational_authorized": False}
        heartbeat(client, "WARMUP", info)
        return info

    regime_reading, regime_status = regime_context(client)
    rows = [
        build_window(client, event, event_role, name, minutes, now, regime_reading, regime_status)
        for name, minutes in WINDOWS
    ]
    rows.append(build_live(client, event, now, regime_reading, regime_status))

    client.table("live_market_state").upsert(
        rows, on_conflict="as_of_utc,window"
    ).execute()

    active = [r for r in rows if r["window_status"] != "WAITING"]
    if not active:
        status = "WARMUP"
        state = "WAITING_EVENT_WINDOWS"
    elif any(r["data_status"] == "STALE_OR_UNAVAILABLE" for r in active):
        status = "STALE"
        state = "ACTIVE_WITH_STALE_INPUTS"
    else:
        status = "OK"
        state = "ACTIVE"

    info = {
        "state": state,
        "event_id": event["event_id"],
        "event_role": event_role,
        "event_ts_utc": event["scheduled_ts_utc"],
        "windows": {
            r["window"]: {
                "window_status": r["window_status"],
                "data_status": r["data_status"],
                "market_state": r["market_state"],
                "active_factors": r["active_factors"],
                "missing_assets": r["missing_assets"],
            }
            for r in rows
        },
        "methodology": "STRICT_SIGN_STATE_MACHINE_NO_WEIGHTED_SCORE",
        "context_only": True,
        "composite_authorized": False,
        "trade_signal_authorized": False,
        "operational_authorized": False,
    }
    heartbeat(client, status, info)
    return info


def main():
    if not SUPABASE_URL:
        raise SystemExit("[ERRO] RISKDESK_SUPABASE_URL nao definida.")
    if not SUPABASE_SECRET_KEY:
        raise SystemExit("[ERRO] RISKDESK_SUPABASE_SECRET_KEY nao definida.")

    client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
    print("Risk Desk Market State V2 iniciado. Ctrl+C para encerrar.")
    last_print = None

    while True:
        try:
            info = cycle(client)
            compact = {
                "state": info.get("state"),
                "event_id": info.get("event_id"),
                "windows": {
                    k: {
                        "status": v.get("data_status"),
                        "market": v.get("market_state"),
                        "factors": v.get("active_factors"),
                    }
                    for k, v in (info.get("windows") or {}).items()
                },
            }
            printable = json.dumps(compact, ensure_ascii=False, sort_keys=True)
            if printable != last_print:
                print(datetime.now().strftime("%H:%M:%S"), printable)
                last_print = printable
        except KeyboardInterrupt:
            try:
                heartbeat(client, "STOPPED", {"message": "Encerrado pelo usuario."})
            except Exception:
                pass
            return
        except Exception as exc:
            print("[ERRO]", type(exc).__name__, str(exc))
            try:
                heartbeat(
                    client,
                    "ERROR",
                    {"error": type(exc).__name__, "message": str(exc)[:500]},
                )
            except Exception:
                pass

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
