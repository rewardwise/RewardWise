"""Tests for seats_service fan-out, sort, and cache (gate 4a-tests, ticket 86b9xh2v3).

Covers the /trips/{id} hydration path added in commits 54f7ebe and ceb83ed:
- search_award_availability splits AvailabilityTrips into trip_candidates vs trips_detail
- top _TRIP_DETAIL_FANOUT_LIMIT awards get hydrated via asyncio.gather
- per-award candidate selection sorts by (stops, total_duration) with sentinels
- _fetch_trip_detail_cached short-circuits on cache hit, swallows errors / timeouts
- _trip_candidates is stripped before return so it never reaches API consumers

Patterns mirror test_verdict_service.py: sync test bodies, asyncio.run for async,
plain pytest, no pytest-asyncio. Network is mocked by monkeypatching
seats_service.httpx.AsyncClient.
"""

import asyncio
import json
import logging
from typing import Optional

import httpx
import pytest

from app.services import seats_service


# ---------- Fake HTTP layer ----------------------------------------------------

class FakeResponse:
    def __init__(self, status_code: int = 200, json_data: Optional[dict] = None):
        self.status_code = status_code
        self._json = json_data or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._json


def install_fakes(
    monkeypatch,
    search_data: dict,
    trip_responses: dict,
    *,
    trip_delays: Optional[dict] = None,
):
    """Replace httpx.AsyncClient with a fake that switches on URL path.

    trip_responses maps trip_id -> dict (full /trips JSON body) or the literal
    string "404" / "429" to simulate non-200 statuses. Returns a call_log list
    capturing every trip_id fetched, in arrival order.
    """
    trip_delays = trip_delays or {}
    call_log: list = []

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url: str, **kwargs):
            if "/search" in url:
                return FakeResponse(200, search_data)
            tid = url.rsplit("/", 1)[-1]
            call_log.append(tid)
            if tid in trip_delays:
                await asyncio.sleep(trip_delays[tid])
            resp = trip_responses.get(tid)
            if resp == "404":
                return FakeResponse(404, {})
            if resp == "429":
                return FakeResponse(429, {})
            return FakeResponse(200, resp or {"data": []})

    monkeypatch.setattr(seats_service.httpx, "AsyncClient", FakeClient)
    return call_log


# ---------- Fixture builders ---------------------------------------------------

def trip_obj(
    tid: str,
    *,
    total_duration: Optional[int] = 600,
    stops: Optional[int] = 0,
    with_segments: bool = False,
) -> dict:
    obj: dict = {"ID": tid, "TotalDuration": total_duration, "Stops": stops}
    if with_segments:
        obj["AvailabilitySegments"] = [{
            "FlightNumber": "UA1",
            "AircraftName": "Boeing 777",
            "OriginAirport": "SFO",
            "DestinationAirport": "NRT",
            "DepartsAt": "2026-09-15T10:00:00",
            "ArrivesAt": "2026-09-16T14:00:00",
            "FareClass": "Y",
            "Cabin": "Economy",
            "Distance": 5100,
            "Order": 0,
        }]
    return obj


def award_envelope(
    *,
    source: str = "united",
    points: int = 60000,
    trips: Optional[list] = None,
) -> dict:
    """One entry in the seats.aero /search data list."""
    return {
        "Source": source,
        "YAvailable": True,
        "YMileageCost": points,
        "YTotalTaxes": 5000,
        "YRemainingSeats": 4,
        "YDirect": False,
        "YAirlines": "UA",
        "AvailabilityTrips": json.dumps(trips or []),
        "Date": "2026-09-15",
        "Route": {"OriginAirport": "SFO", "DestinationAirport": "NRT", "ID": "SFO-NRT"},
    }


def build_search_response(awards: list) -> dict:
    return {"data": awards}


def trips_detail_response(trip_id: str) -> dict:
    """Shape returned by GET /trips/{id} when hydrating segments."""
    return {"data": [{
        "ID": trip_id,
        "TotalDuration": 700,
        "Stops": 0,
        "FlightNumbers": "UA1",
        "DepartsAt": "2026-09-15T10:00:00",
        "ArrivesAt": "2026-09-16T14:00:00",
        "MileageCost": 60000,
        "TotalTaxes": 5000,
        "TaxesCurrency": "USD",
        "AvailabilitySegments": [{
            "FlightNumber": "UA1",
            "AircraftName": "Boeing 777",
            "AircraftCode": "777",
            "OriginAirport": "SFO",
            "DestinationAirport": "NRT",
            "DepartsAt": "2026-09-15T10:00:00",
            "ArrivesAt": "2026-09-16T14:00:00",
            "FareClass": "Y",
            "Cabin": "Economy",
            "Distance": 5100,
        }],
    }]}


def run_search():
    return asyncio.run(seats_service.search_award_availability(
        "SFO", "NRT", "2026-09-15", "economy",
    ))


# ---------- Fixture: isolate cache + env --------------------------------------

@pytest.fixture(autouse=True)
def _reset_seats_state(monkeypatch):
    seats_service._TRIP_DETAIL_CACHE.clear()
    monkeypatch.setenv("SEATS_AERO_API_KEY", "test-key")
    yield
    seats_service._TRIP_DETAIL_CACHE.clear()


# ---------- Tests --------------------------------------------------------------

def test_no_fanout_when_inline_segments_present(monkeypatch):
    """Inline AvailabilitySegments → trips populated from parse, /trips never hit."""
    search = build_search_response([award_envelope(
        trips=[trip_obj("inline-1", with_segments=True)]
    )])
    log = install_fakes(monkeypatch, search, {})
    results = run_search()
    assert len(results) == 1
    assert len(results[0]["trips"]) == 1
    assert results[0]["trips"][0]["id"] == "inline-1"
    assert log == []


def test_fanout_hydrates_empty_trips_for_top_3(monkeypatch):
    """Empty-segments award gets hydrated via /trips fan-out."""
    search = build_search_response([award_envelope(
        trips=[trip_obj("t1", total_duration=600, stops=0)]
    )])
    log = install_fakes(monkeypatch, search, {"t1": trips_detail_response("t1")})
    results = run_search()
    assert log == ["t1"]
    assert len(results[0]["trips"]) == 1
    segs = results[0]["trips"][0]["segments"]
    assert segs and segs[0]["origin"] == "SFO"


def test_fanout_capped_at_3_awards(monkeypatch):
    """Five awards needing hydration → exactly 3 /trips calls."""
    awards_in = [
        award_envelope(source=f"src{i}", points=60000 + i, trips=[trip_obj(f"t{i}")])
        for i in range(5)
    ]
    search = build_search_response(awards_in)
    trip_resps = {f"t{i}": trips_detail_response(f"t{i}") for i in range(5)}
    log = install_fakes(monkeypatch, search, trip_resps)
    run_search()
    assert len(log) == 3
    # asyncio.gather runs concurrently; arrival order is non-deterministic.
    assert set(log) == {"t0", "t1", "t2"}


def test_sort_prefers_nonstop_over_one_stop(monkeypatch):
    """stops=0 wins over stops=1 even when listed second."""
    search = build_search_response([award_envelope(trips=[
        trip_obj("one-stop", total_duration=300, stops=1),
        trip_obj("nonstop", total_duration=500, stops=0),
    ])])
    log = install_fakes(monkeypatch, search, {
        "nonstop": trips_detail_response("nonstop"),
        "one-stop": trips_detail_response("one-stop"),
    })
    run_search()
    assert log == ["nonstop"]


def test_sort_tiebreak_shorter_duration_wins(monkeypatch):
    """Equal stops → shorter total_duration wins."""
    search = build_search_response([award_envelope(trips=[
        trip_obj("longer", total_duration=900, stops=0),
        trip_obj("shorter", total_duration=400, stops=0),
    ])])
    log = install_fakes(monkeypatch, search, {
        "longer": trips_detail_response("longer"),
        "shorter": trips_detail_response("shorter"),
    })
    run_search()
    assert log == ["shorter"]


def test_sort_sentinel_none_stops_sorts_last(monkeypatch):
    """stops=None loses to stops=1 (sentinel 999 > 1)."""
    search = build_search_response([award_envelope(trips=[
        {"ID": "missing", "TotalDuration": 300, "Stops": None},
        trip_obj("real", total_duration=900, stops=1),
    ])])
    log = install_fakes(monkeypatch, search, {
        "missing": trips_detail_response("missing"),
        "real": trips_detail_response("real"),
    })
    run_search()
    assert log == ["real"]


def test_sort_sentinel_none_duration_sorts_last(monkeypatch):
    """Equal stops; duration=None loses to a real duration (sentinel 99999 > 900)."""
    search = build_search_response([award_envelope(trips=[
        {"ID": "missing", "TotalDuration": None, "Stops": 0},
        trip_obj("real", total_duration=900, stops=0),
    ])])
    log = install_fakes(monkeypatch, search, {
        "missing": trips_detail_response("missing"),
        "real": trips_detail_response("real"),
    })
    run_search()
    assert log == ["real"]


def test_sort_both_sentinels_secondary_wins(monkeypatch):
    """Both stops=None → tiebreaker total_duration; real value beats None."""
    search = build_search_response([award_envelope(trips=[
        {"ID": "both-none", "TotalDuration": None, "Stops": None},
        {"ID": "dur-real", "TotalDuration": 500, "Stops": None},
    ])])
    log = install_fakes(monkeypatch, search, {
        "both-none": trips_detail_response("both-none"),
        "dur-real": trips_detail_response("dur-real"),
    })
    run_search()
    assert log == ["dur-real"]


def test_fanout_handles_404_gracefully(monkeypatch):
    """404 from /trips is swallowed; award.trips stays empty, no exception leaks."""
    search = build_search_response([award_envelope(trips=[trip_obj("t1")])])
    log = install_fakes(monkeypatch, search, {"t1": "404"})
    results = run_search()
    assert log == ["t1"]
    assert results[0]["trips"] == []


def test_fanout_handles_429_rate_limit_gracefully(monkeypatch):
    """429 from /trips is swallowed; award.trips stays empty, no exception leaks."""
    search = build_search_response([award_envelope(trips=[trip_obj("t1")])])
    log = install_fakes(monkeypatch, search, {"t1": "429"})
    results = run_search()
    assert log == ["t1"]
    assert results[0]["trips"] == []


def test_fanout_handles_timeout_gracefully(monkeypatch):
    """Delay > _TRIP_DETAIL_TIMEOUT_S → asyncio.wait_for raises; result dropped."""
    monkeypatch.setattr(seats_service, "_TRIP_DETAIL_TIMEOUT_S", 0.05)
    search = build_search_response([award_envelope(trips=[trip_obj("slow")])])
    install_fakes(
        monkeypatch, search,
        {"slow": trips_detail_response("slow")},
        trip_delays={"slow": 0.2},
    )
    results = run_search()
    assert results[0]["trips"] == []


def test_fanout_cache_hit_avoids_refetch(monkeypatch):
    """Second search with the same trip_id hits the cache; no second /trips call."""
    search = build_search_response([award_envelope(trips=[trip_obj("t1")])])
    log = install_fakes(monkeypatch, search, {"t1": trips_detail_response("t1")})
    run_search()
    run_search()
    assert log == ["t1"]


def test_cache_miss_different_trip_id_refetches(monkeypatch):
    """Cache is keyed by trip_id: asking for tb after caching ta still fetches tb."""
    search1 = build_search_response([award_envelope(trips=[trip_obj("ta")])])
    log = install_fakes(monkeypatch, search1, {
        "ta": trips_detail_response("ta"),
        "tb": trips_detail_response("tb"),
    })
    run_search()
    assert log == ["ta"]

    search2 = build_search_response([award_envelope(trips=[trip_obj("tb")])])
    log2 = install_fakes(monkeypatch, search2, {
        "ta": trips_detail_response("ta"),
        "tb": trips_detail_response("tb"),
    })
    run_search()
    assert log2 == ["tb"]


def test_internal_trip_candidates_stripped_from_response(monkeypatch):
    """No result row carries _trip_candidates — internal field is stripped."""
    search = build_search_response([
        award_envelope(source="united", trips=[trip_obj("t1", with_segments=True)]),
        award_envelope(source="aeroplan", trips=[trip_obj("t2", with_segments=False)]),
    ])
    install_fakes(monkeypatch, search, {"t2": trips_detail_response("t2")})
    results = run_search()
    assert len(results) == 2
    for r in results:
        assert "_trip_candidates" not in r


# ---------- CABIN_MAP premium_economy coverage (86ba25eq0) --------------------

def test_cabin_map_premium_economy_is_W():
    assert seats_service.CABIN_MAP["premium_economy"] == "W"


def test_cabin_map_covers_all_four_cabins():
    assert seats_service.CABIN_MAP == {
        "economy": "Y",
        "premium_economy": "W",
        "business": "J",
        "first": "F",
    }


# ---------- Outbound cabin param translation (PR #22 fix) --------------------
#
# Contract: asserts that for every CabinClass enum value, the outbound
# `cabins=` query string seats.aero receives matches the verified-accepted
# literal string per CABIN_API_PARAM. This is a translation contract — NOT
# a server-behavior assertion. Server-side filtering of result rows is
# seats.aero's responsibility and is independently verified strict (probe
# run 2026-05-27: returned-row count == {prefix}Available count, all 4
# cabins). If a future enum rename ships without updating CABIN_API_PARAM,
# this test fails before it hits prod — same regression as PR #22.

@pytest.mark.parametrize("cabin_enum_value,expected_api_param", [
    ("economy", "economy"),
    ("premium_economy", "premium"),
    ("business", "business"),
    ("first", "first"),
])
def test_outbound_cabins_param_matches_verified_seats_aero_value(
    monkeypatch, cabin_enum_value, expected_api_param,
):
    captured: dict = {}

    class CapturingClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url, **kwargs):
            captured["params"] = kwargs.get("params")
            return FakeResponse(200, {"data": []})

    monkeypatch.setattr(seats_service.httpx, "AsyncClient", CapturingClient)
    asyncio.run(seats_service.search_award_availability(
        "SFO", "NRT", "2026-09-15", cabin_enum_value,
    ))
    assert captured["params"]["cabins"] == expected_api_param


def test_unsupported_cabin_raises_value_error():
    """Defense in depth: validators reject bad cabins upstream, but the
    service still guards in case anyone calls it directly with a bogus
    string."""
    with pytest.raises(ValueError, match="Unsupported cabin"):
        asyncio.run(seats_service.search_award_availability(
            "SFO", "NRT", "2026-09-15", "luxury",
        ))


def test_cabin_api_param_covers_all_cabin_class_values():
    """CABIN_API_PARAM keys must exactly match CabinClass enum values.
    Adding a cabin to the enum without adding the translation here would
    cause an unsupported-cabin ValueError at request time — louder than
    the silent PR #22 regression but still a runtime fail. Lock parity
    at import time instead."""
    from app.api.validators import CabinClass

    assert set(seats_service.CABIN_API_PARAM.keys()) == {c.value for c in CabinClass}


# ---------- Defensive catch on upstream failures (PR #22 follow-up) ----------
#
# When seats.aero returns 4xx / 5xx, times out, or has any transport error,
# the service degrades to "no awards" so the verdict layer falls back to
# data_quality="missing_awards" + cash price. Without this catch, a single
# upstream failure 500'd the entire search endpoint (the exact PR #22
# symptom on every PE search).

def _failing_client_factory(response_or_exc):
    """Build an httpx.AsyncClient mock that returns the given response, or
    raises the given exception on .get()."""
    class _Client:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url, **kwargs):
            if isinstance(response_or_exc, Exception):
                raise response_or_exc
            return response_or_exc

    return _Client


def test_defensive_catch_on_400_returns_empty_list(monkeypatch):
    """seats.aero 400 → []. This is the exact PR #22 PE-search scenario."""
    request = httpx.Request("GET", "https://seats.aero/partnerapi/search")
    response = httpx.Response(
        400, request=request,
        content=b'{"error":true,"message":"one or more cabins are invalid","code":"invalid_cabin"}',
    )
    monkeypatch.setattr(
        seats_service.httpx, "AsyncClient", _failing_client_factory(response),
    )
    results = asyncio.run(seats_service.search_award_availability(
        "SFO", "NRT", "2026-09-15", "economy",
    ))
    assert results == []


def test_defensive_catch_on_500_returns_empty_list(monkeypatch):
    """seats.aero 5xx outage → []."""
    request = httpx.Request("GET", "https://seats.aero/partnerapi/search")
    response = httpx.Response(503, request=request, content=b"")
    monkeypatch.setattr(
        seats_service.httpx, "AsyncClient", _failing_client_factory(response),
    )
    results = asyncio.run(seats_service.search_award_availability(
        "SFO", "NRT", "2026-09-15", "economy",
    ))
    assert results == []


def test_defensive_catch_on_timeout_returns_empty_list(monkeypatch):
    """httpx.ConnectTimeout (RequestError subclass) → []."""
    request = httpx.Request("GET", "https://seats.aero/partnerapi/search")
    monkeypatch.setattr(
        seats_service.httpx, "AsyncClient",
        _failing_client_factory(httpx.ConnectTimeout("timed out", request=request)),
    )
    results = asyncio.run(seats_service.search_award_availability(
        "SFO", "NRT", "2026-09-15", "economy",
    ))
    assert results == []


def test_defensive_catch_on_malformed_json_returns_empty_list(monkeypatch):
    """200 with non-JSON body → json.JSONDecodeError → []. Covers the case
    where seats.aero responds with HTML/empty body but a 200 status."""
    request = httpx.Request("GET", "https://seats.aero/partnerapi/search")
    response = httpx.Response(200, request=request, content=b"<html>oops</html>")
    monkeypatch.setattr(
        seats_service.httpx, "AsyncClient", _failing_client_factory(response),
    )
    results = asyncio.run(seats_service.search_award_availability(
        "SFO", "NRT", "2026-09-15", "economy",
    ))
    assert results == []


def test_defensive_catch_logs_warning(monkeypatch, caplog):
    """Failures get logged at WARN so ops can pattern-spot upstream issues."""
    request = httpx.Request("GET", "https://seats.aero/partnerapi/search")
    response = httpx.Response(400, request=request, content=b'{"err":1}')
    monkeypatch.setattr(
        seats_service.httpx, "AsyncClient", _failing_client_factory(response),
    )
    with caplog.at_level(logging.WARNING, logger="app.services.seats_service"):
        asyncio.run(seats_service.search_award_availability(
            "SFO", "NRT", "2026-09-15", "economy",
        ))
    assert any(
        "seats.aero search failed" in record.message for record in caplog.records
    )

