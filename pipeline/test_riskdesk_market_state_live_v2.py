from riskdesk_market_state_live_v2 import is_usable_quality, cache_non_null


def test_delayed_source_is_not_usable_for_live_market_state():
    assert is_usable_quality("DELAYED_SOURCE") is False
    assert is_usable_quality("STALE_SOURCE") is False
    assert is_usable_quality("OFF_SESSION_SOURCE") is False
    assert is_usable_quality("OK") is True


def test_cache_non_null_does_not_freeze_missing_quote():
    cache = {}
    key = ("event", "PRE60", "DXY")
    assert cache_non_null(cache, key, None) is None
    assert key not in cache
    value = {"price": 100.0}
    assert cache_non_null(cache, key, value) == value
    assert cache[key] == value
