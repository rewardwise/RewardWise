import asyncio
import json
import httpx
import logging
import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SEATS_AERO_BASE_URL = "https://seats.aero/partnerapi"

CABIN_MAP = {
    "economy": "Y",
    "premium_economy": "W",
    "business": "J",
    "first": "F"
}

# Outbound translation: CabinClass enum value -> seats.aero `cabins=` query
# string. Verified 2026-05-27 via /tmp/probe_seats_aero_all_cabins.py
# (3 routes × 14 candidates against live Partner API). seats.aero accepts
# only the exact lowercase strings below; every other casing and IATA-code
# variant returns 400 invalid_cabin. The only enum/API-value divergence is
# premium_economy -> "premium" — PR #22 renamed the validator enum to
# premium_economy without updating this translation, which 500'd every PE
# search in production until this mapping was introduced.
CABIN_API_PARAM = {
    "economy": "economy",
    "premium_economy": "premium",
    "business": "business",
    "first": "first",
}

# Numeric cap per MaxStops enum value. seats.aero's Partner API has no
# max_stops query param, so the filter runs client-side against the parsed
# trip Stops field. None means "no filter" (regression-guard path).
MAX_STOPS_CAP = {
    "any": None,
    "nonstop": 0,
    "one_or_fewer": 1,
    "two_or_fewer": 2,
}

# Process-local cache for /trips/{id} responses. No TTL by design: trip IDs
# are immutable for the lifetime of a given availability snapshot, and the
# parent search call refreshes them on every public search. 100-entry cap
# keeps memory bounded in the long-running FastAPI process.
_TRIP_DETAIL_CACHE: dict = {}
_TRIP_DETAIL_CACHE_MAX = 100
_TRIP_DETAIL_TIMEOUT_S = 5.0
_TRIP_DETAIL_FANOUT_LIMIT = 3


async def _fetch_trip_detail_cached(trip_id: str) -> dict:
    cached = _TRIP_DETAIL_CACHE.get(trip_id)
    if cached is not None:
        return cached
    try:
        result = await asyncio.wait_for(
            get_trip_detail(trip_id), timeout=_TRIP_DETAIL_TIMEOUT_S
        )
    except Exception:
        result = {}
    if len(_TRIP_DETAIL_CACHE) < _TRIP_DETAIL_CACHE_MAX:
        _TRIP_DETAIL_CACHE[trip_id] = result
    return result

async def search_award_availability(
    origin: str,
    destination: str,
    date: str,
    cabin: str,
    *,
    end_date: Optional[str] = None,
    take: Optional[int] = None,
    max_stops: str = "any",
) -> list:
    api_key = os.getenv("SEATS_AERO_API_KEY")
    if not api_key:
        raise ValueError("SEATS_AERO_API_KEY is not set.")

    headers = {
        "Partner-Authorization": api_key,
        "accept": "application/json"
    }
    resolved_end_date = end_date or date
    is_range = resolved_end_date != date
    # ±7 range mode = up to 15 dates × multiple programs per date — bumped from
    # 100 to 200 to avoid silent truncation on busy routes (JFK→LHR business).
    resolved_take = take if take is not None else (200 if is_range else 50)
    cabin_key = cabin.lower()
    if cabin_key not in CABIN_API_PARAM:
        raise ValueError(f"Unsupported cabin: {cabin!r}")
    params = {
        "origin_airport": origin.upper(),
        "destination_airport": destination.upper(),
        "start_date": date,
        "end_date": resolved_end_date,
        "cabins": CABIN_API_PARAM[cabin_key],
        "take": resolved_take,
        "include_trips": "true",   # ← pulls AvailabilityTrips inline, no extra call
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{SEATS_AERO_BASE_URL}/search",
                headers=headers,
                params=params,
                timeout=15.0
            )
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPStatusError, httpx.RequestError, json.JSONDecodeError) as e:
        # Defensive catch (PR #22 follow-up): any upstream failure — 4xx
        # (bad params, rate limit), 5xx (seats.aero outage), timeout,
        # transport error, or 200-with-malformed-body — degrades to "no
        # awards" so the verdict layer falls back to
        # data_quality="missing_awards" + cash price rather than 500'ing
        # the search. Logged at WARN so ops can spot pattern changes
        # (sustained 401 = key rotation needed; sustained 5xx = provider
        # incident).
        logger.warning(
            "seats.aero search failed; returning empty awards: %s %s",
            type(e).__name__, e,
        )
        return []

    # CABIN_MAP and CABIN_API_PARAM must stay in lockstep on keys — the
    # CabinClass enum parity test enforces this for CABIN_API_PARAM, and
    # the prior ValueError on cabin_key already guarantees cabin_key is a
    # known cabin here, so direct lookup is safe.
    cabin_prefix = CABIN_MAP[cabin_key]
    results = []

    # Belt-and-suspenders: seats.aero's server-side filter on `cabins=` is
    # strict (verified 2026-05-27: returned-row count exactly matches the
    # {cabin_prefix}Available count across all 4 cabins). This client-side
    # filter is now defensive against any future server behavior change,
    # not load-bearing — kept intentionally.
    for avail in data.get("data", []):
        if not avail.get(f"{cabin_prefix}Available", False):
            continue

        mileage_cost = avail.get(f"{cabin_prefix}MileageCost")
        if not mileage_cost:
            continue

        # Taxes for this cabin
        taxes = avail.get(f"{cabin_prefix}TotalTaxes")
        taxes_currency = avail.get("TaxesCurrency", "USD")

        # AvailabilityTrips is a JSON string — parse it to get trip IDs.
        # Split into two buckets so the downstream fan-out can prefer the
        # best candidate (fewest stops, then shortest duration) instead of
        # whatever order seats.aero returned.
        import json as _json
        raw_trips = avail.get("AvailabilityTrips")
        trip_candidates: list = []  # list of (id, total_duration, stops); awaits fan-out
        trips_detail = []           # inline-segments trips; no fan-out needed
        if raw_trips:
            try:
                parsed = _json.loads(raw_trips) if isinstance(raw_trips, str) else raw_trips
                for t in (parsed if isinstance(parsed, list) else []):
                    tid = t.get("ID") or t.get("AvailabilityID")
                    if not tid:
                        continue
                    total_duration = t.get("TotalDuration")
                    stops = t.get("Stops", 0)
                    segs = t.get("AvailabilitySegments", [])
                    if segs:
                        trips_detail.append({
                            "id": tid,
                            "total_duration": total_duration,
                            "stops": stops,
                            "flight_numbers": t.get("FlightNumbers", ""),
                            "departs_at": t.get("DepartsAt"),
                            "arrives_at": t.get("ArrivesAt"),
                            "segments": [
                                {
                                    "flight_number": s.get("FlightNumber"),
                                    "aircraft_name": s.get("AircraftName"),
                                    "aircraft_code": s.get("AircraftCode"),
                                    "origin": s.get("OriginAirport"),
                                    "destination": s.get("DestinationAirport"),
                                    "departs_at": s.get("DepartsAt"),
                                    "arrives_at": s.get("ArrivesAt"),
                                    "fare_class": s.get("FareClass"),
                                    "cabin": s.get("Cabin"),
                                    "distance": s.get("Distance"),
                                    "order": s.get("Order"),
                                }
                                for s in segs
                            ]
                        })
                    else:
                        trip_candidates.append((tid, total_duration, stops))
            except Exception:
                pass

        # max_stops filter. "any" leaves both trip lists untouched (regression
        # guard). "nonstop" relies on seats.aero's top-level Direct boolean
        # because trip data is often unparsed at fan-out time; non-direct
        # awards are dropped regardless of trip-list state. For one_or_fewer
        # and two_or_fewer, filter the parsed trips by Stops <= cap; if the
        # award had trips but ALL exceed the cap, drop the entire row
        # (filter-contract honesty). If no trips were parsed at all, keep
        # the award — we can't honestly say it violates the constraint.
        if max_stops != "any":
            cabin_direct = avail.get(f"{cabin_prefix}Direct", False)
            if max_stops == "nonstop" and not cabin_direct:
                continue
            cap = MAX_STOPS_CAP[max_stops]
            had_trips = bool(trip_candidates or trips_detail)
            trip_candidates = [c for c in trip_candidates if c[2] <= cap]
            trips_detail = [t for t in trips_detail if t.get("stops", 0) <= cap]
            if had_trips and not (trip_candidates or trips_detail):
                continue

        # Preserve list[str] contract for downstream consumers (search.py,
        # verdict_service). Candidates first so trip_ids[0] (used by legacy
        # callers) still points at a no-segments trip when one exists.
        trip_ids = [c[0] for c in trip_candidates] + [t["id"] for t in trips_detail]

        route_obj = avail.get("Route") if isinstance(avail.get("Route"), dict) else {}
        first_origin = origin.upper().split(",")[0]
        first_destination = destination.upper().split(",")[0]
        results.append({
            "program": avail.get("Source", "unknown"),
            "points": int(mileage_cost),
            "taxes": taxes,
            "taxes_currency": taxes_currency,
            "remaining_seats": avail.get(f"{cabin_prefix}RemainingSeats", 0),
            "airlines": avail.get(f"{cabin_prefix}Airlines", ""),
            "direct": avail.get(f"{cabin_prefix}Direct", False),
            "date": avail.get("Date"),
            "origin_airport": route_obj.get("OriginAirport") or first_origin,
            "destination_airport": route_obj.get("DestinationAirport") or first_destination,
            "route": route_obj.get("ID") or f"{first_origin}-{first_destination}",
            "trip_ids": trip_ids,          # for lazy /trips/{id} fetch if needed
            "trips": trips_detail,         # segment detail if include_trips returned it
            "_trip_candidates": trip_candidates,  # internal: (id, total_duration, stops); stripped before return
            "also_available": {
                cabin_name: {
                    "available": avail.get(f"{p}Available", False),
                    "points": avail.get(f"{p}MileageCost"),
                    "seats": avail.get(f"{p}RemainingSeats", 0),
                    "direct": avail.get(f"{p}Direct", False),
                    "taxes": avail.get(f"{p}TotalTaxes"),
                }
                for cabin_name, p in CABIN_MAP.items()
                if cabin_name != cabin.lower() and avail.get(f"{p}Available", False)
            },
            "source": "seats.aero"
        })

    # Hydrate the first few awards with segment-level detail via /trips/{id}.
    # seats.aero's include_trips=true returns AvailabilityTrips with IDs only
    # (no inline AvailabilitySegments), so the inline branch above almost
    # never fires in production. Fan out a bounded number of /trips calls
    # in parallel so the verdict surface has segments to render. For each
    # award, pick the candidate with fewest stops, tie-broken by shortest
    # total_duration — favors nonstop. Sentinels (999 / 99999) push None
    # values to the end of the sort so a missing value never beats a real one.
    # TODO(2026-05-13, Gate 4a): backfill pytest coverage for this fan-out
    # (happy path, 404, timeout, cache hit, empty trip_ids, fanout cap, sort).
    awards_to_hydrate = [
        r for r in results if not r["trips"] and r.get("_trip_candidates")
    ][:_TRIP_DETAIL_FANOUT_LIMIT]
    if awards_to_hydrate:
        best_trip_ids = []
        for r in awards_to_hydrate:
            candidates_sorted = sorted(
                r["_trip_candidates"],
                key=lambda c: (
                    c[2] if c[2] is not None else 999,
                    c[1] if c[1] is not None else 99999,
                ),
            )
            best_trip_ids.append(candidates_sorted[0][0])
        details = await asyncio.gather(
            *[_fetch_trip_detail_cached(tid) for tid in best_trip_ids],
            return_exceptions=True,
        )
        for award, detail in zip(awards_to_hydrate, details):
            if isinstance(detail, Exception) or not isinstance(detail, dict):
                continue
            hydrated_trips = detail.get("trips", [])
            if hydrated_trips:
                award["trips"] = hydrated_trips

    # Resolve metro CSV airport codes ("SFO,OAK,SJC") to the single IATA that
    # was actually booked, derived from the first/last segment of the award's
    # best trip. seats.aero's Route.OriginAirport / Route.DestinationAirport
    # echoes the metro CSV back verbatim when the search input was a metro CSV
    # (autocomplete-resolved BAY → "SFO,OAK,SJC"). Without this resolution, the
    # CSV propagates downstream to the FE — Frontend/utils/flightLegs.ts Tier 3
    # synthesis renders the raw CSV in the airport-pair span ("SIN → SFO,OAK,
    # SJC"), which is the founder-flagged "three airports on the return leg"
    # bug. Resolution rules:
    #   • Only intervene when the current value contains a comma (CSV input).
    #     Non-CSV inputs are already single IATAs from Route or the
    #     first-segment-of-input fallback — leave them untouched.
    #   • Prefer trips[0].segments[0/-1] — the booked trip's actual endpoints.
    #     If no trips/segments are available (hydration didn't fire, or the
    #     award has no segment detail), leave the CSV in place. The FE Tier 4
    #     fallback then handles it the same way it did pre-fix, so worst case
    #     is no-regression.
    for r in results:
        trips = r.get("trips") or []
        first_trip_segments = trips[0].get("segments") if trips else None
        if first_trip_segments:
            current_origin = r.get("origin_airport")
            if isinstance(current_origin, str) and "," in current_origin:
                seg_origin = first_trip_segments[0].get("origin")
                if seg_origin and "," not in seg_origin:
                    r["origin_airport"] = seg_origin
            current_destination = r.get("destination_airport")
            if isinstance(current_destination, str) and "," in current_destination:
                seg_destination = first_trip_segments[-1].get("destination")
                if seg_destination and "," not in seg_destination:
                    r["destination_airport"] = seg_destination

    # Internal-only field — never expose to API consumers.
    for r in results:
        r.pop("_trip_candidates", None)

    return results


async def get_trip_detail(trip_id: str) -> dict:
    """Fetch full segment detail for a specific trip ID. Call this lazily on expand."""
    api_key = os.getenv("SEATS_AERO_API_KEY")
    if not api_key:
        return {}

    headers = {
        "Partner-Authorization": api_key,
        "accept": "application/json"
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SEATS_AERO_BASE_URL}/trips/{trip_id}",
            headers=headers,
            timeout=15.0
        )
        if response.status_code != 200:
            return {}
        data = response.json()

    trips = []
    for t in data.get("data", []):
        segs = t.get("AvailabilitySegments", [])
        trips.append({
            "id": t.get("ID"),
            "total_duration": t.get("TotalDuration"),
            "stops": t.get("Stops", 0),
            "flight_numbers": t.get("FlightNumbers", ""),
            "departs_at": t.get("DepartsAt"),
            "arrives_at": t.get("ArrivesAt"),
            "mileage_cost": t.get("MileageCost"),
            "total_taxes": t.get("TotalTaxes"),
            "taxes_currency": t.get("TaxesCurrency", "USD"),
            "segments": [
                {
                    "flight_number": s.get("FlightNumber"),
                    "aircraft_name": s.get("AircraftName"),
                    "aircraft_code": s.get("AircraftCode"),
                    "origin": s.get("OriginAirport"),
                    "destination": s.get("DestinationAirport"),
                    "departs_at": s.get("DepartsAt"),
                    "arrives_at": s.get("ArrivesAt"),
                    "fare_class": s.get("FareClass"),
                    "cabin": s.get("Cabin"),
                    "distance": s.get("Distance"),
                }
                for s in segs
            ]
        })

    return {
        "trips": trips,
        "origin_coords": data.get("origin_coordinates"),
        "destination_coords": data.get("destination_coordinates"),
    }