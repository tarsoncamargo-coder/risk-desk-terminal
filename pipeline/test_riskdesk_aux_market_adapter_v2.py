from riskdesk_aux_market_adapter_v2 import classify_quote_state


def test_delayed_dxy_is_not_fresh_even_inside_expected_session():
    status, state, quality = classify_quote_state(
        expected_session=True,
        age_minutes=10.1,
        freshness_limit_minutes=20,
        transport_lag_minutes=10.1,
        max_transport_lag_minutes=3,
    )
    assert status == "STALE"
    assert state == "DELAYED_SOURCE"
    assert quality == "DELAYED_SOURCE"


def test_off_session_volatility_is_stale_not_error():
    status, state, quality = classify_quote_state(
        expected_session=False,
        age_minutes=390,
        freshness_limit_minutes=20,
        transport_lag_minutes=390,
        max_transport_lag_minutes=3,
    )
    assert status == "STALE"
    assert state == "OUTSIDE_EXPECTED_SESSION"
    assert quality == "OFF_SESSION_SOURCE"
