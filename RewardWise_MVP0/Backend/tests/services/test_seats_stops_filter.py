"""seats.aero stops-filter contract (86ba2ze4g).

Partner API has no max_stops query param, so the filter runs client-side
against the parsed trips. Drop the entire award only when it had parsed
trips and ALL exceed the cap. 'any' must leave the response untouched
(regression guard). Round-trip semantics are exercised by calling the
function twice (outbound + return direction).
"""

import asyncio
import json
from typing import Optional

import pytest

from app.services import seats_service


class FakeResponse:
    def __init__(self, status_code: int = 200, json_data: Optional[dict] = None):
        self.status_code = status_code
        self._json = json_data or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._json


def _install_search_response(monkeypatch, search_data: dict):
    """Fake AsyncClient that returns the same canned /search payload."""

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
            return FakeResponse(200, {"data": []})

    monkeypatch.setattr(seats_service.httpx, "AsyncClient", FakeClient)


def _award(*, source: str, points: int, trips: list, direct: bool = False) -> dict:
    return {
        "Source": source,
        "YAvailable": True,
        "YMileageCost": points,
        "YTotalTaxes": 5000,
        "YRemainingSeats": 4,
        "YDirect": direct,
        "YAirlines": "UA",
        "AvailabilityTrips": json.dumps(trips),
        "Date": "2026-09-15",
        "Route": {"OriginAirport": "SFO", "DestinationAirport": "NRT", "ID": "SFO-NRT"},
    }


def _trip(tid: str, stops: int, duration: int = 600) -> dict:
    return {"ID": tid, "TotalDuration": duration, "Stops": stops}


@pytest.fixture(autouse=True)
def _reset_seats_state(monkeypatch):
    seats_service._TRIP_DETAIL_CACHE.clear()
    monkeypatch.setenv("SEATS_AERO_API_KEY", "test-key")
    yield
    seats_service._TRIP_DETAIL_CACHE.clear()


def _run(max_stops: str = "any", origin: str = "SFO", destination: str = "NRT"):
    return asyncio.run(seats_service.search_award_availability(
        origin, destination, "2026-09-15", "economy", max_stops=max_stops,
    ))


def test_seats_drops_award_when_all_trip_candidates_exceed_cap(monkeypatch):
    """max=one_or_fewer with only a 2-stop candidate: drop the entire award."""
    search = {"data": [_award(
        source="united", points=60000, trips=[_trip("t-2stop", stops=2)],
    )]}
    _install_search_response(monkeypatch, search)
    results = _run(max_stops="one_or_fewer")
    assert results == []


def test_seats_keeps_award_when_at_least_one_candidate_meets_cap(monkeypatch):
    """Mixed candidates: keep the row but only count those satisfying the cap."""
    search = {"data": [_award(
        source="united", points=60000,
        trips=[_trip("t-1stop", stops=1), _trip("t-2stop", stops=2)],
    )]}
    _install_search_response(monkeypatch, search)
    results = _run(max_stops="one_or_fewer")
    assert len(results) == 1
    # The 2-stop candidate must not show up as a trip_id post-filter.
    assert "t-2stop" not in results[0]["trip_ids"]


def test_seats_any_leaves_response_unchanged(monkeypatch):
    """Regression guard: 'any' is the no-op baseline. 2-stop trip survives."""
    search = {"data": [_award(
        source="united", points=60000, trips=[_trip("t-2stop", stops=2)],
    )]}
    _install_search_response(monkeypatch, search)
    results = _run(max_stops="any")
    assert len(results) == 1
    assert "t-2stop" in results[0]["trip_ids"]


def test_seats_nonstop_uses_top_level_direct_boolean(monkeypatch):
    """nonstop relies on cabin Direct flag (works even with no parsed trips)."""
    search = {"data": [_award(
        source="united", points=60000, trips=[], direct=False,
    )]}
    _install_search_response(monkeypatch, search)
    results = _run(max_stops="nonstop")
    assert results == []


def test_seats_nonstop_keeps_direct_award(monkeypatch):
    search = {"data": [_award(
        source="united", points=60000, trips=[_trip("t-0", stops=0)], direct=True,
    )]}
    _install_search_response(monkeypatch, search)
    results = _run(max_stops="nonstop")
    assert len(results) == 1


def test_seats_round_trip_outbound_survives_return_dropped(monkeypatch):
    """
    Outbound call (1-stop trip) survives at one_or_fewer; the return-direction
    call (2-stop trip) drops cleanly. Mirrors the real /search code path where
    seats.aero is called twice — once per direction.
    """
    outbound_search = {"data": [_award(
        source="united", points=60000, trips=[_trip("out-1stop", stops=1)],
    )]}
    return_search = {"data": [_award(
        source="united", points=60000, trips=[_trip("ret-2stop", stops=2)],
    )]}

    # Outbound call
    _install_search_response(monkeypatch, outbound_search)
    out_results = _run(max_stops="one_or_fewer", origin="SFO", destination="NRT")
    assert len(out_results) == 1
    assert "out-1stop" in out_results[0]["trip_ids"]

    # Return call (NRT→SFO)
    _install_search_response(monkeypatch, return_search)
    ret_results = _run(max_stops="one_or_fewer", origin="NRT", destination="SFO")
    assert ret_results == []


def test_seats_keeps_award_with_no_parsed_trips(monkeypatch):
    """
    Honest-filter guard: when seats.aero returns no AvailabilityTrips at all,
    we can't honestly say the award violates the cap, so it stays. The Direct
    boolean is still enforced for nonstop separately (see other tests).
    """
    search = {"data": [_award(
        source="aeroplan", points=70000, trips=[], direct=True,
    )]}
    _install_search_response(monkeypatch, search)
    results = _run(max_stops="one_or_fewer")
    assert len(results) == 1


def test_seats_max_stops_cap_is_locked_to_canonical_values():
    assert seats_service.MAX_STOPS_CAP == {
        "any": None,
        "nonstop": 0,
        "one_or_fewer": 1,
        "two_or_fewer": 2,
    }
