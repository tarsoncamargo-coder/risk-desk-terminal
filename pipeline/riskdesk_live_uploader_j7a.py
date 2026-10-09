"""Risk Desk V10.0.0J7A local uploader: NinjaTrader CSV -> Supabase.
No credentials are hardcoded. Uses Windows environment variables only.
"""
from __future__ import annotations
import csv, json, os, sys, time
from datetime import datetime, timezone
from pathlib import Path
try:
    from supabase import create_client
except ImportError:
    print("Falta o pacote supabase. Execute: py -m pip install supabase")
    raise

VERSION="V10.0.0J7A"
VALID_ASSETS={"NQ","ZQ","ZT","ZN"}
DEFAULT_CSV=Path.home()/"Documents"/"NinjaTrader 8"/"LaranjinhaML"/"Live"/"RiskDeskLiveBridge_J7A.csv"
STATE_FILE=Path.home()/"Documents"/"NinjaTrader 8"/"LaranjinhaML"/"Live"/"riskdesk_live_uploader_state_j7a.json"
SUPABASE_URL=os.environ.get("RISKDESK_SUPABASE_URL","").strip()
SUPABASE_SECRET_KEY=os.environ.get("RISKDESK_SUPABASE_SECRET_KEY","").strip()
CSV_PATH=Path(os.environ.get("RISKDESK_LIVE_CSV",str(DEFAULT_CSV)))
POLL_SECONDS=15

def die(msg):
    print("[ERRO]",msg); sys.exit(1)

def parse_utc(value):
    value=value.strip()
    if value.endswith("Z"): value=value[:-1]+"+00:00"
    dt=datetime.fromisoformat(value)
    if dt.tzinfo is None: dt=dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def load_state():
    if not STATE_FILE.exists(): return {"last_ts":{}}
    try: return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception: return {"last_ts":{}}

def save_state(state):
    STATE_FILE.parent.mkdir(parents=True,exist_ok=True)
    tmp=STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state,indent=2),encoding="utf-8")
    tmp.replace(STATE_FILE)

def read_new_rows(state):
    if not CSV_PATH.exists(): return []
    last_ts=state.setdefault("last_ts",{})
    out=[]
    with CSV_PATH.open("r",encoding="utf-8-sig",newline="") as f:
        reader=csv.DictReader(f)
        required={"ts_utc","asset","symbol","price","volume","source"}
        if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
            raise RuntimeError("CSV inválido.")
        for row in reader:
            asset=row["asset"].strip().upper()
            if asset not in VALID_ASSETS: continue
            dt=parse_utc(row["ts_utc"]); prior=last_ts.get(asset)
            if prior and parse_utc(prior)>=dt: continue
            out.append({
                "ts_utc":dt.isoformat().replace("+00:00","Z"),
                "asset":asset,
                "symbol":row.get("symbol","").strip() or None,
                "price":float(row["price"]),
                "source":row.get("source","").strip() or "NINJATRADER",
                "contract":row.get("symbol","").strip() or None,
                "volume":float(row["volume"]) if row.get("volume","").strip() else None,
                "quality_status":"OK",
                "received_at":datetime.now(timezone.utc).isoformat()
            })
    out.sort(key=lambda x:(x["ts_utc"],x["asset"]))
    return out

def upsert_rows(client,rows,state):
    if not rows: return 0
    for i in range(0,len(rows),100):
        client.table("live_market_minute").upsert(rows[i:i+100],on_conflict="ts_utc,asset,source").execute()
    last_ts=state.setdefault("last_ts",{})
    for row in rows:
        if row["asset"] not in last_ts or parse_utc(row["ts_utc"])>parse_utc(last_ts[row["asset"]]):
            last_ts[row["asset"]]=row["ts_utc"]
    save_state(state); return len(rows)

def heartbeat(client,status,details):
    client.table("live_pipeline_heartbeat").upsert({
        "component":"NINJATRADER_BRIDGE",
        "last_seen_utc":datetime.now(timezone.utc).isoformat(),
        "status":status,
        "details":details,
        "source_version":VERSION
    },on_conflict="component").execute()

def main():
    if not SUPABASE_URL: die("Defina RISKDESK_SUPABASE_URL.")
    if not SUPABASE_SECRET_KEY: die("Defina RISKDESK_SUPABASE_SECRET_KEY localmente.")
    client=create_client(SUPABASE_URL,SUPABASE_SECRET_KEY)
    state=load_state()
    heartbeat(client,"WARMUP",{"message":"Uploader iniciado; aguardando barras."})
    print("Risk Desk J7A iniciado. Ctrl+C para encerrar.")
    while True:
        try:
            rows=read_new_rows(state); n=upsert_rows(client,rows,state)
            heartbeat(client,"OK" if state.get("last_ts") else "WARMUP",{
                "uploaded_this_cycle":n,
                "last_ts":state.get("last_ts",{}),
                "dxy":"PENDING_J7B"
            })
            if n: print(datetime.now().strftime("%H:%M:%S"),"upload:",n)
        except KeyboardInterrupt:
            try: heartbeat(client,"STOPPED",{"message":"Encerrado pelo usuário."})
            except Exception: pass
            return
        except Exception as exc:
            print("[ERRO]",type(exc).__name__,str(exc))
            try: heartbeat(client,"ERROR",{"error":type(exc).__name__,"message":str(exc)[:500]})
            except Exception: pass
        time.sleep(POLL_SECONDS)

if __name__=="__main__": main()
