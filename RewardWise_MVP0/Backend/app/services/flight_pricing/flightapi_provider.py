from __future__ import annotations

import os
from typing import Optional
from urllib.parse import quote

import httpx

from app.services.flight_pricing.normalizer import normalize_flightapi_response

DEFAULT_FLIGHTAPI_BASE_URL = "https://api.flightapi.io"

CABIN_CLASS_MAP = {
    "economy": "Economy",
    "premium_economy": "Premium_Economy",
    "premium economy": "Premium_Economy",
    "business": "Business",
    "first": "First",
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
    cabin_class = CABIN_CLASS_MAP.get((cabin or "economy").lower(), "Economy")
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


async def get_flightapi_cash_price(
    origin: str,
    destination: str,
    date: str,
    cabin: str,
    travelers: int = 1,
    return_date: Optional[str] = None,
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
        if normalized.get("cash_price") is None:
            normalized["error"] = "FlightAPI returned no priced itineraries"
        return normalized

    except Exception as e:
        return _empty_response(str(e), is_roundtrip=is_roundtrip)
