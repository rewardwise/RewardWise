from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from app.services.flight_pricing.normalizer import normalize_flightapi_response
from app.services.flight_pricing.serpapi_provider import normalize_serpapi_response

MOCK_DATA_DIR = Path(__file__).resolve().parent / "mock_data"

PROVIDER_ALIASES = {
    "flightapi_mock": "flightapi",
    "flight_api_mock": "flightapi",
    "flightapi": "flightapi",
    "mock": "flightapi",
    "serpapi_mock": "serpapi",
    "serp_api_mock": "serpapi",
    "google_flights_mock": "serpapi",
    "google_flights": "serpapi",
    "serpapi": "serpapi",
}


def _normalized_mock_provider(provider: str | None) -> str:
    key = (provider or "flightapi").strip().lower()
    return PROVIDER_ALIASES.get(key, key)


def _fixture_name(provider: str, return_date: Optional[str]) -> str:
    trip_type = "roundtrip" if return_date else "oneway"
    return f"{provider}_{trip_type}_sample.json"


def _load_fixture(provider: str, return_date: Optional[str]) -> dict:
    fixture_path = MOCK_DATA_DIR / _fixture_name(provider, return_date)
    with fixture_path.open("r", encoding="utf-8") as f:
        return json.load(f)


async def get_mock_cash_price(
    origin: str,
    destination: str,
    date: str,
    cabin: str,
    travelers: int = 1,
    return_date: Optional[str] = None,
    provider: str = "flightapi",
    max_stops: str = "any",
) -> dict:
    """
    Return provider-shaped fixture data through the same parser used by live calls.

    This lets Zoe/search exercise the real backend cash-price contract without
    spending provider credits during local and preview testing.
    """
    mock_provider = _normalized_mock_provider(provider)
    is_roundtrip = return_date is not None
    raw = _load_fixture(mock_provider, return_date)

    if mock_provider == "flightapi":
        normalized = normalize_flightapi_response(raw, is_roundtrip=is_roundtrip, currency="USD")
    elif mock_provider == "serpapi":
        normalized = normalize_serpapi_response(raw, is_roundtrip=is_roundtrip, currency="USD")
    else:
        return {
            "cash_price": None,
            "currency": "USD",
            "source": f"{mock_provider}_mock",
            "flights": [],
            "error": f"Unsupported mock cash price provider: {provider}",
        }

    normalized["source"] = f"{mock_provider}_mock"
    normalized["mock_request"] = {
        "provider": mock_provider,
        "origin": origin.upper(),
        "destination": destination.upper(),
        "departure_date": date,
        "return_date": return_date,
        "cabin": cabin,
        "travelers": travelers,
    }
    return normalized
