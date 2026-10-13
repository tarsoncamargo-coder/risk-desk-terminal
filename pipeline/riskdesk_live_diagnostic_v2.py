"""Risk Desk live stack diagnostic V2.
Prints one compact RESUMO PARA CHATGPT block.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

from supabase import create_client

VERSION = "V10.0.0-LIVE-DIAG-V2"
ASSETS = ("NQ","ZQ","ZT","ZN","DXY","VIX","VXN")
COMPONENTS = (
    "NINJATRADER_BRIDGE",
    "DXY_ADAPTER",
    "VIX_ADAPTER",
    "VXN_ADAPTER",
    "AUX_MARKET_ADAPTER",
    "MARKET_STATE_ENGINE",
    "GEN1_CONTEXT",
    "GEN2_SHADOW",
)


def parse_dt(v):
    return datetime.fromisoformat(str(v).replace("Z","+00:00")).astimezone(timezone.utc)


def main():
    url=os.environ.get("RISKDESK_SUPABASE_URL","").strip()
    key=os.environ.get("RISKDESK_SUPABASE_SECRET_KEY","").strip()
    if not url or not key:
        raise SystemExit("[ERRO] Variaveis do Supabase nao definidas.")

    client=create_client(url,key)
    now=datetime.now(timezone.utc)
    assets={}
    for asset in ASSETS:
        rows=(client.table("live_market_minute")
              .select("ts_utc,price,source,quality_status")
              .eq("asset",asset)
              .order("ts_utc",desc=True)
              .limit(1)
              .execute().data or [])
        if not rows:
            assets[asset]={"status":"NO_DATA"}
            continue
        r=rows[0]
        age=(now-parse_dt(r["ts_utc"])).total_seconds()/60.0
        assets[asset]={
            "status":"FRESH" if age<=20 else "STALE",
            "age_min":round(max(0,age),1),
            "source":r.get("source"),
            "quality":r.get("quality_status"),
            "price":r.get("price"),
            "ts_utc":r.get("ts_utc"),
        }

    hb=(client.table("live_pipeline_heartbeat")
        .select("component,status,last_seen_utc,source_version")
        .in_("component",list(COMPONENTS))
        .execute().data or [])
    heartbeats={r["component"]:{
        "status":r.get("status"),
        "age_min":round(max(0,(now-parse_dt(r["last_seen_utc"])).total_seconds()/60.0),1),
        "version":r.get("source_version"),
    } for r in hb}

    ms=(client.table("riskdesk_product_market_state_v2_v1")
        .select("window,market_state_v2,product_status,active_factors,missing_assets,as_of_utc")
        .execute().data or [])

    summary={
        "version":VERSION,
        "utc_now":now.isoformat(),
        "assets":assets,
        "heartbeats":heartbeats,
        "market_state":[{
            "window":r.get("window"),
            "state":r.get("market_state_v2"),
            "status":r.get("product_status"),
            "factors":r.get("active_factors"),
            "missing":r.get("missing_assets"),
            "as_of_utc":r.get("as_of_utc"),
        } for r in ms],
        "operational_authorized":False,
    }
    print("\n================ RESUMO PARA CHATGPT ================")
    print(json.dumps(summary,ensure_ascii=False,indent=2))
    print("=======================================================")


if __name__=="__main__":
    main()
