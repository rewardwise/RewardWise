from fastapi import APIRouter, Query
from app.services.seats_service import search_award_availability
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
        "award_options": award_options
    }