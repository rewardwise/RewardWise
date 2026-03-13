from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.services.seats_service import search_award_availability
from app.services.pricing_service import get_cash_price
from app.utils.math_utils import calculate_cpp
from app.api.validators import SearchParams, limiter          # RW-047
from app.validators.airport_codes import is_valid_airport_code  # RW-047
from app.services.verdict_service import generate_verdict     # RW-VerdictGenerator

router = APIRouter()


def get_search_params(
    origin: str = Query(...),
    destination: str = Query(...),
    date: str = Query(...),
    cabin: str = Query(default="economy"),
    travelers: int = Query(default=1),
    return_date: Optional[str] = Query(default=None),
) -> SearchParams:
    """Dependency that validates and returns typed search params (RW-047)."""
    # RW-047: airport code validation
    if not is_valid_airport_code(origin):
        raise HTTPException(status_code=422, detail=f"Invalid origin airport code: '{origin}'")
    if not is_valid_airport_code(destination):
        raise HTTPException(status_code=422, detail=f"Invalid destination airport code: '{destination}'")
    if origin.upper() == destination.upper():
        raise HTTPException(status_code=422, detail="Origin and destination cannot be the same.")
    try:
        return SearchParams(
            origin=origin,
            destination=destination,
            date=date,
            cabin=cabin,
            travelers=travelers,
            return_date=return_date,
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/search")
@limiter.limit("10/minute")  # RW-047: rate limit
async def search(
    request: Request,                                # required by SlowAPI
    params: SearchParams = Depends(get_search_params),
):
    origin = params.origin
    destination = params.destination
    departure_date = params.date
    cabin = params.cabin.value
    travelers = params.travelers
    return_date = params.return_date

    # --- Outbound leg ---
    outbound_awards = await search_award_availability(
        origin, destination, departure_date, cabin
    )
    cash_data = await get_cash_price(
        origin, destination, departure_date, cabin, travelers, return_date
    )
    cash_price = cash_data.get("cash_price")

    # --- Return leg (round trip) ---
    return_awards = []
    if return_date:
        return_awards = await search_award_availability(
            destination, origin, return_date, cabin
        )
        # Filter return results to seats >= travelers
        return_awards = [
            a for a in return_awards
            if a.get("remaining_seats", 0) >= travelers
        ]

    # --- Build award options with CPP ---
    results = []
    for award in outbound_awards:
        points = award.get("points")
        if not points:
            continue
        cpp = calculate_cpp(cash_price or 0, award.get("taxes", 0), points)
        results.append({
            "program":         award.get("program"),
            "points":          points,
            "cash_price":      cash_price,
            "taxes":           award.get("taxes", 0),
            "cpp":             cpp,
            "remaining_seats": award.get("remaining_seats"),
            "direct":          award.get("direct", False),
            "airlines":        award.get("airlines", ""),
            "trip_ids":        award.get("trip_ids", []),
            "trips":           award.get("trips", []),
            "source":          award.get("source"),
        })

    results.sort(key=lambda x: x["cpp"], reverse=True)

    # --- AI Verdict (Gemini Flash 2.0) ---
    # TODO: replace None with user's actual programs once wallet auth is wired into search
    # e.g. user_programs = await get_user_programs(request)
    user_programs = None

    verdict = await generate_verdict(
        origin=origin,
        destination=destination,
        date=departure_date,
        cabin=cabin,
        travelers=travelers,
        is_roundtrip=return_date is not None,
        return_date=return_date,
        cash_price=cash_price,
        award_options=results,
        return_award_options=return_awards,
        user_programs=user_programs,
    )

    return {
        "origin":               origin,
        "destination":          destination,
        "date":                 departure_date,
        "return_date":          return_date,
        "cabin":                cabin,
        "travelers":            travelers,
        "is_roundtrip":         return_date is not None,
        "cash_price":           cash_price,
        "price_level":          cash_data.get("price_level"),
        "typical_price_range":  cash_data.get("typical_price_range"),
        "flights":              cash_data.get("flights", []),
        "award_options":        results,
        "return_award_options": return_awards,
        "verdict":              verdict,
    }