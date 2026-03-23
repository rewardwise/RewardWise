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

# Maps seats.aero source strings → card program names that transfer there.
# Mirrors WalletContext.tsx PROGRAM_ALIASES on the frontend.
PROGRAM_ALIASES: dict[str, list[str]] = {
    # ── Airline programs ──────────────────────────────────────────────
    "united":           ["United MileagePlus"],
    "delta":            ["Delta SkyMiles"],
    "american":         ["Citi ThankYou Points", "Chase Ultimate Rewards"],
    "alaska":           [],  # no major transferable card programs
    "jetblue":          [],  # TrueBlue has no major transfer partners in wallet
    "aeroplan":         ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    "virginatlantic":   ["Chase Ultimate Rewards", "Capital One Miles"],
    "flyingblue":       ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    "british":          ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    "singapore":        ["Chase Ultimate Rewards", "Amex Membership Rewards"],
    "cathay":           ["Chase Ultimate Rewards", "Amex Membership Rewards"],
    "emirates":         ["Chase Ultimate Rewards", "Amex Membership Rewards"],
    "turkish":          ["Chase Ultimate Rewards"],
    "qantas":           ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    "avianca":          ["Capital One Miles"],
    "lifemiles":        ["Capital One Miles"],  # same as avianca, different brand name
    "etihad":           ["Amex Membership Rewards"],
    "qatar":            ["Amex Membership Rewards"],
    "saudia":           [],  # no transfer partners from major cards
    "smiles":           [],  # GOL Smiles — no transfer partners from major cards
    "azul":             [],  # no transfer partners
    "korean":           [],  # no transfer partners from major cards
    "ana":              ["Amex Membership Rewards"],
    "air_france":       ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],  # = flyingblue
    # ── Hotel programs ────────────────────────────────────────────────
    "hyatt":            ["World of Hyatt"],
    "marriott":         ["Marriott Bonvoy"],
}


def get_search_params(
    origin: str = Query(...),
    destination: str = Query(...),
    date: str = Query(...),
    cabin: str = Query(default="economy"),
    travelers: int = Query(default=1),
    return_date: Optional[str] = Query(default=None),
) -> SearchParams:
    """Dependency that validates and returns typed search params (RW-047)."""
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


def _get_user_programs(supabase, user_id: str) -> list[str]:
    """
    Fetch the user's wallet cards from Supabase, map their reward program names
    through PROGRAM_ALIASES, and return the list of seats.aero source strings
    the user can actually redeem (e.g. ["united", "aeroplan", "delta"]).
    Returns an empty list on any error so the search never hard-fails.
    """
    try:
        resp = (
            supabase
            .from_("cards")
            .select("reward_programs(name)")
            .eq("user_id", user_id)
            .execute()
        )
        owned_program_names = [
            row["reward_programs"]["name"]
            for row in (resp.data or [])
            if row.get("reward_programs")
        ]
        return [
            source
            for source, aliases in PROGRAM_ALIASES.items()
            if any(alias in owned_program_names for alias in aliases)
        ]
    except Exception:
        return []


@router.post("/search")
@limiter.limit("10/minute")  # RW-047: rate limit
async def search(
    request: Request,  # required by SlowAPI
    params: SearchParams = Depends(get_search_params),
):
    origin = params.origin
    destination = params.destination
    departure_date = params.date
    cabin = params.cabin.value
    travelers = params.travelers
    return_date = params.return_date

    # --- Auth: identify the user ---
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

    # --- Fetch user's redeemable programs from their wallet ---
    user_programs = _get_user_programs(supabase, user_id)

    # --- L1 memory + L2 Supabase cache lookup ---
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
        try:
            db_hit = find_search_verdict_in_db(supabase, cache_params)
            if db_hit:
                cached_verdict_row = db_hit.verdict
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

    # --- Parallel fetch ---
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

    # --- Build outbound award options with CPP ---
    results = []
    for award in outbound_awards:
        points = award.get("points")
        if not points:
            continue
        taxes = (award.get("taxes") or 0) / 100
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

    # --- Build return award options with CPP ---
    return_results = []
    for award in return_awards:
        points = award.get("points")
        if not points:
            continue
        taxes = (award.get("taxes") or 0) / 100
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

    # --- AI Verdict ---
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
            user_programs=user_programs or None,
        )

    # --- Persist search + verdict into Supabase ---
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

        try:
            memory_cache.set(cache_params, search_id=search_id, verdict=verdict_row)
        except Exception:
            pass

    except Exception as e:
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
        "user_programs": user_programs,
    }