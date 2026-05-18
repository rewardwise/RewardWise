from app.cache.keys import build_search_cache_key


def test_single_date_search_key_omits_dep_end_segment():
    """Single-date search (no departure_date_end) produces key WITHOUT the -{dep_end} segment."""
    params = {
        "origin": "JFK",
        "destination": "LAX",
        "departure_date": "2026-06-01",
        "return_date": "2026-06-15",
        "passengers": 1,
        "cabin": "economy",
    }
    key = build_search_cache_key(params)
    assert key == "search:JFK|LAX|2026-06-01|2026-06-15|1|ECONOMY"
    # Segment is just the depart date, no flex window.
    assert key.split("|")[2] == "2026-06-01"


def test_flex_search_includes_dep_end_segment():
    """Flexible-date search produces key WITH the -{dep_end} segment."""
    params = {
        "origin": "JFK",
        "destination": "LAX",
        "departure_date": "2026-06-01",
        "departure_date_end": "2026-06-08",
        "return_date": "2026-06-15",
        "passengers": 1,
        "cabin": "economy",
    }
    key = build_search_cache_key(params)
    assert key == "search:JFK|LAX|2026-06-01-2026-06-08|2026-06-15|1|ECONOMY"


def test_dep_end_equal_to_dep_omits_segment():
    """If departure_date_end equals departure_date, the segment is omitted (treated as single-date)."""
    params = {
        "origin": "JFK",
        "destination": "LAX",
        "departure_date": "2026-06-01",
        "departure_date_end": "2026-06-01",
        "return_date": "2026-06-15",
        "passengers": 1,
        "cabin": "economy",
    }
    key = build_search_cache_key(params)
    # Segment collapses to the single date when dep_end equals dep.
    assert key.split("|")[2] == "2026-06-01"


def test_two_flex_windows_produce_distinct_keys():
    """Different departure_date_end values must produce different cache keys."""
    base = {
        "origin": "JFK",
        "destination": "LAX",
        "departure_date": "2026-06-01",
        "return_date": "2026-06-15",
        "passengers": 1,
        "cabin": "economy",
    }
    key_a = build_search_cache_key({**base, "departure_date_end": "2026-06-08"})
    key_b = build_search_cache_key({**base, "departure_date_end": "2026-06-10"})
    assert key_a != key_b


def test_flex_vs_single_distinct_keys():
    """A flex-date and single-date search on the same anchor must NOT share a cache key."""
    base = {
        "origin": "JFK",
        "destination": "LAX",
        "departure_date": "2026-06-01",
        "return_date": "2026-06-15",
        "passengers": 1,
        "cabin": "economy",
    }
    single = build_search_cache_key(base)
    flex = build_search_cache_key({**base, "departure_date_end": "2026-06-08"})
    assert single != flex


def test_both_flex_search_includes_both_range_segments():
    """Both-flexible round-trip key carries -end ranges on both outbound and return."""
    params = {
        "origin": "JFK",
        "destination": "LAX",
        "departure_date": "2026-06-01",
        "departure_date_end": "2026-06-08",
        "return_date": "2026-06-15",
        "return_date_end": "2026-06-22",
        "passengers": 1,
        "cabin": "economy",
    }
    key = build_search_cache_key(params)
    assert (
        key
        == "search:JFK|LAX|2026-06-01-2026-06-08|2026-06-15-2026-06-22|1|ECONOMY"
    )


def test_return_flex_only_segment():
    """Return-only flex search (rigid outbound + flex return) keys correctly."""
    params = {
        "origin": "JFK",
        "destination": "LAX",
        "departure_date": "2026-06-01",
        "return_date": "2026-06-15",
        "return_date_end": "2026-06-22",
        "passengers": 1,
        "cabin": "economy",
    }
    key = build_search_cache_key(params)
    assert key == "search:JFK|LAX|2026-06-01|2026-06-15-2026-06-22|1|ECONOMY"


def test_distinct_keys_for_return_end_variations():
    """Different return_date_end values must produce different cache keys."""
    base = {
        "origin": "JFK",
        "destination": "LAX",
        "departure_date": "2026-06-01",
        "departure_date_end": "2026-06-08",
        "return_date": "2026-06-15",
        "passengers": 1,
        "cabin": "economy",
    }
    key_a = build_search_cache_key({**base, "return_date_end": "2026-06-20"})
    key_b = build_search_cache_key({**base, "return_date_end": "2026-06-22"})
    assert key_a != key_b


def test_key_byte_identical_when_return_end_absent_or_empty():
    """Backward compat: omitting / empty-string return_date_end produces the
    same key as the pre-P1-D-2 behavior — rigid + outbound-flex searches must
    not be invalidated by the new param."""
    base = {
        "origin": "JFK",
        "destination": "LAX",
        "departure_date": "2026-06-01",
        "return_date": "2026-06-15",
        "passengers": 1,
        "cabin": "economy",
    }
    key_absent = build_search_cache_key(base)
    key_none = build_search_cache_key({**base, "return_date_end": None})
    key_empty = build_search_cache_key({**base, "return_date_end": ""})
    assert key_absent == key_none == key_empty
    assert key_absent == "search:JFK|LAX|2026-06-01|2026-06-15|1|ECONOMY"
