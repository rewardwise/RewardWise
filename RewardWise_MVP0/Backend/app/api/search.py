import asyncio
from typing import Optional, TypedDict
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from app.api.validators import SearchParams, limiter  # RW-047
from app.cache import find_search_verdict_in_db, get_search_memory_cache
from app.cache.types import SearchParams as CacheSearchParams
from app.db import get_server_supabase, insert_one, insert_one_return_id
from app.services.cash_sampler import sample_cash_prices_by_date
from app.services.pair_ranker import rank_pairs
from app.services.pricing_service import get_cash_price
from app.services.seats_service import search_award_availability
from app.services.verdict_service import generate_verdict  # RW-VerdictGenerator
from app.utils.math_utils import calculate_cpp
from app.program_aliases import PROGRAM_ALIASES
import os
router = APIRouter()


def get_search_params(
    origin: str = Query(...),
    destination: str = Query(...),
    date: str = Query(...),
    cabin: str = Query(default="economy"),
    travelers: int = Query(default=1),
    return_date: Optional[str] = Query(default=None),
    date_end: Optional[str] = Query(default=None),
    return_date_end: Optional[str] = Query(default=None),
    max_stops: str = Query(default="any"),
) -> SearchParams:
    """Dependency that validates and returns typed search params (RW-047)."""
    try:
        return SearchParams(
            origin=origin,
            destination=destination,
            date=date,
            date_end=date_end,
            cabin=cabin,
            travelers=travelers,
            return_date=return_date,
            return_date_end=return_date_end,
            max_stops=max_stops,
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


class UserWallet(TypedDict):
    # post-PROGRAM_ALIASES seats.aero source slugs (e.g. ["united", "aeroplan"])
    programs: list[str]
    # raw reward_programs.name brands (e.g. ["Chase Ultimate Rewards"])
    cards: list[str]


def _get_user_programs(supabase, user_id: str) -> UserWallet:
    """
    Fetch the user's wallet from Supabase and return both representations:
    - `programs`: seats.aero source slugs the user can redeem via PROGRAM_ALIASES
      reverse-lookup (e.g. ["united", "aeroplan", "delta"])
    - `cards`: raw reward_programs.name brands (e.g. ["Chase Ultimate Rewards",
      "Amex Membership Rewards"])
    Both are needed downstream: `programs` for award-source filtering, `cards`
    for wallet-reachability checks against TRANSFER_PARTNERS[slug].sourceCard
    which is a brand string, not a slug.
    Returns empty wallet on any error so the search never hard-fails.
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
        programs = [
            source
            for source, aliases in PROGRAM_ALIASES.items()
            if any(alias in owned_program_names for alias in aliases)
        ]
        return {"programs": programs, "cards": owned_program_names}
    except Exception:
        return {"programs": [], "cards": []}


def _build_award_options_with_per_date_cash(
    awards: list[dict],
    cash_by_date: dict,
    *,
    include_endpoint_airports: bool,
) -> list[dict]:
    """Build sorted award options where each award's cash_price + cpp is keyed
    off its own date via cash_by_date, not a single anchor-date scalar.

    include_endpoint_airports controls whether origin_airport / destination_airport
    are emitted on each award row. The FE consumes these in
    `Frontend/utils/flightLegs.ts` (Tier 3 leg synthesis) to render resolved
    airport codes instead of the raw metro CSV (e.g. "JFK,LGA,EWR"). Both
    outbound and return legs should pass True; the False default exists only
    for callers that have no per-leg airport data to emit.
    """
    results: list[dict] = []
    for award in awards:
        points = award.get("points")
        if not points:
            continue
        taxes = (award.get("taxes") or 0) / 100
        award_cash = cash_by_date.get(award.get("date"))
        cpp = calculate_cpp(award_cash, taxes, points) if award_cash is not None else None
        row = {
            "program": award.get("program"),
            "points": points,
            "cash_price": award_cash,
            "taxes": taxes,
            "cpp": cpp,
            "remaining_seats": award.get("remaining_seats"),
            "direct": award.get("direct", False),
            "airlines": award.get("airlines", ""),
        }
        if include_endpoint_airports:
            row["origin_airport"] = award.get("origin_airport")
            row["destination_airport"] = award.get("destination_airport")
        row["date"] = award.get("date")
        row["trip_ids"] = award.get("trip_ids", [])
        row["trips"] = award.get("trips", [])
        row["source"] = award.get("source")
        results.append(row)
    results.sort(key=lambda x: x["cpp"] or 0, reverse=True)
    return results


@router.post("/search")
@limiter.limit("10/minute")  # RW-047: rate limit
async def search(
    request: Request,  # required by SlowAPI
    params: SearchParams = Depends(get_search_params),
):
    origin = params.origin
    destination = params.destination
    departure_date = params.date
    departure_date_end = params.date_end
    cabin = params.cabin.value
    travelers = params.travelers
    return_date = params.return_date
    return_date_end = params.return_date_end
    max_stops = params.max_stops.value

    # --- Auth: identify the user ---
    auth_header = request.headers.get("authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    token = auth_header.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")


    

    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": SERVICE_KEY,
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers=headers,
        )

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    user = response.json()
    user_id = user.get("id")
    supabase = get_server_supabase()


    # --- Fetch user's redeemable programs from their wallet ---
    wallet = _get_user_programs(supabase, user_id)
    user_programs = wallet["programs"]
    user_cards = wallet["cards"]

    # --- L1 memory + L2 Supabase cache lookup ---
    cache_params: CacheSearchParams = {
        "origin": origin,
        "destination": destination,
        "departure_date": departure_date,
        "departure_date_end": departure_date_end,
        "return_date": return_date,
        "return_date_end": return_date_end,
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
        raw = await search_award_availability(
            origin,
            destination,
            departure_date,
            cabin,
            end_date=departure_date_end,
            max_stops=max_stops,
        )
        return [a for a in raw if a.get("remaining_seats", 0) >= travelers]

    async def return_task():
        if not return_date:
            return []
        raw = await search_award_availability(
            destination,
            origin,
            return_date,
            cabin,
            end_date=return_date_end,
            max_stops=max_stops,
        )
        return [a for a in raw if a.get("remaining_seats", 0) >= travelers]

    outbound_awards, cash_data, return_awards = await asyncio.gather(
        outbound_task(),
        get_cash_price(origin, destination, departure_date, cabin, travelers, return_date, max_stops=max_stops),
        return_task(),
    )

    cash_price = cash_data.get("cash_price")

    # Per-date cash for each leg so each award's CPP is computed against its
    # own date's cash, not the anchor-date cash (ClickUp 86b9x8qr2).
    outbound_dates = [a.get("date") for a in outbound_awards if a.get("date")]
    return_dates = [a.get("date") for a in return_awards if a.get("date")]
    cash_out_by_date, cash_ret_by_date = await asyncio.gather(
        sample_cash_prices_by_date(
            origin, destination, outbound_dates, cabin, travelers, max_stops=max_stops
        ),
        sample_cash_prices_by_date(
            destination, origin, return_dates, cabin, travelers, max_stops=max_stops
        ),
    )

    award_options = _build_award_options_with_per_date_cash(
        outbound_awards, cash_out_by_date, include_endpoint_airports=True
    )
    return_award_options = _build_award_options_with_per_date_cash(
        return_awards, cash_ret_by_date, include_endpoint_airports=True
    )

    # --- Pair-rank when both legs are flexible ---
    winning_date = award_options[0].get("date") if award_options else None
    winning_return_date = (
        return_award_options[0].get("date") if return_award_options else None
    )
    if (
        departure_date_end
        and return_date_end
        and award_options
        and return_award_options
    ):
        best_out, best_ret = rank_pairs(award_options, return_award_options)
        if best_out is not None and best_ret is not None:
            award_options = [best_out] + [a for a in award_options if a is not best_out]
            return_award_options = [best_ret] + [
                r for r in return_award_options if r is not best_ret
            ]
            winning_date = best_out.get("date")
            winning_return_date = best_ret.get("date")

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
        inserted_verdict = insert_one(supabase, "verdicts", verdict_row)
        verdict_id = inserted_verdict.get("id")

        try:
            memory_cache.set(cache_params, search_id=search_id, verdict=inserted_verdict)
        except Exception:
            pass

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Supabase insert error (searches/verdicts): {getattr(e, 'details', str(e))}",
        )

    return {
        "search_id": search_id if "search_id" in locals() else None,
        "verdict_id": verdict_id if "verdict_id" in locals() else None,
        "origin": origin,
        "destination": destination,
        "date": departure_date,
        "depart_date": departure_date,
        "depart_date_end": departure_date_end,
        "winning_date": winning_date,
        "return_date": return_date,
        "return_date_end": return_date_end,
        "winning_return_date": winning_return_date,
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
        "user_cards": user_cards,
    }

async def run_search(request: Request, params):
    """
    Internal helper called by zoe_service.
    Now accepts the real request object so auth flows through correctly.
    """
    return await search(request=request, params=params)


# ---------------------------------------------------------------------------
# Public one-time guest search
# ---------------------------------------------------------------------------
import hashlib
import json
from datetime import datetime, timezone


def _client_ip_from_request(request: Request) -> str:
    """
    Best-effort client IP extraction behind Vercel/Render/proxies.
    We store only a salted hash of this value, never the raw IP.
    """
    for header_name in ("cf-connecting-ip", "x-real-ip", "x-forwarded-for"):
        value = request.headers.get(header_name)
        if value:
            return value.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _hash_public_trial_value(value: str) -> str:
    secret = (
        os.environ.get("IP_HASH_SECRET")
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or "local-dev-public-search-secret"
    )
    return hashlib.sha256(f"{secret}:{value}".encode("utf-8")).hexdigest()


def _public_trial_payload_for_log(params: SearchParams) -> dict:
    return {
        "origin": params.origin,
        "destination": params.destination,
        "date": params.date,
        "return_date": params.return_date,
        "cabin": params.cabin.value,
        "travelers": params.travelers,
    }


def _public_search_free_limit() -> int:
    # Canonical enforcement value. Frontend mirrors this via
    # NEXT_PUBLIC_PUBLIC_SEARCH_FREE_LIMIT for display-only copy — the two
    # env vars MUST be set in lockstep. Default 3 on both.
    try:
        return max(1, int(os.getenv("PUBLIC_SEARCH_FREE_LIMIT", "3")))
    except ValueError:
        return 3


def _public_trial_exhausted_detail(limit: int) -> str:
    noun = "search" if limit == 1 else "searches"
    return (
        f"You’ve used your {limit} free {noun}. "
        "Create an account to keep comparing trips."
    )


def _claim_public_search_trial(supabase, request: Request, params: SearchParams) -> str:
    ip = _client_ip_from_request(request)
    ip_hash = _hash_public_trial_value(ip)
    user_agent_hash = _hash_public_trial_value(request.headers.get("user-agent", "unknown"))
    limit = _public_search_free_limit()

    existing = (
        supabase
        .from_("public_search_trials")
        .select("id, used_at, status")
        .eq("ip_hash", ip_hash)
        .limit(limit)
        .execute()
    )
    if len(existing.data or []) >= limit:
        raise HTTPException(
            status_code=429,
            detail=_public_trial_exhausted_detail(limit),
        )

    payload = {
        "ip_hash": ip_hash,
        "user_agent_hash": user_agent_hash,
        "origin": params.origin,
        "destination": params.destination,
        "departure_date": params.date,
        "return_date": params.return_date,
        "cabin": params.cabin.value,
        "travelers": params.travelers,
        "status": "started",
        "request_payload": _public_trial_payload_for_log(params),
    }

    try:
        inserted = insert_one(supabase, "public_search_trials", payload)
        return str(inserted["id"])
    except Exception:
        # Handles the race case where two tabs/devices on the same IP submit at once.
        raise HTTPException(
            status_code=429,
            detail=_public_trial_exhausted_detail(limit),
        )


def _update_public_trial(supabase, trial_id: str, status: str, extra: dict | None = None) -> None:
    payload = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if extra:
        payload.update(extra)
    try:
        supabase.from_("public_search_trials").update(payload).eq("id", trial_id).execute()
    except Exception:
        # Trial logging should never break the user-facing response.
        pass



def _sanitize_public_verdict(verdict_details: dict) -> dict:
    """Return a limited public-preview verdict without booking links or pro-only actions."""
    if not isinstance(verdict_details, dict):
        return {}

    safe = dict(verdict_details)
    safe["booking_note"] = "Create an account to unlock booking links, Zoe follow-up, alerts, and full flight options."
    safe["booking_link"] = {
        "seats_aero_link": None,
        "airline_link": None,
        "preferred": "none",
    }
    return safe


def _sanitize_public_award_options(award_options: list[dict]) -> list[dict]:
    """Keep only top-level award summary fields for the public preview."""
    sanitized = []
    for award in (award_options or [])[:3]:
        sanitized.append({
            "program": award.get("program"),
            "points": award.get("points"),
            "taxes": award.get("taxes"),
            "cpp": award.get("cpp"),
            "remaining_seats": award.get("remaining_seats"),
            "direct": award.get("direct"),
            "airlines": award.get("airlines", ""),
        })
    return sanitized

@router.post("/public-search")
@limiter.limit("6/minute")
async def public_search(
    request: Request,
    params: SearchParams = Depends(get_search_params),
):
    """
    One-time unauthenticated search for the public landing page.
    Uses the same search/verdict services as /api/search, but enforces a
    one-search-per-IP-hash gate via public_search_trials.
    """
    origin = params.origin
    destination = params.destination
    departure_date = params.date
    departure_date_end = params.date_end
    cabin = params.cabin.value
    travelers = params.travelers
    return_date = params.return_date
    max_stops = params.max_stops.value

    supabase = get_server_supabase()
    trial_id = _claim_public_search_trial(supabase, request, params)

    try:
        # Guest users do not have a saved wallet yet, so award source filtering is broad.
        user_programs: list[str] = []
        user_cards: list[str] = []

        # Keep cache lookup parity with authenticated search.
        cache_params: CacheSearchParams = {
            "origin": origin,
            "destination": destination,
            "departure_date": departure_date,
            "departure_date_end": departure_date_end,
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

        async def outbound_task():
            raw = await search_award_availability(origin, destination, departure_date, cabin, max_stops=max_stops)
            return [a for a in raw if a.get("remaining_seats", 0) >= travelers]

        async def return_task():
            if not return_date:
                return []
            raw = await search_award_availability(destination, origin, return_date, cabin, max_stops=max_stops)
            return [a for a in raw if a.get("remaining_seats", 0) >= travelers]

        outbound_awards, cash_data, return_awards = await asyncio.gather(
            outbound_task(),
            get_cash_price(origin, destination, departure_date, cabin, travelers, return_date, max_stops=max_stops),
            return_task(),
        )

        cash_price = cash_data.get("cash_price")

        outbound_dates = [a.get("date") for a in outbound_awards if a.get("date")]
        return_dates = [a.get("date") for a in return_awards if a.get("date")]
        cash_out_by_date, cash_ret_by_date = await asyncio.gather(
            sample_cash_prices_by_date(
                origin, destination, outbound_dates, cabin, travelers, max_stops=max_stops
            ),
            sample_cash_prices_by_date(
                destination, origin, return_dates, cabin, travelers, max_stops=max_stops
            ),
        )

        award_options = _build_award_options_with_per_date_cash(
            outbound_awards, cash_out_by_date, include_endpoint_airports=True
        )
        return_award_options = _build_award_options_with_per_date_cash(
            return_awards, cash_ret_by_date, include_endpoint_airports=True
        )

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

        public_verdict = _sanitize_public_verdict(verdict_details)
        public_award_options = _sanitize_public_award_options(award_options)
        public_return_award_options = _sanitize_public_award_options(return_award_options)

        response_payload = {
            "search_id": None,
            "verdict_id": None,
            "public_trial_id": trial_id,
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
            "flights": [],
            "award_options": public_award_options,
            "return_award_options": public_return_award_options,
            "verdict": public_verdict,
            "user_programs": user_programs,
            "user_cards": user_cards,
            "limited_public_preview": True,
        }

        _update_public_trial(
            supabase,
            trial_id,
            "completed",
            {
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "response_summary": {
                    "cash_price": cash_price,
                    "price_level": cash_data.get("price_level"),
                    "recommendation": verdict_details.get("recommendation") if isinstance(verdict_details, dict) else None,
                    "verdict": verdict_details.get("verdict") if isinstance(verdict_details, dict) else None,
                    "flight_count": len(cash_data.get("flights", []) or []),
                    "award_option_count": len(award_options),
                    "return_award_option_count": len(return_award_options),
                },
            },
        )
        return response_payload

    except HTTPException as exc:
        _update_public_trial(supabase, trial_id, "failed", {"error_message": str(exc.detail)})
        raise
    except Exception as exc:
        _update_public_trial(supabase, trial_id, "failed", {"error_message": str(exc)[:500]})
        raise HTTPException(status_code=500, detail="Public search failed. Please try again or create an account to continue.")
