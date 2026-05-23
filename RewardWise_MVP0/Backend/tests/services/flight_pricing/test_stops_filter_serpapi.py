"""SerpAPI stops-filter request-param contract (86ba2ze4g).

Locks the STOPS_MAP {any→omit, nonstop→1, one_or_fewer→2, two_or_fewer→3} per
SerpAPI google_flights docs. Live probe deferred per Path B; the validator enum
at app.api.validators.MaxStops constrains input to these four strings so any
doc-vs-reality drift will surface only on real user usage of a documented value.
"""

import asyncio
from typing import Optional

import pytest

from app.services.flight_pricing import serpapi_provider


class _CapturedRequest:
    def __init__(self):
        self.params: Optional[dict] = None


class FakeResponse:
    def __init__(self):
        self._json = {"best_flights": [], "other_flights": []}

    def raise_for_status(self):
        return None

    def json(self):
        return self._json


def _install_fake_client(monkeypatch, captured: _CapturedRequest):
    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url: str, params=None, timeout=None):
            captured.params = params
            return FakeResponse()

    monkeypatch.setattr(serpapi_provider.httpx, "AsyncClient", FakeClient)


@pytest.fixture(autouse=True)
def _serpapi_key(monkeypatch):
    monkeypatch.setenv("SERPAPI_KEY", "test-key")


def _call(max_stops: str):
    captured = _CapturedRequest()
    return captured


def test_serpapi_nonstop_sends_stops_1(monkeypatch):
    captured = _CapturedRequest()
    _install_fake_client(monkeypatch, captured)
    asyncio.run(serpapi_provider.get_serpapi_cash_price(
        "SFO", "JFK", "2026-09-15", "economy", max_stops="nonstop",
    ))
    assert captured.params is not None
    assert captured.params.get("stops") == 1


def test_serpapi_one_or_fewer_sends_stops_2(monkeypatch):
    captured = _CapturedRequest()
    _install_fake_client(monkeypatch, captured)
    asyncio.run(serpapi_provider.get_serpapi_cash_price(
        "SFO", "JFK", "2026-09-15", "economy", max_stops="one_or_fewer",
    ))
    assert captured.params.get("stops") == 2


def test_serpapi_two_or_fewer_sends_stops_3(monkeypatch):
    captured = _CapturedRequest()
    _install_fake_client(monkeypatch, captured)
    asyncio.run(serpapi_provider.get_serpapi_cash_price(
        "SFO", "JFK", "2026-09-15", "economy", max_stops="two_or_fewer",
    ))
    assert captured.params.get("stops") == 3


def test_serpapi_any_omits_stops_key(monkeypatch):
    """Regression guard: 'any' must not send the stops param at all."""
    captured = _CapturedRequest()
    _install_fake_client(monkeypatch, captured)
    asyncio.run(serpapi_provider.get_serpapi_cash_price(
        "SFO", "JFK", "2026-09-15", "economy", max_stops="any",
    ))
    assert captured.params is not None
    assert "stops" not in captured.params


def test_serpapi_default_max_stops_omits_stops_key(monkeypatch):
    """Default kwarg is 'any'; signature-level regression guard."""
    captured = _CapturedRequest()
    _install_fake_client(monkeypatch, captured)
    asyncio.run(serpapi_provider.get_serpapi_cash_price(
        "SFO", "JFK", "2026-09-15", "economy",
    ))
    assert "stops" not in captured.params


def test_serpapi_stops_map_is_locked_to_docs_values():
    """Docs-cited contract; do not edit without surfacing the change in PR body."""
    assert serpapi_provider.STOPS_MAP == {
        "any": None,
        "nonstop": 1,
        "one_or_fewer": 2,
        "two_or_fewer": 3,
    }
