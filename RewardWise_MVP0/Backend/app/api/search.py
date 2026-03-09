from fastapi import APIRouter, Query
from app.services.seats_service import search_award_availability, get_trip_detail
from app.services.pricing_service import get_cash_price

router = APIRouter()

@router.post("/search")
async def search(
    origin: str = Query(...),
    destination: str = Query(...),
    date: str = Query(...),
    cabin: str = Query(default="economy")
):
    award_options = await search_award_availability(origin, destination, date, cabin)
    cash_data = await get_cash_price(origin, destination, date, cabin)

    return {
        "origin": origin.upper(),
        "destination": destination.upper(),
        "date": date,
        "cabin": cabin,
        "cash_price": cash_data.get("cash_price"),
        "price_level": cash_data.get("price_level"),
        "typical_price_range": cash_data.get("typical_price_range"),
        "flights": cash_data.get("flights", []),
        "award_options": award_options,
    }

@router.get("/trips/{trip_id}")
async def trip_detail(trip_id: str):
    return await get_trip_detail(trip_id)