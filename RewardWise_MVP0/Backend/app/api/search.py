import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.api.validators import SearchParams, limiter  # RW-047
from app.cache import find_search_verdict_in_db, get_search_memory_cache
from app.cache.types import SearchParams as CacheSearchParams
from app.db import get_server_supabase, insert_one, insert_one_return_id
from app.services.pricing_service import get_cash_price
from app.services.seats_service import search_award_availability
from app.services.verdict_service import generate_verdict  # RW-VerdictGenerator
from app.utils.math_utils import calculate_cpp
from app.validators.airport_codes import is_valid_airport_code  # RW-047

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

    # Identify the authenticated user so we can store 'searches.user_id'
    auth_header = request.headers.get("authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    token = auth_header.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    supabase = get_server_supabase()
    try:
        user_resp = supabase.auth.get_user(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid auth token: {str(e)}")

    user = None
    if isinstance(user_resp, dict):
        user = user_resp.get("user") or (user_resp.get("data") or {}).get("user")
    else:
        user = getattr(user_resp, "user", None)

    user_id = None
    if isinstance(user, dict):
        user_id = user.get("id")
    else:
        user_id = getattr(user, "id", None) if user is not None else None

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    #cache lookup L1 memory + L2 Supabase
    cache_params: CacheSearchParams = {
        "origin": origin,
        "destination": destination,
        "departure_date": departure_date,
        "return_date": return_date,
        "passengers": travelers,
        "cabin": cabin,
    }

    memory_cache = get_search_memory_cache()
    cached_payload = None
    cached_verdict_details: dict | None = None
    cached_verdict_row = None

    try:
        cached_payload = memory_cache.get(cache_params)
    except Exception:
        cached_payload = None

    if cached_payload:
        cached_verdict_row = cached_payload.get("verdict") or None
    else:
        # supabase backed verdict reuse
        try:
            db_hit = find_search_verdict_in_db(supabase, cache_params)
            if db_hit:
                cached_verdict_row = db_hit.verdict
                #refreshd L1 so next request is fast
                try:
                    memory_cache.set(
                        cache_params,
                        search_id=str(db_hit.search["id"]),
                        verdict=db_hit.verdict,
                    )
                except Exception:
                    pass
        except Exception:
            cached_verdict_row = None

    if cached_verdict_row and cached_verdict_row.get("details"):
        cached_verdict_details = cached_verdict_row["details"]

    #Fetched all external data in parallel biggest latency win
    async def outbound_task():
        raw = await search_award_availability(origin, destination, departure_date, cabin)
        return [a for a in raw if a.get("remaining_seats", 0) >= travelers]

    async def return_task():
        if not return_date:
            return []
        raw = await search_award_availability(destination, origin, return_date, cabin)
        return [a for a in raw if a.get("remaining_seats", 0) >= travelers]

    outbound_awards, cash_data, return_awards = await asyncio.gather(
        outbound_task(),
        get_cash_price(origin, destination, departure_date, cabin, travelers, return_date),
        return_task(),
    )
    cash_price = cash_data.get("cash_price")

    # --- Build award options with CPP ---
    results = []

    for award in outbound_awards:
        points = award.get("points")
        if not points:
            continue

        taxes = award.get("taxes", 0)

        # Only compute CPP if we have a valid cash price
        cpp = None
        if cash_price is not None and points:
            cpp = calculate_cpp(cash_price, taxes, points)

        results.append({
            "program": award.get("program"),
            "points": points,
            "cash_price": cash_price,
            "taxes": taxes,
            "cpp": cpp,
            "remaining_seats": award.get("remaining_seats"),
            "direct": award.get("direct", False),
            "airlines": award.get("airlines", ""),
            "trip_ids": award.get("trip_ids", []),
            "trips": award.get("trips", []),
            "source": award.get("source"),
        })

    results.sort(key=lambda x: x["cpp"] or 0, reverse=True)
    award_options = results

    return_results = []
    for award in return_awards:
        points = award.get("points")
        if not points:
            continue

        taxes = award.get("taxes", 0)

        # Only compute CPP if we have a valid cash price
        cpp = None
        if cash_price is not None and points:
            cpp = calculate_cpp(cash_price, taxes, points)

        return_results.append({
            "program": award.get("program"),
            "points": points,
            "cash_price": cash_price,
            "taxes": taxes,
            "cpp": cpp,
            "remaining_seats": award.get("remaining_seats"),
            "direct": award.get("direct", False),
            "airlines": award.get("airlines", ""),
            "trip_ids": award.get("trip_ids", []),
            "trips": award.get("trips", []),
            "source": award.get("source"),
        })

    return_results.sort(key=lambda x: x["cpp"] or 0, reverse=True)
    return_award_options = return_results

   
    #  # --- AI Verdict with cache (Gemini Flash 2.0) ---
    # TODO: replace None with user's actual programs once wallet auth is wired into search
    # e.g. user_programs = await get_user_programs(request)
    verdict_details: dict
    if cached_verdict_details is not None:
        verdict_details = cached_verdict_details
    else:
        verdict_details = await generate_verdict(
            origin=origin,
            destination=destination,
            date=departure_date,
            cabin=cabin,
            travelers=travelers,
            is_roundtrip=return_date is not None,
            return_date=return_date,
            cash_price=cash_price,
            award_options=award_options,
            return_award_options=return_award_options,
            user_programs=None,
        )

    #Persist search request and verdict into Supabase
    try:
        raw_query = str(getattr(request.url, "query", "")).strip() or None

        search_row = {
            "user_id": user_id,
            "origin": origin,
            "destination": destination,
            "departure_date": departure_date,
            "return_date": return_date,
            "passengers": travelers,
            "cabin": cabin,
            "raw_query": raw_query,
            "trip_type": "roundtrip" if return_date else "oneway",
        }

        search_id = insert_one_return_id(supabase, "searches", search_row)

        winner = (verdict_details.get("winner") or {}) if isinstance(verdict_details, dict) else {}
        recommendation = "wait"
        if isinstance(verdict_details, dict):
            if verdict_details.get("pay_cash") is True:
                recommendation = "pay_cash"
            elif winner.get("program"):
                recommendation = "use_points"

        verdict_row = {
            "search_id": search_id,
            "recommendation": recommendation,
            "summary": verdict_details.get("verdict") if isinstance(verdict_details, dict) else None,
            "details": verdict_details if isinstance(verdict_details, dict) else None,
            "calculated_cpp": None,
            "cash_price_used": cash_price,
            "points_cost_used": winner.get("points") if isinstance(winner, dict) else None,
        }

        insert_one(supabase, "verdicts", verdict_row)

        #refresh L1 cache for faster future searches
        try:
            memory_cache.set(cache_params, search_id=search_id, verdict=verdict_row)
        except Exception as e:
            pass

    except Exception as e:
        import traceback

        raise HTTPException(
            status_code=500,
            detail=f"Supabase insert error (searches/verdicts): {getattr(e, 'details', str(e))}",
        )

   
    return {
        "origin": origin,
        "destination": destination,
        "date": departure_date,  
        "depart_date": departure_date,
        "return_date": return_date,
        "cabin": cabin,
        "travelers": travelers,
        "is_roundtrip": return_date is not None,
        "cash_price": cash_price,
        "price_level": cash_data.get("price_level"),
        "typical_price_range": cash_data.get("typical_price_range"),
        "flights": cash_data.get("flights", []),
        "award_options": award_options,
        "return_award_options": return_award_options,
        "verdict": verdict_details,
    }