from typing import Optional

from app.services.providers.flightapi_provider import search_cash_fares


async def get_cash_price(
    origin: str,
    destination: str,
    date: str,
    cabin: str,
    travelers: int = 1,
    return_date: Optional[str] = None,
) -> dict:
    """
    Public cash-fare service used by search.py and zoe_service.py.

    SerpAPI has been fully replaced with FlightAPI.io.
    This function keeps the existing app-facing contract stable so the rest of
    the backend and frontend do not need to change when the provider changes.
    """
    return await search_cash_fares(
        origin=origin,
        destination=destination,
        date=date,
        cabin=cabin,
        travelers=travelers,
        return_date=return_date,
    )
