import asyncio
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.cache import (
    SearchParams,
    VerdictRow,
    find_search_verdict_in_db,
    get_search_memory_cache,
)
from app.db import get_db_client, insert_one, insert_one_return_id
from app.schemas.verdict_schema import RewardOption, VerdictResponse
from app.services.optimization_engine import rank_options
from app.services.pricing_service import get_cash_price
from app.services.seats_service import search_award_availability

router = APIRouter()

MAX_ALTERNATIVES = 2


def _build_summary(program: str, cpp: float, verdict: str) -> str:
    return (
        f"{program} offers a {verdict.lower()} at {cpp}¢ per point. "
        f"{'This is one of the best ways to use your points.' if cpp > 2.0 else 'Consider if a better option is available.' if cpp < 1.3 else 'A solid redemption for most travelers.'}"
    )


def _response_from_cache(v: VerdictRow) -> VerdictResponse:
    """Reconstruct a VerdictResponse from a cached VerdictRow."""
    details = v.get("details") or {}
    all_options = details.get("all_options", [])
    alternatives = [
        RewardOption(
            program=opt["program"],
            cpp=opt["cpp"],
            cash_price_used=opt["cash_price"],
            points_cost_used=opt["points"],
            verdict=opt["verdict"],
        )
        for opt in all_options[1 : 1 + MAX_ALTERNATIVES]
    ]
    return VerdictResponse(
        recommendation=v.get("top_program") or "",
        summary=v.get("summary") or "",
        details=details,
        cpp=v.get("calculated_cpp") or 0.0,
        cash_price_used=v.get("cash_price_used") or 0.0,
        points_cost_used=int(v.get("points_cost_used") or 0),
        alternatives=alternatives,
    )


@router.post("/verdict", response_model=VerdictResponse)
async def generate_verdict(
    origin: str = Query(...),
    destination: str = Query(...),
    date: str = Query(...),
    cabin: str = Query(default="economy"),
    travelers: int = Query(default=1),
    return_date: Optional[str] = Query(default=None),
):
    params: SearchParams = {
        "origin": origin,
        "destination": destination,
        "departure_date": date,
        "return_date": return_date,
        "passengers": travelers,
        "cabin": cabin,
    }

    # Step 1: check L1 memory cache
    mem_cache = get_search_memory_cache()
    cached = mem_cache.get(params)
    if cached:
        return _response_from_cache(cached["verdict"])

    # Step 2: check L2 DB cache
    try:
        db = get_db_client()
        db_result = find_search_verdict_in_db(db, params)
        if db_result:
            mem_cache.set(params, db_result.search["id"], db_result.verdict)
            return _response_from_cache(db_result.verdict)
    except Exception:
        db = None  # DB unavailable — fall through to live API call

    # Step 3: cache miss — fetch from external APIs in parallel
    award_options, cash_data = await asyncio.gather(
        search_award_availability(origin, destination, date, cabin),
        get_cash_price(origin, destination, date, cabin, travelers, return_date),
    )

    if not award_options:
        raise HTTPException(status_code=404, detail="No award availability found for this route.")

    cash_price = cash_data.get("cash_price")
    if not cash_price:
        raise HTTPException(status_code=404, detail="Could not retrieve cash price for this route.")

    # Step 4: build options and rank by CPP
    options = [
        {
            "program": opt["program"],
            "cash_price": cash_price,
            "taxes": opt.get("taxes") or 0.0,
            "points": opt["points"],
        }
        for opt in award_options
        if opt.get("points")
    ]

    if not options:
        raise HTTPException(status_code=404, detail="No valid award options with point costs found.")

    ranked = rank_options(options)
    top = ranked[0]
    recommendation_action = "use_points" if top["cpp"] >= 1.3 else "pay_cash"
    summary = _build_summary(top["program"], top["cpp"], top["verdict"])
    details = {
        "taxes": top["taxes"],
        "verdict_label": top["verdict"],
        "all_options": ranked,
    }

    alternatives = [
        RewardOption(
            program=opt["program"],
            cpp=opt["cpp"],
            cash_price_used=opt["cash_price"],
            points_cost_used=opt["points"],
            verdict=opt["verdict"],
        )
        for opt in ranked[1 : 1 + MAX_ALTERNATIVES]
    ]

    # Step 5: write to DB (searches + verdicts tables) and populate L1 cache
    try:
        if db is None:
            db = get_db_client()

        search_id = insert_one_return_id(db, "searches", {
            "origin": origin.upper(),
            "destination": destination.upper(),
            "departure_date": date,
            "return_date": return_date,
            "passengers": travelers,
            "cabin": cabin,
        })

        verdict_row = insert_one(db, "verdicts", {
            "search_id": search_id,
            "recommendation": recommendation_action,
            "top_program": top["program"],
            "summary": summary,
            "details": details,
            "calculated_cpp": top["cpp"],
            "cash_price_used": top["cash_price"],
            "points_cost_used": top["points"],
        })

        mem_cache.set(params, search_id, verdict_row)
    except Exception:
        pass  # cache write failure must never break the response

    return VerdictResponse(
        recommendation=top["program"],
        summary=summary,
        details=details,
        cpp=top["cpp"],
        cash_price_used=top["cash_price"],
        points_cost_used=top["points"],
        alternatives=alternatives,
    )
