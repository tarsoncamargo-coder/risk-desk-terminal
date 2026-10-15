"""J15 gold-only local uploader (NinjaTrader MGC OnBarClose CSV -> private Supabase).
No imports from Laranjinha trading engine. Does not alter the NQ J7A uploader.
Uses the already-provisioned RISKDESK_SUPABASE_URL and
RISKDESK_SUPABASE_SECRET_KEY from the local Windows environment. No hardcoded keys.
"""
from __future__ import annotations

import csv
import json
import math
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    from supabase import create_client
except ImportError:
    print("[GOLD J15] Missing supabase Python package (reuse the existing Risk Desk environment).")
    raise

VERSION = "RiskDeskGoldJ15.0"
ASSET = "MGC"
SOURCE = "NINJATRADER_GOLD_BRIDGE"
CONTRACT = re.compile(r"^MGC (0[1-9]|1[0-2])-\d{2}$")
LIVE_FOLDER = Path.home() / "Documents" / "NinjaTrader 8" / "LaranjinhaML" / "Live"
CSV_PATH = Path(os.environ.get("RISKDESK_GOLD_CSV", str(LIVE_FOLDER / "RiskDeskGoldBridge_MGC_M1.csv")))
STATE_FILE = LIVE_FOLDER / "riskdesk_gold_m1_uploader_j15_state.json"
URL = os.environ.get("RISKDESK_SUPABASE_URL", "").strip()
KEY = os.environ.get("RISKDESK_SUPABASE_SECRET_KEY", "").strip()
POLL_SECONDS = 15

REQUIRED = (
    "bar_timestamp_utc", "asset", "contract", "close_price",
    "volume", "source", "nt_observed_at_utc"
)


def parse_utc(value: str) -> datetime:
    dt = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    if dt.tzinfo is None:
        raise ValueError("timestamp must contain timezone")
    return dt.astimezone(timezone.utc)


def load_state() -> dict:
    if not STATE_FILE.exists():
        return {"last_by_contract": {}}
    try:
        data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data.get("last_by_contract"), dict) else {"last_by_contract": {}}
    except (OSError, ValueError, TypeError):
        return {"last_by_contract": {}}


def save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    temp = STATE_FILE.with_suffix(".tmp")
    temp.write_text(json.dumps(state, sort_keys=True, indent=2), encoding="utf-8")
    os.replace(temp, STATE_FILE)


def read_new_rows(state: dict) -> list[dict]:
    if not CSV_PATH.exists():
        return []
    raw = CSV_PATH.read_text(encoding="utf-8-sig")
    if not raw:
        return []
    # Do not process the final CSV record while NinjaTrader may still be appending it.
    if not raw.endswith("\n"):
        raw = raw[:raw.rfind("\n") + 1]
    if not raw:
        return []
    reader = csv.DictReader(raw.splitlines())
    if reader.fieldnames is None or tuple(reader.fieldnames) != REQUIRED:
        raise ValueError("Unexpected gold CSV schema; check J15 indicator and path")
    last = state.get("last_by_contract", {})
    output = []
    dedup = set()
    now = datetime.now(timezone.utc)

    for row in reader:
        if not row or any(row.get(key) is None for key in REQUIRED):
            continue
        if row["asset"] != ASSET or row["source"] != SOURCE:
            continue
        contract = row["contract"].strip()
        if not CONTRACT.fullmatch(contract):
            continue
        bar_ts, observed_ts = parse_utc(row["bar_timestamp_utc"]), parse_utc(row["nt_observed_at_utc"])
        observed_lag = (observed_ts - bar_ts).total_seconds()
        # The NinjaScript bridge writes completed bars only, and rejects replay.
        if observed_lag < -60 or observed_lag > 180:
            continue
        if observed_ts > now + timedelta(minutes=2):
            continue
        if (now - bar_ts).days > 60:
            continue
        if last.get(contract) and bar_ts <= parse_utc(last[contract]):
            continue
        identity = (contract, bar_ts)
        if identity in dedup:
            continue
        dedup.add(identity)
        close = float(row["close_price"])
        volume = float(row["volume"]) if row["volume"].strip() else None
        if not math.isfinite(close) or not (100 < close < 100000):
            continue
        if volume is not None and (not math.isfinite(volume) or volume < 0):
            continue
        output.append({
            "bar_timestamp_utc": bar_ts.isoformat(),
            "asset": ASSET,
            "contract": contract,
            "source": SOURCE,
            "close_price": close,
            "volume": volume,
            "nt_observed_at_utc": observed_ts.isoformat(),
            "sample_origin": "NINJASCRIPT_ONBARCLOSE_M1",
            "state": "CLOSED_BAR_SOURCE_ASSERTED_NOT_INDEPENDENTLY_AUDITED",
            "trading_authorized": False,
        })
    output.sort(key=lambda r: (r["bar_timestamp_utc"], r["contract"]))
    return output


def upload(client, rows: list[dict], state: dict) -> int:
    if not rows:
        return 0
    last = state.setdefault("last_by_contract", {})
    sent = 0
    for at in range(0, len(rows), 80):
        batch = rows[at:at + 80]
        # Database primary key makes upload idempotent; no other live asset is affected.
        client.table("riskdesk_j15_gold_m1_closed_v1").upsert(
            batch, on_conflict="bar_timestamp_utc,asset,contract,source").execute()
        sent += len(batch)
        for rec in batch:
            contract, ts = rec["contract"], rec["bar_timestamp_utc"]
            if not last.get(contract) or parse_utc(ts) > parse_utc(last[contract]):
                last[contract] = ts
        # State only advances AFTER successful insertion.
        save_state(state)
    return sent


def heartbeat(client, status: str, count: int, state: dict, details: str) -> None:
    last_by_contract = state.get("last_by_contract", {})
    latest = max(last_by_contract.values(), default=None)
    recent = None
    if latest:
        recent = parse_utc(latest)
    newest_contract = max(last_by_contract, key=lambda x: parse_utc(last_by_contract[x])) if last_by_contract else None
    client.table("riskdesk_j15_gold_bridge_health_v1").upsert({
        "component": "NINJATRADER_MGC_BRIDGE",
        "last_seen_utc": datetime.now(timezone.utc).isoformat(),
        "last_bar_timestamp_utc": latest,
        "last_observed_at_utc": None,
        "contract": newest_contract,
        "status": status if status != "OK" or (recent and datetime.now(timezone.utc) - recent < timedelta(minutes=5)) else "NO_RECENT_MARKET_BAR",
        "inserted_last_cycle": count,
        "details": details[:250],
        "trading_authorized": False,
    }, on_conflict="component").execute()


def main() -> int:
    if not URL or not KEY:
        print("[GOLD J15] Missing local RISKDESK_SUPABASE_URL / RISKDESK_SUPABASE_SECRET_KEY.")
        return 2
    client = create_client(URL, KEY)
    state = load_state()
    print("[GOLD J15] Read-only market collector started; expects MGC 1-minute NinjaTrader indicator CSV.")
    print("[GOLD J15] CSV:", CSV_PATH)
    while True:
        try:
            rows = read_new_rows(state)
            inserted = upload(client, rows, state)
            heartbeat(client, "OK" if state["last_by_contract"] else "WARMUP",
                      inserted, state, "Source: MGC NinjaTrader realtime OnBarClose CSV")
            if inserted:
                print(datetime.now().strftime("%H:%M:%S"), "MGC uploaded:", inserted)
        except KeyboardInterrupt:
            try:
                heartbeat(client, "STOPPED", 0, state, "Stopped by user")
            except Exception:
                pass
            return 0
        except Exception as exc:
            print("[GOLD J15] ERROR", type(exc).__name__, str(exc)[:250])
            try:
                heartbeat(client, "ERROR", 0, state, type(exc).__name__)
            except Exception:
                pass
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    sys.exit(main())
