"""Hardening contract (2026-07-26): retry once on 5xx/connection errors only —
NEVER on timeout, never on 4xx — and the short-TTL last-good cash cache serves
a recent price on SerpAPI failure instead of an empty state."""
import httpx
import pytest

import app.services.flight_pricing.serpapi_provider as sp


class _Resp:
    def __init__(self, status=200, payload=None):
        self.status_code = status
        self._payload = payload or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("boom", request=httpx.Request("GET", "http://x"), response=self)

    def json(self):
        return self._payload


def _patch_get(monkeypatch, outcomes):
    """outcomes: list of exceptions-or-_Resp, consumed per call."""
    calls = {"n": 0}

    async def fake_get(self, url, params=None, timeout=None):
        out = outcomes[min(calls["n"], len(outcomes) - 1)]
        calls["n"] += 1
        if isinstance(out, Exception):
            raise out
        return out

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    return calls


@pytest.mark.asyncio
async def test_retries_once_on_5xx(monkeypatch):
    calls = _patch_get(monkeypatch, [_Resp(502), _Resp(200, {"ok": True})])
    data = await sp._serpapi_get_with_retry({})
    assert data == {"ok": True}
    assert calls["n"] == 2


@pytest.mark.asyncio
async def test_never_retries_timeout(monkeypatch):
    calls = _patch_get(monkeypatch, [httpx.ReadTimeout("slow")])
    with pytest.raises(httpx.TimeoutException):
        await sp._serpapi_get_with_retry({})
    assert calls["n"] == 1  # a timeout retry would double the user's wait


@pytest.mark.asyncio
async def test_never_retries_4xx(monkeypatch):
    calls = _patch_get(monkeypatch, [_Resp(401)])
    with pytest.raises(httpx.HTTPStatusError):
        await sp._serpapi_get_with_retry({})
    assert calls["n"] == 1  # deterministic failure; retry burns quota


@pytest.mark.asyncio
async def test_retries_once_on_connect_error(monkeypatch):
    calls = _patch_get(monkeypatch, [httpx.ConnectError("refused"), _Resp(200, {"ok": 1})])
    assert await sp._serpapi_get_with_retry({}) == {"ok": 1}
    assert calls["n"] == 2


def test_cash_cache_roundtrip_and_ttl(monkeypatch):
    key = sp._cash_cache_key("SEA", "SFO", "2026-11-25", "2026-11-29", "economy", 1, "any")
    sp._cash_cache_put(key, {"cash_price": 157, "source": "serpapi"})
    assert sp._cash_cache_get(key)["cash_price"] == 157
    # Expire it
    ts, val = sp._cash_cache[key]
    sp._cash_cache[key] = (ts - sp.CASH_CACHE_TTL_SECONDS - 1, val)
    assert sp._cash_cache_get(key) is None


@pytest.mark.asyncio
async def test_failure_serves_recent_price_with_stale_marker(monkeypatch):
    key = sp._cash_cache_key("SEA", "SFO", "2026-11-25", "2026-11-29", "ECONOMY", 1, "ANY")
    sp._cash_cache_put(key, {"cash_price": 157, "source": "serpapi", "flights": []})
    monkeypatch.setenv("SERPAPI_KEY", "test-key")
    _patch_get(monkeypatch, [httpx.ReadTimeout("slow")])
    result = await sp.get_serpapi_cash_price("SEA", "SFO", "2026-11-25", "economy", 1, "2026-11-29", max_stops="any")
    assert result["cash_price"] == 157
    assert result["stale_cash"] is True
    assert result["source"].endswith("_recent")


@pytest.mark.asyncio
async def test_cache_first_serves_recent_price_without_http(monkeypatch):
    """Sampler mode: a fresh cached price for the EXACT query short-circuits
    the HTTP call entirely (2 of 3 SerpAPI draws per search removed on
    repeat routes)."""
    key = sp._cash_cache_key("PDX", "BOI", "2026-10-13", None, "ECONOMY", 1, "ANY")
    sp._cash_cache_put(key, {"cash_price": 129, "source": "serpapi", "flights": []})

    async def _no_http(*a, **k):  # noqa: ANN001
        raise AssertionError("cache_first hit must not call SerpAPI")

    monkeypatch.setenv("SERPAPI_KEY", "test-key")
    monkeypatch.setattr(sp, "_serpapi_get_with_retry", _no_http)
    result = await sp.get_serpapi_cash_price("PDX", "BOI", "2026-10-13", "economy", 1, None, max_stops="any", cache_first=True)
    assert result["cash_price"] == 129
    assert result["cash_cache_hit"] is True


@pytest.mark.asyncio
async def test_cache_first_miss_falls_through_to_live(monkeypatch):
    called = {}

    async def _live(params):  # noqa: ANN001
        called["yes"] = True
        return {"best_flights": [], "other_flights": [], "price_insights": {"lowest_price": 88}}

    monkeypatch.setenv("SERPAPI_KEY", "test-key")
    monkeypatch.setattr(sp, "_serpapi_get_with_retry", _live)
    result = await sp.get_serpapi_cash_price("PDX", "GEG", "2026-10-14", "economy", 1, None, cache_first=True)
    assert called.get("yes") is True
    assert result["cash_price"] == 88.0


@pytest.mark.asyncio
async def test_main_quote_ignores_cache_even_when_fresh(monkeypatch):
    """Default (cache_first=False) MUST stay live-always — the headline cash
    price is never served stale on the initial fetch."""
    key = sp._cash_cache_key("PDX", "BOI", "2026-10-13", None, "ECONOMY", 1, "ANY")
    sp._cash_cache_put(key, {"cash_price": 999, "source": "serpapi", "flights": []})
    called = {}

    async def _live(params):  # noqa: ANN001
        called["yes"] = True
        return {"best_flights": [], "other_flights": [], "price_insights": {"lowest_price": 131}}

    monkeypatch.setenv("SERPAPI_KEY", "test-key")
    monkeypatch.setattr(sp, "_serpapi_get_with_retry", _live)
    result = await sp.get_serpapi_cash_price("PDX", "BOI", "2026-10-13", "economy", 1, None)
    assert called.get("yes") is True
    assert result["cash_price"] == 131.0


@pytest.mark.asyncio
async def test_sampler_requests_cache_first(monkeypatch):
    import app.services.cash_sampler as cs
    captured = {}

    async def _fake(*a, **k):  # noqa: ANN001
        captured.update(k)
        return {"cash_price": 100}

    monkeypatch.setattr(cs, "get_cash_price", _fake)
    out = await cs.sample_cash_prices_by_date("PDX", "BOI", ["2026-10-13"], "economy", 1)
    assert out == {"2026-10-13": 100}
    assert captured["cache_first"] is True


@pytest.mark.asyncio
async def test_google_flights_url_surfaces_from_search_metadata(monkeypatch):
    """The pay_cash booking card links to SerpAPI's canonical URL for the
    exact search — it must ride the provider result (and thus the cache)."""
    async def _live(params):  # noqa: ANN001
        return {
            "search_metadata": {"google_flights_url": "https://www.google.com/travel/flights?tfs=CANON"},
            "best_flights": [], "other_flights": [],
            "price_insights": {"lowest_price": 500},
        }

    monkeypatch.setenv("SERPAPI_KEY", "test-key")
    monkeypatch.setattr(sp, "_serpapi_get_with_retry", _live)
    result = await sp.get_serpapi_cash_price("SEA", "NRT", "2027-03-15", "economy", 1, "2027-03-30")
    assert result["google_flights_url"] == "https://www.google.com/travel/flights?tfs=CANON"
