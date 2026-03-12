import asyncio
from typing import Optional

from fastapi import APIRouter, Query

from app.services.pricing_service import get_cash_price
from app.services.seats_service import get_trip_detail, search_award_availability

router = APIRouter()


@router.post("/search")
async def search(
    origin: str = Query(...),
    destination: str = Query(...),
    date: str = Query(...),
    cabin: str = Query(default="economy"),
    travelers: int = Query(default=1),
    return_date: Optional[str] = Query(default=None),
):
    # Fetch outbound award availability + cash price in parallel
    gather_tasks = [
        search_award_availability(origin, destination, date, cabin),
        get_cash_price(origin, destination, date, cabin, travelers, return_date),
    ]
    if return_date:
        gather_tasks.append(
            search_award_availability(destination, origin, return_date, cabin)
        )

    results = await asyncio.gather(*gather_tasks)
    award_options = results[0]
    cash_data = results[1]
    return_award_options = results[2] if return_date else []

    return {
        "origin": origin.upper(),
        "destination": destination.upper(),
        "date": date,
        "cabin": cabin,
        "travelers": travelers,
        "is_roundtrip": bool(return_date),
        "return_date": return_date,
        "cash_price": cash_data.get("cash_price"),
        "price_level": cash_data.get("price_level"),
        "typical_price_range": cash_data.get("typical_price_range"),
        "flights": cash_data.get("flights", []),
        "award_options": award_options,
        "return_award_options": return_award_options,  # empty list if one-way
    }


@router.get("/trips/{trip_id}")
async def trip_detail(trip_id: str):
    return await get_trip_detail(trip_id)
