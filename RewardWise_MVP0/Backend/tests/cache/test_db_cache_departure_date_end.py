"""
Cache-partitioning tests for find_search_verdict_in_db.

Each test installs a fake supabase client that:
- Records the .eq / .is_ filter calls on the searches table.
- Returns canned rows from .execute() so the Python post-filter loop can run.
- Returns a canned verdict row when the verdicts table is queried.

2026-07-28 rewrite: the original four cases pinned a flex-end SCHEMA THAT
NEVER EXISTED (searches has no departure_date_end/return_date_end columns) —
the fake client accepted the phantom columns, so the tests passed while the
real query threw 42703 on every call and L2 sat at 0% hit rate. New contract:
flex searches SKIP L2 entirely (no columns to partition on -> matching one to
an exact-date row would reuse the wrong verdict), exact-date searches match on
real columns only, and the query never references the phantom columns.
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


def _params(**over):
    base = {
        "origin": "SEA", "destination": "NRT,HND",
        "departure_date": "2027-03-15", "departure_date_end": None,
        "return_date": "2027-03-31", "return_date_end": None,
        "passengers": 1, "cabin": "business",
    }
    base.update(over)
    return base


_ROW = {"id": "s-1", "origin": "SEA", "destination": "NRT,HND",
        "departure_date": "2027-03-15", "return_date": "2027-03-31",
        "passengers": 1, "cabin": "business"}


def test_flex_search_skips_l2_entirely():
    client = _FakeSupabase([_ROW], [_verdict_row(search_id="s-1")])
    assert find_search_verdict_in_db(client, _params(departure_date_end="2027-03-18")) is None
    assert find_search_verdict_in_db(client, _params(return_date_end="2027-04-02")) is None


def test_exact_date_search_hits_on_real_columns():
    client = _FakeSupabase([_ROW], [_verdict_row(search_id="s-1")])
    hit = find_search_verdict_in_db(client, _params())
    assert hit is not None and hit.search["id"] == "s-1"


def test_query_never_references_phantom_flex_columns():
    client = _FakeSupabase([_ROW], [_verdict_row(search_id="s-1")])
    find_search_verdict_in_db(client, _params())
    q = client.search_query
    assert "departure_date_end" not in q.filters
    assert "departure_date_end" not in q.is_filters


def test_exact_date_does_not_match_different_return_date():
    client = _FakeSupabase([_ROW], [_verdict_row(search_id="s-1")])
    assert find_search_verdict_in_db(client, _params(return_date="2027-03-30")) is None
