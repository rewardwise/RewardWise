import os
from typing import Optional

from dotenv import load_dotenv

from app.services.flight_pricing.mock_provider import get_mock_cash_price
from app.services.flight_pricing.serpapi_provider import get_serpapi_cash_price

load_dotenv()

TRUTHY_VALUES = {"1", "true", "yes", "y", "on", "mock", "mocks"}
DISABLED_VALUES = {"none", "off", "disabled"}


def _env_is_truthy(name: str) -> bool:
    return (os.getenv(name) or "").strip().lower() in TRUTHY_VALUES


def _provider_order() -> list[str]:
    """
    SerpAPI is the SOLE cash-price provider (FlightAPI subscription canceled
    and ripped out 2026-07-26). Mock mode keeps the serpapi fixture shape.
    On SerpAPI failure the caller receives a clean no-cash-price error dict
    and the verdict degrades to the partial-data "wait" branch — there is no
    second provider to fall through to.
    """
    if _env_is_truthy("CASH_PRICE_USE_MOCKS") or _env_is_truthy("USE_CASH_PRICE_MOCKS"):
        return ["serpapi_mock"]
    mode = (os.getenv("CASH_PRICE_MODE") or "live").strip().lower()
    if mode in {"mock", "mocks", "fixture", "fixtures"}:
        return ["serpapi_mock"]
    return ["serpapi"]


async def _fetch_from_provider(
    provider: str,
    origin: str,
    destination: str,
    date: str,
    cabin: str,
    travelers: int,
    return_date: Optional[str],
    max_stops: str = "any",
    cache_first: bool = False,
) -> dict:
    if provider in {"serpapi", "google_flights"}:
        return await get_serpapi_cash_price(origin, destination, date, cabin, travelers, return_date, max_stops=max_stops, cache_first=cache_first)
    if provider in {"mock", "serpapi_mock", "serp_api_mock", "google_flights_mock"}:
        return await get_mock_cash_price(origin, destination, date, cabin, travelers, return_date, provider="serpapi", max_stops=max_stops)

    return {
        "cash_price": None,
        "currency": "USD",
        "source": provider,
        "flights": [],
        "error": f"Unsupported cash price provider: {provider}",
    }


async def get_cash_price(
    origin: str,
    destination: str,
    date: str,
    cabin: str,
    travelers: int = 1,
    return_date: Optional[str] = None,
    max_stops: str = "any",
    cache_first: bool = False,
) -> dict:
    """
    Fetch live or mocked cash flight prices through the configured provider.

    The return shape is the long-standing SerpAPI-powered contract consumed by
    search/Zoe.
    """
    errors: list[str] = []
    provider_order = _provider_order()

    for provider in provider_order:
        result = await _fetch_from_provider(
            provider,
            origin,
            destination,
            date,
            cabin,
            travelers,
            return_date,
            max_stops=max_stops,
            cache_first=cache_first,
        )

        if result.get("cash_price") is not None:
            if errors:
                result["provider_fallback_errors"] = errors
            if provider != provider_order[0]:
                result["source"] = f"{result.get('source', provider)}_fallback"
            return result

        error = result.get("error") or f"{provider} returned no cash price"
        errors.append(f"{provider}: {error}")

    return {
        "cash_price": None,
        "currency": "USD",
        "source": provider_order[0] if provider_order else "flight_pricing",
        "flights": [],
        "error": "; ".join(errors) if errors else "No cash price provider configured",
    }
