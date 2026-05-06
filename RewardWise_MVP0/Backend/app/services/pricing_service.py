import os
from typing import Optional

from dotenv import load_dotenv

from app.services.flight_pricing.flightapi_provider import get_flightapi_cash_price
from app.services.flight_pricing.mock_provider import get_mock_cash_price
from app.services.flight_pricing.serpapi_provider import get_serpapi_cash_price

load_dotenv()

TRUTHY_VALUES = {"1", "true", "yes", "y", "on", "mock", "mocks"}
DISABLED_VALUES = {"none", "off", "disabled"}


def _env_is_truthy(name: str) -> bool:
    return (os.getenv(name) or "").strip().lower() in TRUTHY_VALUES


def _provider_order() -> list[str]:
    """
    Choose cash-price providers in priority order.

    Defaults to FlightAPI first because this branch migrates away from SerpAPI.
    Set CASH_PRICE_USE_MOCKS=true (or CASH_PRICE_MODE=mock) to use local JSON
    fixtures instead of live API calls while keeping the selected provider shape.
    """
    primary = (os.getenv("CASH_PRICE_PROVIDER") or "flightapi").strip().lower()
    fallback = (os.getenv("CASH_PRICE_FALLBACK_PROVIDER") or "serpapi").strip().lower()

    if _env_is_truthy("CASH_PRICE_USE_MOCKS") or _env_is_truthy("USE_CASH_PRICE_MOCKS"):
        mock_provider = (os.getenv("MOCK_CASH_PRICE_PROVIDER") or primary or "flightapi").strip().lower()
        return [f"{mock_provider}_mock"]

    mode = (os.getenv("CASH_PRICE_MODE") or "live").strip().lower()
    if mode in {"mock", "mocks", "fixture", "fixtures"}:
        mock_provider = (os.getenv("MOCK_CASH_PRICE_PROVIDER") or primary or "flightapi").strip().lower()
        return [f"{mock_provider}_mock"]

    order: list[str] = []
    for provider in (primary, fallback):
        if provider and provider not in DISABLED_VALUES and provider not in order:
            order.append(provider)
    return order


async def _fetch_from_provider(
    provider: str,
    origin: str,
    destination: str,
    date: str,
    cabin: str,
    travelers: int,
    return_date: Optional[str],
) -> dict:
    if provider == "flightapi":
        return await get_flightapi_cash_price(origin, destination, date, cabin, travelers, return_date)
    if provider in {"serpapi", "google_flights"}:
        return await get_serpapi_cash_price(origin, destination, date, cabin, travelers, return_date)
    if provider in {"mock", "flightapi_mock", "flight_api_mock"}:
        return await get_mock_cash_price(origin, destination, date, cabin, travelers, return_date, provider="flightapi")
    if provider in {"serpapi_mock", "serp_api_mock", "google_flights_mock"}:
        return await get_mock_cash_price(origin, destination, date, cabin, travelers, return_date, provider="serpapi")

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
) -> dict:
    """
    Fetch live or mocked cash flight prices through the configured provider.

    The return shape intentionally matches the original SerpAPI-powered contract
    consumed by search/Zoe, so FlightAPI can replace SerpAPI without frontend or
    verdict-engine changes.
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
