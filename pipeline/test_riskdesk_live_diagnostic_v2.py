from riskdesk_live_diagnostic_v2 import classify_asset_status


def test_delayed_quality_is_reported_as_delayed():
    assert classify_asset_status("DXY", 10.0, "DELAYED_SOURCE") == "DELAYED"


def test_sparse_zq_is_not_mislabeled_as_pipeline_failure():
    assert classify_asset_status("ZQ", 36.0, "OK") == "SPARSE_NOT_FRESH"


def test_normal_recent_asset_is_fresh():
    assert classify_asset_status("NQ", 1.0, "OK") == "FRESH"
