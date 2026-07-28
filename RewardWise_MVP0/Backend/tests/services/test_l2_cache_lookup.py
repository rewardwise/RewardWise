"""L2 lookup contract (schema-drift incident 2026-07-28: the query referenced
nonexistent flex-end columns, a bare except swallowed the 42703, and L2 hit
rate was silently 0% for the feature's whole life)."""
import pytest

from app.cache.db_cache import find_search_verdict_in_db


class _Resp:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, data=None, raise_exc=None, selected=None):
        self._data = data or []
        self._raise = raise_exc
        self.selected = selected

    def __getattr__(self, name):
        def chain(*a, **k):
            if name == "select" and self.selected is not None:
                self.selected.append(a[0])
            return self
        return chain

    def execute(self):
        if self._raise:
            raise self._raise
        return _Resp(self._data)


class _Client:
    def __init__(self, searches=None, verdicts=None, raise_exc=None):
        self._searches = searches or []
        self._verdicts = verdicts or []
        self._raise = raise_exc
        self.selects = []

    def table(self, name):
        if self._raise:
            return _Query(raise_exc=self._raise, selected=self.selects)
        return _Query(self._searches if name == "searches" else self._verdicts, selected=self.selects)


PARAMS = {
    "origin": "SEA", "destination": "NRT,HND",
    "departure_date": "2027-03-15", "departure_date_end": None,
    "return_date": "2027-03-31", "return_date_end": None,
    "passengers": 1, "cabin": "business",
}
ROW = {"id": "s-1", "origin": "SEA", "destination": "NRT,HND",
       "departure_date": "2027-03-15", "return_date": "2027-03-31",
       "passengers": 1, "cabin": "business"}


def test_hits_on_matching_row_with_real_columns_only():
    client = _Client(searches=[ROW], verdicts=[{"id": "v-1", "search_id": "s-1", "details": {"x": 1}}])
    hit = find_search_verdict_in_db(client, dict(PARAMS))
    assert hit is not None
    assert hit.verdict["id"] == "v-1"
    # The query must never reference the nonexistent flex-end columns.
    for sel in client.selects:
        assert "departure_date_end" not in sel
        assert "return_date_end" not in sel


def test_flex_end_params_skip_l2_no_false_hit():
    client = _Client(searches=[ROW], verdicts=[{"id": "v-1", "search_id": "s-1", "details": {}}])
    flex = dict(PARAMS, departure_date_end="2027-03-18")
    assert find_search_verdict_in_db(client, flex) is None


def test_mismatched_return_date_misses():
    client = _Client(searches=[ROW], verdicts=[{"id": "v-1", "search_id": "s-1", "details": {}}])
    assert find_search_verdict_in_db(client, dict(PARAMS, return_date="2027-03-30")) is None


def test_query_error_LOGS_and_misses(capsys, caplog):
    client = _Client(raise_exc=RuntimeError("42703 column does not exist"))
    out = find_search_verdict_in_db(client, dict(PARAMS))
    assert out is None
    captured = capsys.readouterr().out
    assert "l2_cache ERROR" in captured, "a query error must be LOUD, never a silent miss"
    assert "42703" in captured
