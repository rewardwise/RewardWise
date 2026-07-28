"""Shared payload cache contract: params-keyed (no user), fresh-window read,
LOUD failure on query errors (the L2 lesson — never a silent zero)."""
from app.cache.payload_cache import (
    get_cached_payload,
    payload_cache_key,
    put_cached_payload,
)

PARAMS = {
    "origin": "SEA", "destination": "NRT,HND",
    "departure_date": "2027-03-15", "departure_date_end": None,
    "return_date": "2027-03-31", "return_date_end": None,
    "passengers": 1, "cabin": "business",
}


class _Q:
    def __init__(self, rows=None, raise_exc=None, log=None):
        self._rows = rows or []
        self._raise = raise_exc
        self.log = log if log is not None else []

    def __getattr__(self, name):
        def chain(*a, **k):
            self.log.append((name, a))
            return self
        return chain

    def execute(self):
        if self._raise:
            raise self._raise
        return type("R", (), {"data": self._rows})()


class _Client:
    def __init__(self, rows=None, raise_exc=None):
        self.q = _Q(rows, raise_exc)

    def table(self, name):
        assert name == "search_payload_cache"
        return self.q


def test_key_is_params_only_no_user():
    key = payload_cache_key(dict(PARAMS))
    assert key.startswith("payload:search:")
    assert "user" not in key


def test_hit_returns_payload():
    client = _Client(rows=[{"payload": {"cash_data": {"cash_price": 3669}}, "created_at": "x"}])
    out = get_cached_payload(client, dict(PARAMS))
    assert out == {"cash_data": {"cash_price": 3669}}
    # freshness filter applied
    assert any(c[0] == "gte" for c in client.q.log)


def test_miss_returns_none():
    assert get_cached_payload(_Client(rows=[]), dict(PARAMS)) is None


def test_read_error_is_LOUD_never_silent(capsys):
    client = _Client(raise_exc=RuntimeError("42P01 relation does not exist"))
    assert get_cached_payload(client, dict(PARAMS)) is None
    out = capsys.readouterr().out
    assert "payload_cache ERROR" in out
    assert "42P01" in out


def test_write_error_is_LOUD_and_nonfatal(capsys):
    client = _Client(raise_exc=RuntimeError("boom"))
    put_cached_payload(client, dict(PARAMS), {"cash_data": {}})  # must not raise
    assert "payload_cache ERROR write failed" in capsys.readouterr().out


def test_write_upserts_and_prunes():
    client = _Client(rows=[])
    put_cached_payload(client, dict(PARAMS), {"cash_data": {"cash_price": 1}})
    ops = [c[0] for c in client.q.log]
    assert "upsert" in ops
    assert "delete" in ops and "lt" in ops  # prune-on-write
