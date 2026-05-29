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


# ---------- PR-δ: metro fan-out helper ----------
#
# get_flightapi_cash_for_metro must dispatch one upstream call per
# (origin, destination) pair, respect the hard cap, skip same-airport
# pairs, aggregate cash_price = min across successes, and return a
# response shape that is byte-compatible with the single-airport path
# so the verdict surface does not need to know fan-out happened.
#
# These tests use the same CapturingClient pattern as the cabin-map
# contract tests above, but capture every URL the helper builds (the
# previous tests only checked the first/only URL). Per-call response
# bodies and statuses are programmable per call number so a single
# test can express "1 ok, 2 fail" patterns.


def install_per_call_client(monkeypatch, call_outcomes):
    """Patch httpx.AsyncClient so each invocation returns the next
    `(status, body)` in `call_outcomes`. Captures every URL into the
    returned dict's "urls" list and total call count into "count"."""
    state: dict = {"urls": [], "count": 0}

    class PerCallClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url: str, **kwargs):
            idx = state["count"]
            state["count"] += 1
            state["urls"].append(url)
            status, body = call_outcomes[idx % len(call_outcomes)]
            return FakeResponse(status, body)

    monkeypatch.setattr(flightapi_provider.httpx, "AsyncClient", PerCallClient)
    monkeypatch.setenv("FLIGHTAPI_KEY", "test-key-12345")
    return state


def _priced_body(price: float, dep_iata: str = "JFK", arr_iata: str = "LHR"):
    """Minimal FlightAPI body the normalizer treats as one priced itinerary.
    Uses placeMap + carrierMap + legMap + segmentMap so departure_iata /
    arrival_iata / price flow through the dedupe key."""
    return {
        "itineraries": [
            {
                "id": f"itin-{dep_iata}-{arr_iata}-{int(price)}",
                "legIds": [f"leg-{dep_iata}-{arr_iata}"],
                "pricingOptions": [
                    {
                        "id": "po-1",
                        "price": {"amount": price},
                        "items": [{"agentIds": ["agent-1"], "url": "https://example.test/book"}],
                    }
                ],
            }
        ],
        "places": {
            dep_iata: {"id": dep_iata, "iata": dep_iata, "name": dep_iata},
            arr_iata: {"id": arr_iata, "iata": arr_iata, "name": arr_iata},
        },
        "carriers": {"AA": {"id": "AA", "iata": "AA", "name": "Test Air"}},
        "legs": {
            f"leg-{dep_iata}-{arr_iata}": {
                "id": f"leg-{dep_iata}-{arr_iata}",
                "segmentIds": [f"seg-{dep_iata}-{arr_iata}"],
                "departure": "2026-07-27T08:00",
                "arrival": "2026-07-27T20:00",
                "duration": 600,
                "stopCount": 0,
            }
        },
        "segments": {
            f"seg-{dep_iata}-{arr_iata}": {
                "id": f"seg-{dep_iata}-{arr_iata}",
                "origin": dep_iata,
                "destination": arr_iata,
                "departure": "2026-07-27T08:00",
                "arrival": "2026-07-27T20:00",
                "marketingCarrierId": "AA",
                "flightNumber": "100",
            }
        },
        "agents": {"agent-1": {"id": "agent-1", "name": "TestAgent"}},
    }


def _empty_body():
    return {"itineraries": []}


def _extract_route_from_url(url: str) -> tuple[str, str]:
    """Pull (origin, destination) airport codes out of a FlightAPI URL.
    Schema: https://host/{endpoint}/{key}/{origin}/{dest}/{date}/.../{currency}.
    After url.split("/"): [https:, '', host, endpoint, key, origin, dest, ...]
    so origin = segment[5], destination = segment[6]."""
    segments = url.split("/")
    return unquote(segments[5]), unquote(segments[6])


def test_metro_single_airport_each_side_dispatches_exactly_one_call(monkeypatch):
    """Single→single must NOT fan out from the metro helper either.
    Calling the helper directly with single airports should still emit
    exactly one upstream call (the inner get_flightapi_cash_price)."""
    state = install_per_call_client(monkeypatch, [(200, _priced_body(500.0))])
    result = asyncio.run(flightapi_provider.get_flightapi_cash_for_metro(
        origin="JFK", destination="LHR", date="2026-07-27", cabin="economy",
    ))
    assert state["count"] == 1, f"expected 1 upstream call, got {state['count']}"
    assert result["cash_price"] == 500.0
    assert result["_meta"]["pairs_attempted"] == 1
    assert result["_meta"]["pairs_succeeded"] == 1


@pytest.mark.parametrize("origin,destination,expected_calls,expected_routes", [
    ("JFK,LGA,EWR", "LHR", 3, {("JFK", "LHR"), ("LGA", "LHR"), ("EWR", "LHR")}),
    ("SFO", "NRT,HND", 2, {("SFO", "NRT"), ("SFO", "HND")}),
    ("SFO,OAK", "NRT,HND", 4, {("SFO", "NRT"), ("SFO", "HND"), ("OAK", "NRT"), ("OAK", "HND")}),
])
def test_metro_fanout_dispatches_one_call_per_pair(
    monkeypatch, origin, destination, expected_calls, expected_routes,
):
    """multi-airport-origin, multi-airport-dest, and both-multi each
    expand to the full N×M cross-product."""
    state = install_per_call_client(monkeypatch, [(200, _priced_body(500.0))])
    asyncio.run(flightapi_provider.get_flightapi_cash_for_metro(
        origin=origin, destination=destination, date="2026-07-27", cabin="economy",
    ))
    assert state["count"] == expected_calls
    actual_routes = {_extract_route_from_url(u) for u in state["urls"]}
    assert actual_routes == expected_routes


@pytest.mark.parametrize("cabin", ["economy", "premium_economy", "business", "first"])
@pytest.mark.parametrize("return_date", [None, "2026-08-10"])
def test_metro_fanout_preserves_cabin_and_endpoint_per_pair(
    monkeypatch, cabin, return_date,
):
    """PR-β1.5 contract must hold on every fanned-out pair: lowercase
    snake_case cabin in the URL, /onewaytrip/ vs /roundtrip/ chosen
    correctly by return_date presence."""
    state = install_per_call_client(monkeypatch, [(200, _priced_body(500.0))])
    asyncio.run(flightapi_provider.get_flightapi_cash_for_metro(
        origin="SFO,OAK", destination="NRT", date="2026-07-27",
        cabin=cabin, return_date=return_date,
    ))
    expected_prefix = "https://api.flightapi.io/roundtrip/" if return_date else "https://api.flightapi.io/onewaytrip/"
    for url in state["urls"]:
        assert url.startswith(expected_prefix), url
        segments = url.split("/")
        # Cabin slot is at index -2 (currency is last) on both endpoints.
        assert unquote(segments[-2]) == cabin


def test_metro_fanout_respects_semaphore_max_4_concurrent(monkeypatch):
    """Wrap fetch_pair to count concurrent in-flight calls. With
    Semaphore(4) and 12 pairs, peak in-flight must never exceed 4."""
    in_flight = {"current": 0, "peak": 0}
    monkeypatch.setenv("FLIGHTAPI_KEY", "test-key-12345")

    class TrackingClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url: str, **kwargs):
            in_flight["current"] += 1
            in_flight["peak"] = max(in_flight["peak"], in_flight["current"])
            # Yield to the scheduler so other coroutines have a chance to
            # increment in_flight["current"] before this one decrements.
            await asyncio.sleep(0.01)
            in_flight["current"] -= 1
            return FakeResponse(200, _priced_body(500.0))

    monkeypatch.setattr(flightapi_provider.httpx, "AsyncClient", TrackingClient)
    asyncio.run(flightapi_provider.get_flightapi_cash_for_metro(
        origin="A,B,C,D", destination="E,F,G",
        date="2026-07-27", cabin="economy",
    ))
    assert in_flight["peak"] <= 4, f"peak concurrent {in_flight['peak']} exceeded Semaphore(4)"


def test_metro_fanout_cash_price_is_min_across_successes(monkeypatch):
    """3 successful pairs at $300/$500/$400 → aggregated cash_price=$300."""
    state = install_per_call_client(monkeypatch, [
        (200, _priced_body(300.0, dep_iata="JFK")),
        (200, _priced_body(500.0, dep_iata="LGA")),
        (200, _priced_body(400.0, dep_iata="EWR")),
    ])
    result = asyncio.run(flightapi_provider.get_flightapi_cash_for_metro(
        origin="JFK,LGA,EWR", destination="LHR",
        date="2026-07-27", cabin="economy",
    ))
    assert state["count"] == 3
    assert result["cash_price"] == 300.0
    assert result["_meta"]["pairs_succeeded"] == 3
    prices = [f["price"] for f in result["flights"]]
    assert prices == sorted(prices), "merged flights must be price-sorted asc"


def test_metro_fanout_partial_failure_returns_only_successful_pair(monkeypatch):
    """1 ok ($600), 1 fail (400), 1 fail (404). cash_price = $600,
    flights only contain the ok pair's itineraries, _meta reflects
    1 succeeded out of 3 attempted."""
    state = install_per_call_client(monkeypatch, [
        (200, _priced_body(600.0, dep_iata="JFK")),
        (400, _empty_body()),
        (404, _empty_body()),
    ])
    result = asyncio.run(flightapi_provider.get_flightapi_cash_for_metro(
        origin="JFK,LGA,EWR", destination="LHR",
        date="2026-07-27", cabin="economy",
    ))
    assert state["count"] == 3
    assert result["cash_price"] == 600.0
    assert len(result["flights"]) == 1
    assert result["flights"][0]["departure_iata"] == "JFK"
    assert result["_meta"]["pairs_attempted"] == 3
    assert result["_meta"]["pairs_succeeded"] == 1


def test_metro_fanout_total_failure_returns_none_with_meta(monkeypatch):
    """All 3 pairs 400. cash_price=None, _meta.metro_fanout=True,
    _meta.pairs_succeeded=0. pricing_service then falls through to the
    next provider in the chain; that behavior is integration-level and
    asserted in the routing test below."""
    state = install_per_call_client(monkeypatch, [
        (400, _empty_body()), (400, _empty_body()), (400, _empty_body()),
    ])
    result = asyncio.run(flightapi_provider.get_flightapi_cash_for_metro(
        origin="JFK,LGA,EWR", destination="LHR",
        date="2026-07-27", cabin="economy",
    ))
    assert state["count"] == 3
    assert result["cash_price"] is None
    assert result["_meta"]["metro_fanout"] is True
    assert result["_meta"]["pairs_succeeded"] == 0
    assert result["_meta"]["pairs_attempted"] == 3


def test_metro_fanout_skips_same_airport_pairs(monkeypatch):
    """origin=LAX,JFK + destination=LAX,SFO → LAX×LAX is a zero-mile
    route that wastes a credit. Skip it. Expected pairs:
    (LAX,SFO) + (JFK,LAX) + (JFK,SFO) = 3 calls (not 4)."""
    state = install_per_call_client(monkeypatch, [
        (200, _priced_body(500.0)),
        (200, _priced_body(500.0)),
        (200, _priced_body(500.0)),
    ])
    result = asyncio.run(flightapi_provider.get_flightapi_cash_for_metro(
        origin="LAX,JFK", destination="LAX,SFO",
        date="2026-07-27", cabin="economy",
    ))
    assert state["count"] == 3
    actual_routes = {_extract_route_from_url(u) for u in state["urls"]}
    assert ("LAX", "LAX") not in actual_routes
    assert result["_meta"]["pairs_attempted"] == 3


def test_metro_fanout_whitespace_and_dedupe(monkeypatch):
    """origin="SFO, OAK, SFO " strips whitespace + dedupes to {SFO,OAK}
    BEFORE expansion. With destination=NRT that's 2 unique pairs."""
    state = install_per_call_client(monkeypatch, [
        (200, _priced_body(500.0)), (200, _priced_body(500.0)),
    ])
    asyncio.run(flightapi_provider.get_flightapi_cash_for_metro(
        origin="SFO, OAK, SFO ", destination="NRT",
        date="2026-07-27", cabin="economy",
    ))
    assert state["count"] == 2
    actual_origins = {_extract_route_from_url(u)[0] for u in state["urls"]}
    assert actual_origins == {"SFO", "OAK"}


def test_metro_fanout_hard_cap_at_12_pairs(monkeypatch, caplog):
    """origin=A,B,C,D + destination=E,F,G,H,I → 20 pairs. Cap at 12,
    sort alphabetically, log WARN. Verifies both the cap and the
    deterministic truncation order so any future regression in pair
    ordering surfaces here."""
    state = install_per_call_client(
        monkeypatch, [(200, _priced_body(500.0))],
    )
    with caplog.at_level("WARNING", logger="app.services.flight_pricing.flightapi_provider"):
        asyncio.run(flightapi_provider.get_flightapi_cash_for_metro(
            origin="A,B,C,D", destination="E,F,G,H,I",
            date="2026-07-27", cabin="economy",
        ))
    assert state["count"] == 12
    warnings = [r for r in caplog.records if "metro_pairs_capped" in r.message]
    assert warnings, "expected metro_pairs_capped WARN log"
    assert "requested=20" in warnings[0].message
    assert "cap=12" in warnings[0].message
    # Sorted pairs: (A,E), (A,F), (A,G), (A,H), (A,I), (B,E), (B,F),
    # (B,G), (B,H), (B,I), (C,E), (C,F) — first 12 alphabetically.
    actual_routes = [_extract_route_from_url(u) for u in state["urls"]]
    assert actual_routes[0] == ("A", "E")
    assert actual_routes[-1] == ("C", "F")


def test_metro_fanout_empty_after_sanitization_returns_empty_response(monkeypatch):
    """origin="," resolves to zero airports. Return empty response
    with the standard error string so pricing_service falls through to
    the next provider rather than raising."""
    state = install_per_call_client(monkeypatch, [(200, _priced_body(500.0))])
    result = asyncio.run(flightapi_provider.get_flightapi_cash_for_metro(
        origin=",", destination="LHR", date="2026-07-27", cabin="economy",
    ))
    assert state["count"] == 0
    assert result["cash_price"] is None
    assert "zero airports" in result.get("error", "")


def test_metro_fanout_all_pairs_collapse_to_same_airport(monkeypatch):
    """origin="LAX" + destination="LAX" expands to 1 pair (LAX,LAX),
    which is then dropped as same-airport. Result: zero remaining
    pairs, empty response, no upstream calls."""
    state = install_per_call_client(monkeypatch, [(200, _priced_body(500.0))])
    result = asyncio.run(flightapi_provider.get_flightapi_cash_for_metro(
        origin="LAX", destination="LAX", date="2026-07-27", cabin="economy",
    ))
    assert state["count"] == 0
    assert result["cash_price"] is None


def test_pricing_service_routes_comma_origin_to_metro_helper(monkeypatch):
    """Integration: pricing_service._fetch_from_provider sees a comma
    in origin and routes to get_flightapi_cash_for_metro rather than
    get_flightapi_cash_price. The single-airport function must NOT be
    invoked directly for metro inputs (the regression we're fixing)."""
    from app.services import pricing_service

    metro_calls: list[tuple] = []
    single_calls: list[tuple] = []

    async def fake_metro(origin, destination, date, cabin, travelers, return_date, max_stops="any"):
        metro_calls.append((origin, destination))
        return {"cash_price": 250.0, "currency": "USD", "source": "flightapi", "flights": []}

    async def fake_single(origin, destination, date, cabin, travelers, return_date, max_stops="any"):
        single_calls.append((origin, destination))
        return {"cash_price": 999.0, "currency": "USD", "source": "flightapi", "flights": []}

    monkeypatch.setattr(pricing_service, "get_flightapi_cash_for_metro", fake_metro)
    monkeypatch.setattr(pricing_service, "get_flightapi_cash_price", fake_single)

    result = asyncio.run(pricing_service._fetch_from_provider(
        "flightapi", "SFO,OAK,SJC", "NRT", "2026-07-27", "economy", 1, None,
    ))
    assert metro_calls == [("SFO,OAK,SJC", "NRT")]
    assert single_calls == []
    assert result["cash_price"] == 250.0


def test_pricing_service_single_airport_skips_metro_helper(monkeypatch):
    """Regression guard: a no-comma origin/destination must stay on the
    single-airport fast path. Routing to the metro helper for single
    airports would still work but would log spurious metro_fanout
    aggregate lines and burn a Semaphore slot."""
    from app.services import pricing_service

    metro_calls: list[tuple] = []
    single_calls: list[tuple] = []

    async def fake_metro(origin, destination, date, cabin, travelers, return_date, max_stops="any"):
        metro_calls.append((origin, destination))
        return {"cash_price": 999.0, "currency": "USD", "source": "flightapi", "flights": []}

    async def fake_single(origin, destination, date, cabin, travelers, return_date, max_stops="any"):
        single_calls.append((origin, destination))
        return {"cash_price": 250.0, "currency": "USD", "source": "flightapi", "flights": []}

    monkeypatch.setattr(pricing_service, "get_flightapi_cash_for_metro", fake_metro)
    monkeypatch.setattr(pricing_service, "get_flightapi_cash_price", fake_single)

    result = asyncio.run(pricing_service._fetch_from_provider(
        "flightapi", "JFK", "LHR", "2026-07-27", "economy", 1, None,
    ))
    assert single_calls == [("JFK", "LHR")]
    assert metro_calls == []
    assert result["cash_price"] == 250.0
