from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from app.services.flight_pricing.normalizer import normalize_flightapi_response

MOCK_DATA_DIR = Path(__file__).resolve().parent / "mock_data"


def _fixture_name(return_date: Optional[str]) -> str:
    return "flightapi_roundtrip_sample.json" if return_date else "flightapi_oneway_sample.json"


async def get_mock_cash_price(
    origin: str,
    destination: str,
    date: str,
    cabin: str,
    travelers: int = 1,
    return_date: Optional[str] = None,
) -> dict:
    """
    Return FlightAPI-shaped fixture data through the real FlightAPI normalizer.

    This lets Zoe/search exercise the same backend contract without spending
    FlightAPI credits during local and preview testing.
    """
    fixture_path = MOCK_DATA_DIR / _fixture_name(return_date)
    with fixture_path.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    normalized = normalize_flightapi_response(
        raw,
        is_roundtrip=return_date is not None,
        currency="USD",
    )
    normalized["source"] = "flightapi_mock"
    normalized["mock_request"] = {
        "origin": origin.upper(),
        "destination": destination.upper(),
        "departure_date": date,
        "return_date": return_date,
        "cabin": cabin,
        "travelers": travelers,
    }
    return normalized
