from riskdesk_live_uploader_j7a import dedupe_rows

def test_dedupe_rows_removes_duplicate_conflict_keys_and_keeps_latest_row():
    rows = [
        {
            "ts_utc": "2026-10-12T19:43:00Z",
            "asset": "NQ",
            "source": "NINJATRADER",
            "price": 30888.50,
        },
        {
            "ts_utc": "2026-10-12T19:43:00Z",
            "asset": "NQ",
            "source": "NINJATRADER",
            "price": 30888.75,
        },
        {
            "ts_utc": "2026-10-12T19:43:00Z",
            "asset": "ZT",
            "source": "NINJATRADER",
            "price": 101.8046875,
        },
    ]

    result = dedupe_rows(rows)
    keys = [(r["ts_utc"], r["asset"], r["source"]) for r in result]

    assert len(result) == 2
    assert len(keys) == len(set(keys))
    nq = next(r for r in result if r["asset"] == "NQ")
    assert nq["price"] == 30888.75
