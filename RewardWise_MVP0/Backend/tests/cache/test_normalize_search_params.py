from app.cache.normalize import normalize_search_params


def test_tuple_returns_8_elements():
    """Lock the 8-tuple shape. Adding/removing elements must break this test."""
    params = {
        "origin": "JFK",
        "destination": "LAX",
        "departure_date": "2026-06-01",
        "departure_date_end": "2026-06-08",
        "return_date": "2026-06-15",
        "return_date_end": "2026-06-18",
        "passengers": 1,
        "cabin": "economy",
    }
    result = normalize_search_params(params)
    assert len(result) == 8


def test_tuple_order_origin_dest_dep_depend_ret_retend_pax_cabin():
    """Lock positions: dep_end is 4th, ret_end is 6th, passengers is 7th."""
    params = {
        "origin": "JFK",
        "destination": "LAX",
        "departure_date": "2026-06-01",
        "departure_date_end": "2026-06-08",
        "return_date": "2026-06-15",
        "return_date_end": "2026-06-18",
        "passengers": 2,
        "cabin": "business",
    }
    o, d, dep, dep_end, ret, ret_end, pax, cab = normalize_search_params(params)
    assert o == "JFK"
    assert d == "LAX"
    assert dep == "2026-06-01"
    assert dep_end == "2026-06-08"
    assert ret == "2026-06-15"
    assert ret_end == "2026-06-18"
    assert pax == 2
    assert cab == "BUSINESS"


def test_single_date_search_dep_end_empty_string():
    """A single-date search (no departure_date_end) returns empty string for that position."""
    params = {
        "origin": "JFK",
        "destination": "LAX",
        "departure_date": "2026-06-01",
        "return_date": "2026-06-15",
        "passengers": 1,
        "cabin": "economy",
    }
    o, d, dep, dep_end, ret, ret_end, pax, cab = normalize_search_params(params)
    assert dep_end == ""
    assert ret_end == ""


def test_dep_end_none_normalizes_to_empty_string():
    """Explicit None for departure_date_end / return_date_end normalizes to empty string."""
    params = {
        "origin": "JFK",
        "destination": "LAX",
        "departure_date": "2026-06-01",
        "departure_date_end": None,
        "return_date": None,
        "return_date_end": None,
        "passengers": 1,
        "cabin": "economy",
    }
    _, _, _, dep_end, ret, ret_end, _, _ = normalize_search_params(params)
    assert dep_end == ""
    assert ret == ""
    assert ret_end == ""
