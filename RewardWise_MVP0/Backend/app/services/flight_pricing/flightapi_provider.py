from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Optional
from urllib.parse import quote

import httpx

from app.services.flight_pricing.normalizer import normalize_flightapi_response

DEFAULT_FLIGHTAPI_BASE_URL = "https://api.flightapi.io"

# Metro fan-out tuning. FlightAPI's positional URL schema cannot encode a
# comma-separated airport list (commas get percent-encoded and rejected
# upstream as 400/404), so multi-airport metro searches must fan out one
# call per (origin, destination) pair. Concurrency stays one below the
# LITE plan's 5-call concurrent cap to leave headroom for any
# single-airport search hitting the provider at the same wall-clock
# moment. The hard cap prevents pathological metro pairs (e.g., a future
# NYC↔LON with extra airports added on each side) from blowing past the
# monthly credit budget on a single request.
METRO_FANOUT_CONCURRENCY = 4
MAX_FANOUT_PAIRS = 12
LARGE_FANOUT_THRESHOLD = 5

logger = logging.getLogger(__name__)

# FlightAPI accepts lowercase snake_case cabin values only. Title-case +
# space (the previous values) returns HTTP 400 for premium_economy /
# business / first, and is silently tolerated for economy. The map is
# kept as an identity for canonical inputs so unknown cabin strings fall
# through to "economy" instead of hitting FlightAPI as garbage.
CABIN_CLASS_MAP = {
    "economy": "economy",
    "premium_economy": "premium_economy",
    "business": "business",
    "first": "first",
}

# FlightAPI uses a positional URL schema with no stops slot — filter runs
# client-side on the normalized response. None = no filter.
STOPS_CAP = {
    "any": None,
    "nonstop": 0,
    "one_or_fewer": 1,
    "two_or_fewer": 2,
}


def _empty_response(error: str | None = None, *, is_roundtrip: bool = False) -> dict:
    payload = {
        "cash_price": None,
        "currency": os.getenv("FLIGHTAPI_CURRENCY", "USD"),
        "source": "flightapi",
        "flights": [],
        "price_level": None,
        "typical_price_range": None,
        "is_roundtrip": is_roundtrip,
    }
    if error:
        payload["error"] = error
    return payload


def _build_flightapi_path(
    *,
    api_key: str,
    origin: str,
    destination: str,
    date: str,
    cabin: str,
    travelers: int,
    return_date: Optional[str],
    currency: str,
) -> str:
    cabin_class = CABIN_CLASS_MAP.get((cabin or "economy").lower(), "economy")
    adults = max(int(travelers or 1), 1)
    children = 0
    infants = 0

    safe_parts = [
        quote(str(api_key), safe=""),
        quote(origin.upper(), safe=""),
        quote(destination.upper(), safe=""),
        quote(date, safe=""),
    ]

    if return_date:
        safe_parts.append(quote(return_date, safe=""))
        endpoint = "roundtrip"
    else:
        endpoint = "onewaytrip"

    safe_parts.extend([
        str(adults),
        str(children),
        str(infants),
        quote(cabin_class, safe=""),
        quote(currency.upper(), safe=""),
    ])

    return f"/{endpoint}/" + "/".join(safe_parts)


def _apply_stops_filter(normalized: dict, max_stops: str) -> dict:
    """
    FlightAPI lacks a request-level stops filter, so the cap is enforced on
    the normalized output. Round-trip itineraries must satisfy the cap on
    BOTH legs. "any" leaves the response untouched (regression guard).
    """
    cap = STOPS_CAP.get(max_stops)
    if cap is None:
        return normalized
    surviving = []
    for flight in normalized.get("flights", []):
        outbound_stops = flight.get("stops", 0) or 0
        if outbound_stops > cap:
            continue
        return_obj = flight.get("return_flight")
        if return_obj is not None:
            return_stops = return_obj.get("stops", 0) or 0
            if return_stops > cap:
                continue
        surviving.append(flight)
    normalized["flights"] = surviving
    normalized["cash_price"] = surviving[0]["price"] if surviving else None
    return normalized


async def get_flightapi_cash_price(
    origin: str,
    destination: str,
    date: str,
    cabin: str,
    travelers: int = 1,
    return_date: Optional[str] = None,
    max_stops: str = "any",
) -> dict:
    api_key = os.getenv("FLIGHTAPI_KEY") or os.getenv("FLIGHT_API_KEY")
    is_roundtrip = return_date is not None
    if not api_key:
        return _empty_response("Missing FLIGHTAPI_KEY", is_roundtrip=is_roundtrip)

    base_url = os.getenv("FLIGHTAPI_BASE_URL", DEFAULT_FLIGHTAPI_BASE_URL).rstrip("/")
    currency = os.getenv("FLIGHTAPI_CURRENCY", "USD")
    path = _build_flightapi_path(
        api_key=api_key,
        origin=origin,
        destination=destination,
        date=date,
        cabin=cabin,
        travelers=travelers,
        return_date=return_date,
        currency=currency,
    )

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{base_url}{path}", timeout=20.0)
            response.raise_for_status()
            data = response.json()

        normalized = normalize_flightapi_response(data, is_roundtrip=is_roundtrip, currency=currency)
        normalized = _apply_stops_filter(normalized, max_stops)
        if normalized.get("cash_price") is None:
            normalized["error"] = "FlightAPI returned no priced itineraries"
        return normalized

    except Exception as e:
        return _empty_response(str(e), is_roundtrip=is_roundtrip)


def _parse_csv_airports(value: str) -> list[str]:
    """Parse a comma-separated airport string into a deduped uppercase list.

    Tolerates whitespace (`"SFO, OAK , SJC"`), trailing/leading commas
    (`",SFO,OAK,"`), and repeats (`"SFO,SFO,OAK"`). Order is preserved
    so logs and deterministic tests stay stable.
    """
    if not value:
        return []
    tokens = [token.strip().upper() for token in value.split(",")]
    tokens = [token for token in tokens if token]
    return list(dict.fromkeys(tokens))


async def get_flightapi_cash_for_metro(
    origin: str,
    destination: str,
    date: str,
    cabin: str,
    travelers: int = 1,
    return_date: Optional[str] = None,
    max_stops: str = "any",
    concurrency: int = METRO_FANOUT_CONCURRENCY,
) -> dict:
    """Fan out FlightAPI cash calls across a metro airport list.

    `origin` and `destination` may be comma-separated airport CSVs
    (`"SFO,OAK,SJC"`, `"NRT,HND"`). The helper expands them into the
    N×M cross-product of (origin, destination) pairs, dispatches one
    `get_flightapi_cash_price` call per pair under a Semaphore matching
    `cash_sampler.py`'s default concurrency, and aggregates the
    successful results into the single-airport response shape so
    callers (and the verdict surface) need not know fan-out happened.

    Pairs are capped at ``MAX_FANOUT_PAIRS`` (12). When the cross-product
    exceeds the cap, pairs are sorted alphabetically by `(origin, dest)`
    and the first 12 are kept; a WARN log captures the truncation so
    pathological metros surface in observability.

    Same-airport pairs (e.g., `LAX→LAX` when both sides include LAX) are
    skipped silently with an INFO log rather than wasting a credit on a
    zero-mile route.

    Aggregation:
        cash_price = min(per-pair cash_price for successful pairs).
        flights    = merged across pairs, sorted by price asc, deduped
                     by (departure_iata, arrival_iata, departure_time,
                     price), capped at 10.
        _meta      = {metro_fanout=True, pairs_attempted, pairs_succeeded}

    All-fail: returns the standard empty response with `cash_price=None`
    and `_meta.metro_fanout=True`; `pricing_service` then falls through
    to the next provider in the chain, matching single-airport failure
    semantics.
    """
    is_roundtrip = return_date is not None

    origins = _parse_csv_airports(origin)
    destinations = _parse_csv_airports(destination)
    if not origins or not destinations:
        return _empty_response(
            "metro origin/destination resolved to zero airports",
            is_roundtrip=is_roundtrip,
        )

    pairs: list[tuple[str, str]] = []
    for orig in origins:
        for dest in destinations:
            if orig == dest:
                logger.info("flightapi.metro_skip_same_airport airport=%s", orig)
                continue
            pairs.append((orig, dest))

    if not pairs:
        return _empty_response(
            "all metro pairs collapsed to same-airport (no valid routes)",
            is_roundtrip=is_roundtrip,
        )

    if len(pairs) > MAX_FANOUT_PAIRS:
        pairs.sort()
        logger.warning(
            "flightapi.metro_pairs_capped requested=%d cap=%d dropped=%d",
            len(pairs), MAX_FANOUT_PAIRS, len(pairs) - MAX_FANOUT_PAIRS,
        )
        pairs = pairs[:MAX_FANOUT_PAIRS]

    if len(pairs) > LARGE_FANOUT_THRESHOLD:
        logger.info("flightapi.metro_large_fanout pairs=%d", len(pairs))

    semaphore = asyncio.Semaphore(max(1, concurrency))
    started = time.monotonic()

    async def fetch_pair(orig: str, dest: str) -> tuple[str, str, dict]:
        pair_started = time.monotonic()
        async with semaphore:
            try:
                result = await get_flightapi_cash_price(
                    orig, dest, date, cabin, travelers, return_date, max_stops=max_stops,
                )
            except Exception as exc:
                # Per-pair isolation. asyncio.CancelledError isn't an
                # Exception subclass so cooperative cancellation still
                # propagates; everything else degrades to a per-pair
                # failure rather than poisoning the whole fan-out.
                latency_ms = int((time.monotonic() - pair_started) * 1000)
                logger.info(
                    "flightapi.metro_pair orig=%s dest=%s status=fail price=None latency_ms=%d error=%s",
                    orig, dest, latency_ms, exc,
                )
                return orig, dest, _empty_response(str(exc), is_roundtrip=is_roundtrip)

            latency_ms = int((time.monotonic() - pair_started) * 1000)
            price = result.get("cash_price")
            status = "ok" if price is not None else "fail"
            logger.info(
                "flightapi.metro_pair orig=%s dest=%s status=%s price=%s latency_ms=%d",
                orig, dest, status, price, latency_ms,
            )
            return orig, dest, result

    pair_results = await asyncio.gather(*(fetch_pair(o, d) for (o, d) in pairs))
    total_latency_ms = int((time.monotonic() - started) * 1000)

    successes = [r for r in pair_results if r[2].get("cash_price") is not None]
    cheapest = min((r[2]["cash_price"] for r in successes), default=None)
    logger.info(
        "flightapi.metro_fanout pairs=%d ok=%d failed=%d cheapest=%s total_latency_ms=%d",
        len(pair_results), len(successes), len(pair_results) - len(successes),
        cheapest, total_latency_ms,
    )

    if not successes:
        empty = _empty_response("all metro pairs failed", is_roundtrip=is_roundtrip)
        empty["_meta"] = {
            "metro_fanout": True,
            "pairs_attempted": len(pairs),
            "pairs_succeeded": 0,
        }
        return empty

    seen: set[tuple] = set()
    merged: list[dict] = []
    for _, _, result in successes:
        for flight in result.get("flights", []):
            key = (
                flight.get("departure_iata"),
                flight.get("arrival_iata"),
                flight.get("departure_time"),
                flight.get("price"),
            )
            if key in seen:
                continue
            seen.add(key)
            merged.append(flight)
    merged.sort(key=lambda f: f.get("price", float("inf")))
    merged = merged[:10]

    first_success = successes[0][2]
    return {
        "cash_price": cheapest,
        "currency": first_success.get("currency", os.getenv("FLIGHTAPI_CURRENCY", "USD")),
        "source": first_success.get("source", "flightapi"),
        "flights": merged,
        "price_level": None,
        "typical_price_range": None,
        "is_roundtrip": is_roundtrip,
        "_meta": {
            "metro_fanout": True,
            "pairs_attempted": len(pairs),
            "pairs_succeeded": len(successes),
        },
    }
