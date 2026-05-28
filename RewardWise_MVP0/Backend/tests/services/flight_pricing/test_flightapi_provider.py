"""FlightAPI provider — CABIN_CLASS_MAP contract (PR-β1.5).

Same class of regression as PR #22 / PR #153 on the seats.aero side: the
provider had a translation map whose values diverged from what the
upstream API actually accepts, and the bug shipped silently for cabins
that 400 instead of 200. Empirical probe (PR-β1, 2026-05-28) proved
FlightAPI accepts lowercase snake_case (`economy`, `premium_economy`,
`business`, `first`) and returns 400 for the title-case-with-space
variants that the old map sent. Only `Economy` was tolerated, which is
why Economy cash data has flowed in prod and PE / Business / First have
not.

The tests below lock the translation as a contract on the outbound URL,
not on the in-memory map alone. They mock httpx so any future map edit
that re-introduces title-case (or any other non-snake_case form) fails
in CI before reaching FlightAPI.
"""

import asyncio
from typing import Optional
from urllib.parse import unquote

import pytest

from app.api.validators import CabinClass
from app.services.flight_pricing import flightapi_provider
from app.services.flight_pricing.flightapi_provider import CABIN_CLASS_MAP


# ---------- Fake HTTP layer (mirrors test_seats_service.py shape) ----------

class FakeResponse:
    def __init__(self, status_code: int = 200, json_data: Optional[dict] = None):
        self.status_code = status_code
        self._json = json_data or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._json


def install_capturing_client(monkeypatch, status: int = 200, body: Optional[dict] = None):
    """Patch httpx.AsyncClient to capture the full request URL.

    Returns a dict that will hold `url` after get_flightapi_cash_price runs.
    """
    captured: dict = {}

    class CapturingClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url: str, **kwargs):
            captured["url"] = url
            return FakeResponse(status, body or {"itineraries": []})

    monkeypatch.setattr(flightapi_provider.httpx, "AsyncClient", CapturingClient)
    monkeypatch.setenv("FLIGHTAPI_KEY", "test-key-12345")
    return captured


# ---------- Contract: outbound cabin_class param ----------
#
# For every CabinClass enum value, the cabin_class slot of the FlightAPI
# URL path must exactly match the verified-accepted lowercase snake_case
# literal. URL-encoding round-trips through unquote so the assertion
# reads the decoded value (FlightAPI's `Premium Economy` would arrive as
# `Premium%20Economy` and silently 400).

@pytest.mark.parametrize("cabin_enum_value,expected_url_segment", [
    ("economy", "economy"),
    ("premium_economy", "premium_economy"),
    ("business", "business"),
    ("first", "first"),
])
def test_outbound_cabin_class_matches_verified_flightapi_value(
    monkeypatch, cabin_enum_value, expected_url_segment,
):
    captured = install_capturing_client(monkeypatch)
    asyncio.run(flightapi_provider.get_flightapi_cash_price(
        origin="JFK",
        destination="LHR",
        date="2026-07-27",
        cabin=cabin_enum_value,
        travelers=1,
    ))
    # FlightAPI URL schema (one-way):
    #   /onewaytrip/{key}/{origin}/{dest}/{date}/{adults}/{children}/{infants}/{cabin}/{currency}
    # cabin is at index -2 from the end (currency is last).
    url = captured["url"]
    assert url.startswith("https://api.flightapi.io/onewaytrip/"), url
    segments = url.split("/")
    cabin_segment = unquote(segments[-2])
    assert cabin_segment == expected_url_segment, (
        f"Cabin {cabin_enum_value!r} sent to FlightAPI as "
        f"{cabin_segment!r}, expected {expected_url_segment!r}. "
        "FlightAPI returns 400 for any non-snake_case value (PR-β1 probe)."
    )


def test_outbound_cabin_class_uses_snake_case_on_roundtrip(monkeypatch):
    """Round-trip URL inserts return_date and switches the prefix to
    /roundtrip/. The cabin slot remains at index -2 because currency
    stays last; the contract holds across both endpoints."""
    captured = install_capturing_client(monkeypatch)
    asyncio.run(flightapi_provider.get_flightapi_cash_price(
        origin="SFO",
        destination="SIN",
        date="2026-09-25",
        return_date="2026-10-09",
        cabin="premium_economy",
        travelers=3,
    ))
    url = captured["url"]
    assert url.startswith("https://api.flightapi.io/roundtrip/"), url
    segments = url.split("/")
    assert unquote(segments[-2]) == "premium_economy"


def test_unknown_cabin_falls_back_to_economy_not_garbage(monkeypatch):
    """Defense in depth: validators reject bad cabins upstream, but if
    anything bypasses them, the map default is `economy` (known good)
    rather than the unmodified input string (would 400). Falling back to
    a snake_case value beats a clean 400 because the user still gets
    cash data; a clean error path is the smoke spec's job."""
    captured = install_capturing_client(monkeypatch)
    asyncio.run(flightapi_provider.get_flightapi_cash_price(
        origin="JFK",
        destination="LHR",
        date="2026-07-27",
        cabin="luxury_suite",
        travelers=1,
    ))
    segments = captured["url"].split("/")
    assert unquote(segments[-2]) == "economy"


def test_cabin_class_map_keys_match_validators_enum_exactly():
    """CABIN_CLASS_MAP keys must exactly match CabinClass enum values.
    Adding a cabin to the enum without adding a mapping here would hit
    the `economy` fallback at request time — a silent demotion. Lock
    parity at import time so the omission fails CI instead of UX."""
    assert set(CABIN_CLASS_MAP.keys()) == {c.value for c in CabinClass}


def test_cabin_class_map_values_are_all_lowercase_snake_case():
    """Lock the map's value shape so a future edit reintroducing
    title-case (e.g., a copy-paste from FlightAPI marketing docs) fails
    here before it ships. Equivalent to the URL-construction test but
    runs at import time and catches the map even if the URL builder
    changes."""
    for cabin, value in CABIN_CLASS_MAP.items():
        assert value == value.lower(), f"{cabin!r} -> {value!r} is not lowercase"
        assert " " not in value, f"{cabin!r} -> {value!r} contains a space"
