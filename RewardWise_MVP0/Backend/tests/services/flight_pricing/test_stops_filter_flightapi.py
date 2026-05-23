"""FlightAPI post-normalization stops-filter (86ba2ze4g).

FlightAPI's positional URL has no stops slot, so the cap is enforced
client-side via _apply_stops_filter. Round-trip itineraries must satisfy
the cap on BOTH legs.
"""

from app.services.flight_pricing.flightapi_provider import (
    STOPS_CAP,
    _apply_stops_filter,
)


def _make_normalized(flights):
    return {
        "cash_price": flights[0]["price"] if flights else None,
        "currency": "USD",
        "source": "flightapi",
        "flights": flights,
        "price_level": None,
        "typical_price_range": None,
        "is_roundtrip": False,
    }


def test_flightapi_nonstop_keeps_only_zero_stop_flights():
    normalized = _make_normalized([
        {"price": 100, "stops": 0},
        {"price": 200, "stops": 1},
        {"price": 300, "stops": 2},
    ])
    result = _apply_stops_filter(normalized, "nonstop")
    assert len(result["flights"]) == 1
    assert result["flights"][0]["stops"] == 0
    assert result["cash_price"] == 100


def test_flightapi_one_or_fewer_keeps_zero_and_one_stop():
    normalized = _make_normalized([
        {"price": 100, "stops": 0},
        {"price": 200, "stops": 1},
        {"price": 300, "stops": 2},
    ])
    result = _apply_stops_filter(normalized, "one_or_fewer")
    assert [f["stops"] for f in result["flights"]] == [0, 1]
    assert result["cash_price"] == 100


def test_flightapi_two_or_fewer_keeps_all_flights():
    normalized = _make_normalized([
        {"price": 100, "stops": 0},
        {"price": 200, "stops": 1},
        {"price": 300, "stops": 2},
    ])
    result = _apply_stops_filter(normalized, "two_or_fewer")
    assert len(result["flights"]) == 3
    assert result["cash_price"] == 100


def test_flightapi_any_passes_through_unchanged():
    """Regression guard: 'any' leaves both flights list AND cash_price intact."""
    normalized = _make_normalized([
        {"price": 100, "stops": 0},
        {"price": 200, "stops": 1},
        {"price": 300, "stops": 2},
    ])
    result = _apply_stops_filter(normalized, "any")
    assert len(result["flights"]) == 3
    assert result["cash_price"] == 100


def test_flightapi_roundtrip_drops_flight_when_return_leg_exceeds_cap():
    """0-stop outbound + 2-stop return is dropped at max=one_or_fewer."""
    normalized = _make_normalized([
        {
            "price": 100,
            "stops": 0,
            "return_flight": {"stops": 2},
        },
        {
            "price": 150,
            "stops": 0,
            "return_flight": {"stops": 1},
        },
    ])
    result = _apply_stops_filter(normalized, "one_or_fewer")
    assert len(result["flights"]) == 1
    assert result["flights"][0]["price"] == 150
    assert result["cash_price"] == 150


def test_flightapi_filter_returns_none_cash_price_when_all_dropped():
    normalized = _make_normalized([
        {"price": 200, "stops": 1},
        {"price": 300, "stops": 2},
    ])
    result = _apply_stops_filter(normalized, "nonstop")
    assert result["flights"] == []
    assert result["cash_price"] is None


def test_flightapi_stops_cap_is_locked_to_docs_values():
    """FlightAPI has no request-level stops slot; cap is locked module-level."""
    assert STOPS_CAP == {
        "any": None,
        "nonstop": 0,
        "one_or_fewer": 1,
        "two_or_fewer": 2,
    }
