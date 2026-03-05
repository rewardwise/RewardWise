"""CACHE Types"""

from typing import Any, Literal, TypedDict


class SearchParams(TypedDict, total=False):

    origin: str
    destination: str
    departure_date: str
    return_date: str | None
    passengers: int
    cabin: str | None


class VerdictRow(TypedDict, total=False):
    id: str
    search_id: str
    recommendation: Literal["use_points", "pay_cash", "wait"]
    summary: str | None
    details: dict[str, Any] | None
    calculated_cpp: float | None
    cash_price_used: float | None
    points_cost_used: float | None
    created_at: str


class SearchRow(TypedDict, total=False):
    id: str
    user_id: str | None
    origin: str
    destination: str
    departure_date: str
    return_date: str | None
    passengers: int
    cabin: str | None
    raw_query: str | None
    created_at: str


class CachedVerdictPayload(TypedDict):
    search_id: str
    verdict: VerdictRow
    from_cache: Literal[True]


class FlightCacheEntry(TypedDict):
    flight_id: str
    airline: str
    departure_time: int
    payload: dict[str, Any]


class FlightCacheInput(TypedDict):
    flight_id: str
    airline: str
    departure_time: str | int
    payload: dict[str, Any]
