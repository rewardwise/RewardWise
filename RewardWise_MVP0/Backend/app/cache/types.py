"""CACHE Types"""

from typing import Any, Literal, TypedDict


class SearchParams(TypedDict, total=False):

    origin: str
    destination: str
    departure_date: str
    departure_date_end: str | None
    return_date: str | None
    return_date_end: str | None
    passengers: int
    cabin: str | None


class OwnershipBlock(TypedDict, total=False):
    """Per-request ownership fork attached to a use_points verdict's response.

    Computed by app.services.ownership.compute_ownership from the caller's live
    wallet. NOT cached/persisted with the verdict (it is per-user). `fork_reason`
    is one of: owned_sufficient | short_buy_worth_it | short_cant_buy |
    short_buy_not_worth_it.
    """
    applicable: bool
    program: str
    program_label: str | None
    points_needed: int
    owned_balance: int
    shortfall: int
    can_afford: bool
    reachable_partners: list[dict[str, Any]]
    buyable: bool
    buy_rate_cpp: float | None
    redemption_cpp: float | None
    buy_gap_cost: float | None
    buy_gap_worth_it: bool
    fork_recommendation: Literal["use_points", "pay_cash"]
    fork_reason: str


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
