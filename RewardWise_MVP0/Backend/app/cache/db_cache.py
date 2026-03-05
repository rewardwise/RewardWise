"""
L2 database-backed cache operations.
SearchDbLookupResult / find_search_verdict_in_db  - reuse recent verdicts.
InsertCachedFlightsResult / insert_cached_flights_only_new - upsert flight rows.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

from supabase import Client

from app.cache.config import FLIGHT_CACHE, SEARCH_DB_CACHE
from app.cache.normalize import (
    normalize,
    normalize_cabin,
    normalize_date,
    normalize_search_params,
    to_departure_ms,
)
from app.cache.types import FlightCacheInput, SearchParams, VerdictRow
from app.db.errors import DbError, wrap_supabase_error



# Search verdict DB lookup


class SearchDbLookupResult:
    __slots__ = ("search", "verdict")

    def __init__(self, search: dict[str, Any], verdict: VerdictRow):
        self.search = search
        self.verdict = verdict


def find_search_verdict_in_db(
    supabase: Client,
    params: SearchParams,
) -> SearchDbLookupResult | None:
    origin, destination, departure, return_date, passengers, cabin = (
        normalize_search_params(params)
    )

    since_ms = (time.time() * 1000) - SEARCH_DB_CACHE["MAX_AGE_MS"]
    since_iso = datetime.fromtimestamp(since_ms / 1000, tz=timezone.utc).isoformat()

    try:
        response = (
            supabase.table("searches")
            .select("id, origin, destination, departure_date, return_date, passengers, cabin")
            .eq("origin", origin)
            .eq("destination", destination)
            .eq("departure_date", departure)
            .gte("created_at", since_iso)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
    except Exception:
        return None

    searches = response.data or []
    if not searches:
        return None

    matching: dict[str, Any] | None = None
    for row in searches:
        if (
            normalize(row.get("origin") or "") == origin
            and normalize(row.get("destination") or "") == destination
            and normalize_date(row.get("departure_date") or "") == departure
            and normalize_date(row.get("return_date") or "") == return_date
            and int(row.get("passengers") or 0) == passengers
            and normalize_cabin(row.get("cabin")) == cabin
        ):
            matching = row
            break

    if matching is None:
        return None

    try:
        verdict_response = (
            supabase.table("verdicts")
            .select("*")
            .eq("search_id", matching["id"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception:
        return None

    verdict_data = verdict_response.data
    if not verdict_data:
        return None
    return SearchDbLookupResult(search=matching, verdict=verdict_data[0])



# Flight DB upsert


class InsertCachedFlightsResult:
    __slots__ = ("attempted", "skipped_past")

    def __init__(self, attempted: int, skipped_past: int):
        self.attempted = attempted
        self.skipped_past = skipped_past


def insert_cached_flights_only_new(
    supabase: Client,
    inputs: list[FlightCacheInput],
) -> InsertCachedFlightsResult:
    now_ms = time.time() * 1000
    cap_iso = datetime.fromtimestamp(
        (now_ms + FLIGHT_CACHE["MAX_TTL_MS"]) / 1000, tz=timezone.utc
    ).isoformat()

    rows: list[dict[str, Any]] = []
    for inp in inputs:
        dep_ms = to_departure_ms(inp["departure_time"])
        if dep_ms <= now_ms:
            continue
        dep_iso = datetime.fromtimestamp(dep_ms / 1000, tz=timezone.utc).isoformat()
        expires_iso = dep_iso if dep_ms < now_ms + FLIGHT_CACHE["MAX_TTL_MS"] else cap_iso
        rows.append(
            {
                "flight_id": str(inp["flight_id"]).strip(),
                "airline": normalize(inp["airline"]),
                "departure_time": dep_iso,
                "expires_at": expires_iso,
                "payload": inp.get("payload") or {},
            }
        )

    if not rows:
        return InsertCachedFlightsResult(attempted=0, skipped_past=len(inputs))

    try:
        supabase.table("cached_flights").upsert(
            rows, on_conflict="flight_id,airline"
        ).execute()
    except Exception as e:
        if isinstance(e, DbError):
            raise
        err = wrap_supabase_error(e, {"table": "cached_flights", "operation": "upsert"})
        if err:
            raise err
        raise

    return InsertCachedFlightsResult(
        attempted=len(rows),
        skipped_past=len(inputs) - len(rows),
    )
