"""Risk Desk V10.0.0J12-PREP-PUBLISHER

J11 + frozen J10 GEN2 -> Supabase prospective publication bridge.

This script does NOT train, retune, recalibrate, backtest, route orders,
or change Laranjinha. It only:
1) reads the existing POST5 + J11 enrichment files,
2) requires J11 source readiness,
3) runs the frozen J10 predict_shadow engine,
4) persists semantic state,
5) inserts the original GEN2 shadow prediction once (immutable),
6) updates GEN2_SHADOW heartbeat.

J12 is NOT considered validated merely because this script runs.
The first genuinely fresh POST5 still requires end-to-end audit.
"""
from __future__ import annotations

from pathlib import Path
from datetime import datetime, timezone, timedelta
import importlib.util
import json
import math
import os
import sys
import time

import numpy as np
import pandas as pd

try:
    from supabase import create_client
except ImportError:
    print("Falta o pacote supabase. Execute: C:\\Python314\\python.exe -m pip install supabase")
    raise

VERSION = "V10.0.0J12-PREP-PUBLISHER"
COMPONENT = "GEN2_SHADOW"
POLL_SECONDS = 30

NT = Path.home() / "Documents" / "NinjaTrader 8"
LARANJINHA = NT / "LaranjinhaML"
ROOT = LARANJINHA / "HistoricoML_V7"

PACKAGE = ROOT / "NASDAQ_GEN2_SHADOW_V10_0_0J10_FINAL"
ENGINE = PACKAGE / "RiskDesk_Nasdaq_GEN2_Shadow_Inference.py"

PRIMARY = LARANJINHA / "RiskDesk_Nasdaq_GEN1_POST5_FEATURES_Live.csv"
ENRICH = LARANJINHA / "RiskDesk_Nasdaq_GEN2_Live_Enrichment.csv"
J11_STATUS = LARANJINHA / "RiskDesk_GEN2_FeatureBuilder_Status_J11.json"
LOCAL_STATUS = LARANJINHA / "RiskDesk_J12_Prospective_Publisher_Status.json"

SUPABASE_URL = os.environ.get("RISKDESK_SUPABASE_URL", "").strip()
SUPABASE_SECRET_KEY = os.environ.get("RISKDESK_SUPABASE_SECRET_KEY", "").strip()


def utc_now():
    return datetime.now(timezone.utc)


def now_iso():
    return utc_now().isoformat()


def die(msg):
    print("[ERRO]", msg)
    raise RuntimeError(msg)


def parse_utc(value):
    if value is None:
        return None
    t = pd.Timestamp(value)
    if pd.isna(t):
        return None
    if t.tzinfo is None:
        t = t.tz_localize("UTC")
    else:
        t = t.tz_convert("UTC")
    return t


def event_iso(value):
    t = parse_utc(value)
    if t is None:
        return None
    return t.isoformat().replace("+00:00", "Z")


def same_event_time(a, b):
    ta = parse_utc(a)
    tb = parse_utc(b)
    if ta is None or tb is None:
        return False
    return ta.floor("min") == tb.floor("min")


def load_engine():
    if not ENGINE.exists():
        raise FileNotFoundError(f"Engine J10 nao encontrado: {ENGINE}")
    spec = importlib.util.spec_from_file_location("gen2_j10_frozen", ENGINE)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def read_latest_csv(path):
    if not path.exists():
        return None
    df = pd.read_csv(path, low_memory=False)
    if df.empty:
        return None
    if "DT_EVENTO_UTC" in df.columns:
        dt = pd.to_datetime(df["DT_EVENTO_UTC"], errors="coerce", utc=True)
        valid = df.loc[dt.notna()].copy()
        if valid.empty:
            return None
        valid["_dt"] = dt[dt.notna()]
        valid = valid.sort_values("_dt")
        return valid.iloc[-1].drop(labels=["_dt"]).to_dict()
    return df.iloc[-1].to_dict()


def read_json(path):
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8-sig"))


def merge_inputs():
    primary = read_latest_csv(PRIMARY)
    if primary is None:
        return None, None, "NO_POST5_FEATURE_ROW"

    enrich = read_latest_csv(ENRICH)
    if enrich is None:
        return primary, None, "NO_J11_ENRICHMENT_ROW"

    if not same_event_time(primary.get("DT_EVENTO_UTC"), enrich.get("DT_EVENTO_UTC")):
        return primary, enrich, "POST5_ENRICHMENT_EVENT_MISMATCH"

    row = dict(primary)
    for k, v in enrich.items():
        if k == "DT_EVENTO_UTC":
            continue
        if pd.notna(v):
            row[k] = v
        elif k not in row:
            row[k] = v
    return row, enrich, None


def clean_json_value(v):
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        v = float(v)
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    if isinstance(v, (pd.Timestamp, datetime)):
        if getattr(v, "tzinfo", None) is None:
            v = v.replace(tzinfo=timezone.utc)
        return v.isoformat()
    if isinstance(v, dict):
        return {str(k): clean_json_value(x) for k, x in v.items()}
    if isinstance(v, (list, tuple, set)):
        return [clean_json_value(x) for x in v]
    if pd.isna(v) if not isinstance(v, (str, bytes, bool)) else False:
        return None
    return v


def clean_json(obj):
    return clean_json_value(obj)


def parse_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    s = str(value).strip().lower()
    if s in {"true", "1", "yes", "sim", "y"}:
        return True
    if s in {"false", "0", "no", "nao", "não", "n", ""}:
        return False
    return default


def safe_int(value, default=0):
    try:
        if value is None or pd.isna(value):
            return default
        return int(float(value))
    except Exception:
        return default


def write_local_status(payload):
    LOCAL_STATUS.parent.mkdir(parents=True, exist_ok=True)
    LOCAL_STATUS.write_text(
        json.dumps(clean_json(payload), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def heartbeat(client, status, details):
    body = {
        "component": COMPONENT,
        "last_seen_utc": now_iso(),
        "status": status,
        "details": clean_json(details),
        "source_version": VERSION,
    }
    client.table("live_pipeline_heartbeat").upsert(
        body, on_conflict="component"
    ).execute()


def family_candidates(raw):
    s = str(raw or "").strip().upper()
    out = {s} if s else set()
    if any(x in s for x in ["INFLA", "CPI", "PCE", "PPI"]):
        out.update({"CPI", "INFLATION", "INFLACAO"})
    if any(x in s for x in ["EMPREGO", "EMPLOY", "PAYROLL", "LABOR", "LABOUR"]):
        out.update({"EMPLOYMENT", "EMPREGO", "LABOR"})
    return {x for x in out if x}


def resolve_event_id(client, event_ts_utc, family):
    t = parse_utc(event_ts_utc)
    if t is None:
        return None, "INVALID_EVENT_TIMESTAMP"

    lo = (t - pd.Timedelta(seconds=30)).isoformat()
    hi = (t + pd.Timedelta(seconds=30)).isoformat()

    resp = (
        client.table("live_event_state")
        .select("event_id,event_family,scheduled_ts_utc,status")
        .gte("scheduled_ts_utc", lo)
        .lt("scheduled_ts_utc", hi)
        .execute()
    )
    rows = list(resp.data or [])
    if not rows:
        return None, "NO_SUPABASE_EVENT_AT_TIMESTAMP"
    if len(rows) == 1:
        return rows[0], None

    fams = family_candidates(family)
    matched = [r for r in rows if str(r.get("event_family", "")).upper() in fams]
    if len(matched) == 1:
        return matched[0], None

    return None, "AMBIGUOUS_SUPABASE_EVENT_AT_TIMESTAMP"


def data_quality_from_j11(meta):
    if not meta or meta.get("source_ready") is not True:
        return "INSUFFICIENT"
    if int(meta.get("value_nan_count") or 0) == 0:
        return "EXCELLENT"
    return "GOOD"


def semantic_payload(event_rec, row, meta):
    sem = (meta or {}).get("semantic") or {}
    return {
        "event_id": event_rec["event_id"],
        "event_ts_utc": event_iso(row.get("DT_EVENTO_UTC")),
        "family": row.get("FamiliaMacro") or event_rec.get("event_family"),
        "stance_bundle": row.get("StanceBundle"),
        "conflito_semantico": parse_bool(row.get("ConflitoSemantico"), False),
        "pressao_monetaria_z_mean": clean_json_value(row.get("PressaoMonetariaZ_Mean")),
        "pressao_dominante_z": clean_json_value(row.get("PressaoDominanteZ")),
        "qtd_hawkish": safe_int(row.get("QtdHawkish"), 0),
        "qtd_dovish": safe_int(row.get("QtdDovish"), 0),
        "qtd_neutral": safe_int(row.get("QtdNeutral"), 0),
        "qtd_componentes_z_semanticos": safe_int(row.get("QtdComponentesZSemanticos"), 0),
        "mapping_complete": bool(sem.get("mapping_complete") is True),
        "unmapped_keys": list(sem.get("unmapped_keys") or []),
        "blocked_keys": list(sem.get("blocked_keys") or []),
        "prospective_fresh": bool(meta.get("prospective_fresh") is True),
        "observation_class": meta.get("observation_class"),
        "data_quality": data_quality_from_j11(meta),
        "feature_builder_version": meta.get("version") or row.get("J11_VERSION"),
        "source_version": VERSION,
        "context_only": True,
        "trade_signal_authorized": False,
        "operational_authorized": False,
        "updated_at": now_iso(),
    }


def publish_semantic(client, payload):
    client.table("live_event_semantic_state").upsert(
        clean_json(payload), on_conflict="event_id"
    ).execute()


def find_existing_prediction(client, event_id, pred, feature_builder_version):
    resp = (
        client.table("gen2_shadow_prediction_history")
        .select("prediction_id,prediction_ts_utc")
        .eq("event_id", event_id)
        .eq("model_version", pred["version"])
        .eq("feature_builder_version", feature_builder_version)
        .eq("stage", pred["stage"])
        .eq("horizon_minutes", int(pred["horizon_min"]))
        .limit(1)
        .execute()
    )
    rows = list(resp.data or [])
    return rows[0] if rows else None


def insert_prediction_once(client, event_rec, row, pred, meta, required):
    feature_builder_version = str(meta.get("version") or row.get("J11_VERSION") or "UNKNOWN")
    existing = find_existing_prediction(
        client, event_rec["event_id"], pred, feature_builder_version
    )
    if existing:
        return existing["prediction_id"], False

    payload_snapshot = {
        "semantics": "P_ALTA_CONDICIONAL_A_MOVIMENTO_RELEVANTE",
        "required_features": required,
        "features_at_inference": {c: clean_json_value(row.get(c)) for c in required},
        "j11_status": clean_json(meta),
        "prediction": clean_json(pred),
        "source_event": clean_json(event_rec),
    }

    body = {
        "event_id": event_rec["event_id"],
        "event_ts_utc": event_iso(row.get("DT_EVENTO_UTC")),
        "prediction_ts_utc": now_iso(),
        "stage": pred["stage"],
        "horizon_minutes": int(pred["horizon_min"]),
        "p_up_raw": float(pred["p_up_raw"]),
        "p_up_isotonic": float(pred["p_up_isotonic"]),
        "direction_shadow": pred["direction_shadow"],
        "family": pred["family"],
        "prediction_source": pred["model_source"],
        "model_name": "HGB",
        "model_version": pred["version"],
        "feature_builder_version": feature_builder_version,
        "prospective_fresh": True,
        "feature_schema_complete": True,
        "data_quality": data_quality_from_j11(meta),
        "shadow_only": True,
        "probability_of_profit": False,
        "trade_signal": False,
        "entry_filter": False,
        "operational_authorized": False,
        "payload": clean_json(payload_snapshot),
    }
    resp = client.table("gen2_shadow_prediction_history").insert(body).execute()
    rows = list(resp.data or [])
    pred_id = rows[0].get("prediction_id") if rows else None
    return pred_id, True


def cycle(client, engine):
    row, enrich, merge_err = merge_inputs()
    if row is None:
        state = {
            "mode": "RESEARCH_SHADOW_ONLY",
            "state": merge_err or "NO_POST5_FEATURE_ROW",
            "probability_of_profit": False,
            "trade_signal": False,
            "entry_filter": False,
            "operational_authorized": False,
        }
        heartbeat(client, "WARMUP", state)
        write_local_status(state)
        return state

    j11 = read_json(J11_STATUS)
    if not j11:
        state = {
            "mode": "RESEARCH_SHADOW_ONLY",
            "state": "WAITING_J11_STATUS",
            "event_ts_utc": event_iso(row.get("DT_EVENTO_UTC")),
            "operational_authorized": False,
        }
        heartbeat(client, "WARMUP", state)
        write_local_status(state)
        return state

    if merge_err:
        state = {
            "mode": "RESEARCH_SHADOW_ONLY",
            "state": merge_err,
            "event_ts_utc": event_iso(row.get("DT_EVENTO_UTC")),
            "j11_event_ts_utc": j11.get("event_ts_utc"),
            "operational_authorized": False,
        }
        heartbeat(client, "WARMUP", state)
        write_local_status(state)
        return state

    if not same_event_time(row.get("DT_EVENTO_UTC"), j11.get("event_ts_utc")):
        state = {
            "mode": "RESEARCH_SHADOW_ONLY",
            "state": "POST5_J11_STATUS_EVENT_MISMATCH",
            "event_ts_utc": event_iso(row.get("DT_EVENTO_UTC")),
            "j11_event_ts_utc": j11.get("event_ts_utc"),
            "operational_authorized": False,
        }
        heartbeat(client, "WARMUP", state)
        write_local_status(state)
        return state

    if j11.get("state") != "ENRICHMENT_READY" or j11.get("source_ready") is not True:
        state = {
            "mode": "RESEARCH_SHADOW_ONLY",
            "state": "WAITING_J11_EXACT_SOURCE_READY",
            "event_ts_utc": event_iso(row.get("DT_EVENTO_UTC")),
            "j11_state": j11.get("state"),
            "fred_ready": j11.get("fred_ready"),
            "dxy_ready": j11.get("dxy_ready"),
            "semantic_source_ready": j11.get("semantic_source_ready"),
            "operational_authorized": False,
        }
        heartbeat(client, "WARMUP", state)
        write_local_status(state)
        return state

    required = engine.required_features()
    missing_columns = [c for c in required if c not in row]
    if missing_columns:
        state = {
            "mode": "RESEARCH_SHADOW_ONLY",
            "state": "WAITING_EXACT_LIVE_FEATURE_SCHEMA",
            "event_ts_utc": event_iso(row.get("DT_EVENTO_UTC")),
            "required_feature_count": len(required),
            "missing_feature_count": len(missing_columns),
            "missing_features": missing_columns,
            "operational_authorized": False,
        }
        heartbeat(client, "WARMUP", state)
        write_local_status(state)
        return state

    event_rec, event_err = resolve_event_id(
        client, row.get("DT_EVENTO_UTC"), row.get("FamiliaMacro")
    )
    if event_rec is None:
        state = {
            "mode": "RESEARCH_SHADOW_ONLY",
            "state": event_err,
            "event_ts_utc": event_iso(row.get("DT_EVENTO_UTC")),
            "family": row.get("FamiliaMacro"),
            "prospective_fresh": bool(j11.get("prospective_fresh") is True),
            "operational_authorized": False,
        }
        heartbeat(client, "WARMUP", state)
        write_local_status(state)
        return state

    sem_body = semantic_payload(event_rec, row, j11)
    publish_semantic(client, sem_body)

    if j11.get("prospective_fresh") is not True or j11.get("observation_class") != "PROSPECTIVE_FRESH":
        state = {
            "mode": "RESEARCH_SHADOW_ONLY",
            "state": "HISTORICAL_OR_STALE_NOT_ELIGIBLE_FOR_J12",
            "event_id": event_rec["event_id"],
            "event_ts_utc": event_iso(row.get("DT_EVENTO_UTC")),
            "observation_class": j11.get("observation_class"),
            "prospective_fresh": bool(j11.get("prospective_fresh") is True),
            "semantic_persisted": True,
            "gen2_prediction_persisted": False,
            "operational_authorized": False,
        }
        heartbeat(client, "WARMUP", state)
        write_local_status(state)
        return state

    pred = engine.predict_shadow(row)

    hard_flags_ok = (
        pred.get("probability_of_profit") is False
        and pred.get("trade_signal") is False
        and pred.get("entry_filter") is False
        and pred.get("operational_authorized") is False
        and pred.get("shadow_only") is True
    )
    if not hard_flags_ok:
        raise RuntimeError("GEN2 frozen governance flags changed. Publication blocked.")

    p_raw = float(pred["p_up_raw"])
    p_iso = float(pred["p_up_isotonic"])
    if not (0.0 <= p_raw <= 1.0 and 0.0 <= p_iso <= 1.0):
        raise RuntimeError("GEN2 probability outside [0,1].")

    pred_id, inserted = insert_prediction_once(
        client, event_rec, row, pred, j11, required
    )

    state = {
        "mode": "RESEARCH_SHADOW_ONLY",
        "state": "PROSPECTIVE_SHADOW_PERSISTED_PENDING_J12_VALIDATION",
        "event_id": event_rec["event_id"],
        "event_ts_utc": event_iso(row.get("DT_EVENTO_UTC")),
        "feature_schema_complete": True,
        "required_feature_count": len(required),
        "semantic_persisted": True,
        "prediction_id": pred_id,
        "prediction_inserted_now": bool(inserted),
        "prospective_fresh": True,
        **clean_json(pred),
    }
    heartbeat(client, "OK", state)
    write_local_status(state)
    return state


def main():
    if not SUPABASE_URL:
        die("Defina RISKDESK_SUPABASE_URL.")
    if not SUPABASE_SECRET_KEY:
        die("Defina RISKDESK_SUPABASE_SECRET_KEY.")

    client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
    engine = load_engine()

    print("Risk Desk J12 PREP Publisher iniciado. Ctrl+C para encerrar.")
    print("Sem treino, sem retuning, sem sinal operacional.")
    last_signature = None

    while True:
        try:
            state = cycle(client, engine)
            sig = (
                state.get("state"),
                state.get("event_id"),
                state.get("event_ts_utc"),
                state.get("prediction_id"),
            )
            if sig != last_signature:
                print(
                    datetime.now().isoformat(timespec="seconds"),
                    json.dumps(clean_json(state), ensure_ascii=False),
                )
                last_signature = sig
        except KeyboardInterrupt:
            try:
                heartbeat(client, "STOPPED", {
                    "mode": "RESEARCH_SHADOW_ONLY",
                    "state": "STOPPED_BY_USER",
                    "operational_authorized": False,
                })
            except Exception:
                pass
            return
        except Exception as exc:
            state = {
                "mode": "RESEARCH_SHADOW_ONLY",
                "state": "ERROR",
                "error": type(exc).__name__,
                "message": str(exc)[:1000],
                "probability_of_profit": False,
                "trade_signal": False,
                "entry_filter": False,
                "operational_authorized": False,
            }
            print("[ERRO]", json.dumps(state, ensure_ascii=False))
            write_local_status(state)
            try:
                heartbeat(client, "ERROR", state)
            except Exception:
                pass

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
