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
