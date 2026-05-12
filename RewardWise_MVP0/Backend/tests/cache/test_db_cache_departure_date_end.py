"""
Cache-partitioning tests for find_search_verdict_in_db.

Each test installs a fake supabase client that:
- Records the .eq / .is_ filter calls on the searches table.
- Returns canned rows from .execute() so the Python post-filter loop can run.
- Returns a canned verdict row when the verdicts table is queried.

The four spec cases verify that a flexible-date search and a single-date search
no longer collide on the same OD+cabin+pax+departure_date tuple.
"""

from app.cache.db_cache import find_search_verdict_in_db


class _FakeQuery:
    """Records filter chain calls and returns canned rows from execute()."""

    def __init__(self, rows):
        self._rows = rows
        self.filters = {}
        self.is_filters = {}

    def select(self, *_, **__):
        return self

    def eq(self, col, value):
        self.filters[col] = value
        return self

    def is_(self, col, value):
        self.is_filters[col] = value
        return self

    def gte(self, *_, **__):
        return self

    def order(self, *_, **__):
        return self

    def limit(self, *_, **__):
        return self

    def execute(self):
        return _FakeResponse(self._rows)


class _FakeResponse:
    def __init__(self, rows):
        self.data = rows


class _FakeSupabase:
    """Routes table('searches') and table('verdicts') to separate fake queries."""

    def __init__(self, search_rows, verdict_rows):
        self.search_query = _FakeQuery(search_rows)
        self.verdict_query = _FakeQuery(verdict_rows)

    def table(self, name):
        if name == "searches":
            return self.search_query
        if name == "verdicts":
            return self.verdict_query
        raise AssertionError(f"Unexpected table: {name}")


def _verdict_row(search_id="s1", recommendation="pay_cash"):
    return {
        "id": "v1",
        "search_id": search_id,
        "recommendation": recommendation,
        "summary": "test",
        "details": {},
        "calculated_cpp": None,
        "cash_price_used": 300.0,
        "points_cost_used": None,
        "created_at": "2026-05-12T00:00:00+00:00",
    }


def test_flex_search_misses_single_date_cache():
    """A flexible-date search must NOT return a row that was cached for a single-date search."""
    # Single-date cached row: departure_date_end is NULL in the database.
    search_rows = [
        {
            "id": "s1",
            "origin": "JFK",
            "destination": "LAX",
            "departure_date": "2026-06-01",
            "departure_date_end": None,
            "return_date": None,
            "passengers": 1,
            "cabin": "economy",
        }
    ]
    fake = _FakeSupabase(search_rows=search_rows, verdict_rows=[_verdict_row()])

    # Query with a flexible-date window: the SQL filter chain will request
    # rows where departure_date_end equals '2026-06-08', which the canned row
    # does not match. The post-filter rejects it too.
    params = {
        "origin": "JFK",
        "destination": "LAX",
        "departure_date": "2026-06-01",
        "departure_date_end": "2026-06-08",
        "return_date": None,
        "passengers": 1,
        "cabin": "economy",
    }
    result = find_search_verdict_in_db(fake, params)

    # The query builder must have used .eq() for the flex case (not .is_("null")).
    assert fake.search_query.filters.get("departure_date_end") == "2026-06-08"
    assert "departure_date_end" not in fake.search_query.is_filters
    # And the Python post-filter must have rejected the NULL row.
    assert result is None


def test_single_date_misses_flex_cache():
    """A single-date search must NOT return a row that was cached for a flexible-date search."""
    # Flex-date cached row: departure_date_end is set.
    search_rows = [
        {
            "id": "s2",
            "origin": "JFK",
            "destination": "LAX",
            "departure_date": "2026-06-01",
            "departure_date_end": "2026-06-08",
            "return_date": None,
            "passengers": 1,
            "cabin": "economy",
        }
    ]
    fake = _FakeSupabase(search_rows=search_rows, verdict_rows=[_verdict_row()])

    # Single-date query: departure_date_end is absent.
    params = {
        "origin": "JFK",
        "destination": "LAX",
        "departure_date": "2026-06-01",
        "return_date": None,
        "passengers": 1,
        "cabin": "economy",
    }
    result = find_search_verdict_in_db(fake, params)

    # The query builder must have used .is_("null") for the single-date branch.
    assert fake.search_query.is_filters.get("departure_date_end") == "null"
    assert "departure_date_end" not in fake.search_query.filters
    # Post-filter still rejects since the only row has a non-null end date.
    assert result is None


def test_flex_searches_partition_on_end_date():
    """Two flex searches with different end dates must not share a cache row."""
    # Cached row is for the Mon-Fri window; query asks about Mon-Thu.
    search_rows = [
        {
            "id": "s3",
            "origin": "JFK",
            "destination": "LAX",
            "departure_date": "2026-06-01",
            "departure_date_end": "2026-06-05",
            "return_date": None,
            "passengers": 1,
            "cabin": "economy",
        }
    ]
    fake = _FakeSupabase(search_rows=search_rows, verdict_rows=[_verdict_row()])

    params = {
        "origin": "JFK",
        "destination": "LAX",
        "departure_date": "2026-06-01",
        "departure_date_end": "2026-06-04",
        "return_date": None,
        "passengers": 1,
        "cabin": "economy",
    }
    result = find_search_verdict_in_db(fake, params)

    assert fake.search_query.filters.get("departure_date_end") == "2026-06-04"
    assert result is None


def test_matching_flex_window_hits_cache():
    """Sanity check: a flex search matching an identical cached flex row returns the verdict."""
    search_rows = [
        {
            "id": "s4",
            "origin": "JFK",
            "destination": "LAX",
            "departure_date": "2026-06-01",
            "departure_date_end": "2026-06-08",
            "return_date": None,
            "passengers": 1,
            "cabin": "economy",
        }
    ]
    fake = _FakeSupabase(search_rows=search_rows, verdict_rows=[_verdict_row(search_id="s4")])

    params = {
        "origin": "JFK",
        "destination": "LAX",
        "departure_date": "2026-06-01",
        "departure_date_end": "2026-06-08",
        "return_date": None,
        "passengers": 1,
        "cabin": "economy",
    }
    result = find_search_verdict_in_db(fake, params)

    assert result is not None
    assert result.search["id"] == "s4"
    assert result.verdict["search_id"] == "s4"


def test_cabin_partitions_independently():
    """Regression: cabin difference still rejects rows even with matching end-date."""
    search_rows = [
        {
            "id": "s5",
            "origin": "JFK",
            "destination": "LAX",
            "departure_date": "2026-06-01",
            "departure_date_end": None,
            "return_date": None,
            "passengers": 1,
            "cabin": "business",  # cached as business
        }
    ]
    fake = _FakeSupabase(search_rows=search_rows, verdict_rows=[_verdict_row()])

    # Query for economy on the same OD/date/pax — must miss.
    params = {
        "origin": "JFK",
        "destination": "LAX",
        "departure_date": "2026-06-01",
        "return_date": None,
        "passengers": 1,
        "cabin": "economy",
    }
    result = find_search_verdict_in_db(fake, params)
    assert result is None
