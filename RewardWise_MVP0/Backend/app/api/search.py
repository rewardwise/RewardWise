import asyncio
from typing import Optional, TypedDict
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from app.api.validators import SearchParams, limiter  # RW-047
from app.cache import find_search_verdict_in_db, get_search_memory_cache
from app.cache.payload_cache import get_cached_payload, put_cached_payload
from app.cache.types import SearchParams as CacheSearchParams
from app.db import get_server_supabase, insert_one, insert_one_return_id
from app.services.cash_sampler import sample_cash_prices_by_date
from app.services.pair_ranker import rank_pairs
from app.services.pricing_service import get_cash_price
from app.services.seats_service import search_award_availability
from app.services.verdict_service import compute_ownership, generate_verdict  # RW-VerdictGenerator
from app.utils.math_utils import calculate_cpp
from app.program_aliases import PROGRAM_ALIASES
import hashlib
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
    # brand -> summed points balance (e.g. {"Chase Ultimate Rewards": 80000}).
    # Feeds the per-request ownership fork (verdict_service.compute_ownership);
    # never cached with the verdict since it is per-user.
    balances: dict[str, int]


AWARD_TAXES_SANITY_USD = 3000  # max realistic carrier surcharge is ~$2k


def _make_award_cleaner(travelers: int):
    """Ingestion-time award hygiene. Provider junk exists in the wild: a delta
    row with $14,300 "taxes" (cents field) and byte-identical duplicate rows
    (observed SEA-NRT business 2026-07-28). cpp scoring already neutralized
    junk for SELECTION, but the rows still rendered to users (a -7.25cpp
    "option") — drop them here instead. Also enforces seats >= travelers."""

    def _clean_awards(raw: list[dict]) -> list[dict]:
        seen: set[tuple] = set()
        out = []
        for a in raw:
            if a.get("remaining_seats", 0) < travelers:
                continue
            if float(a.get("taxes") or 0) > AWARD_TAXES_SANITY_USD * 100:  # cents
                continue
            key = (
                a.get("program"), a.get("points"), a.get("taxes"), a.get("date"),
                a.get("origin_airport"), a.get("destination_airport"),
            )
            if key in seen:
                continue
            seen.add(key)
            out.append(a)
        return out

    return _clean_awards


def _get_user_programs(supabase, user_id: str) -> UserWallet:
    """
    Fetch the user's wallet from Supabase and return three representations:
    - `programs`: seats.aero source slugs the user can redeem via PROGRAM_ALIASES
      reverse-lookup (e.g. ["united", "aeroplan", "delta"])
    - `cards`: raw reward_programs.name brands (e.g. ["Chase Ultimate Rewards",
      "Amex Membership Rewards"])
    - `balances`: brand -> summed points balance, for the ownership fork's
      transfer-reachability + shortfall math (compute_ownership).
    All are needed downstream: `programs` for award-source filtering, `cards`
    for wallet-reachability checks against TRANSFER_PARTNERS[slug].sourceCard
    which is a brand string, not a slug, and `balances` for "do you actually
    hold enough points to book this" / "are you short".
    Returns empty wallet on any error so the search never hard-fails.
    """
    try:
        resp = (
            supabase
            .from_("cards")
            .select("points_balance, reward_programs(name)")
            .eq("user_id", user_id)
            .execute()
        )
        owned_program_names: list[str] = []
        balances: dict[str, int] = {}
        for row in (resp.data or []):
            program = row.get("reward_programs")
            if not program:
                continue
            name = program["name"]
            owned_program_names.append(name)
            balances[name] = balances.get(name, 0) + int(row.get("points_balance") or 0)
        programs = [
            source
            for source, aliases in PROGRAM_ALIASES.items()
            if any(alias in owned_program_names for alias in aliases)
        ]
        return {"programs": programs, "cards": owned_program_names, "balances": balances}
    except Exception:
        return {"programs": [], "cards": [], "balances": {}}


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
    user_balances = wallet.get("balances", {})

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

    # 1. SHARED payload cache (params-keyed, 30-min, user-agnostic): a hit
    #    skips ALL provider calls; per-user verdict recomputes on top.
    provider_payload = get_cached_payload(supabase, cache_params)

    # 2. SAME-USER verdict reuse (L1 memory / L2 Supabase). User-scoped since
    #    2026-07-28: wallet-fit selection makes verdicts wallet-dependent, so
    #    cross-user reuse served user B a winner picked for user A's wallet.
    try:
        cached_payload = memory_cache.get(cache_params, user_id)
    except Exception:
        cached_payload = None

    if cached_payload:
        cached_verdict_row = cached_payload.get("verdict") or None
    else:
        try:
            db_hit = find_search_verdict_in_db(supabase, cache_params, user_id)
            if db_hit:
                cached_verdict_row = db_hit.verdict
                try:
                    memory_cache.set(
                        cache_params,
                        search_id=str(db_hit.search["id"]),
                        verdict=db_hit.verdict,
                        user_id=user_id,
                    )
                except Exception as exc:
                    print(f"l1_cache set failed (non-fatal): {str(exc)[:120]}")
        except Exception as exc:
            # The INNER function logs query errors itself; this catches crashes
            # in the call/plumbing. Never let it read as a silent miss — a bare
            # version of this except hid a 100% L2 failure (2026-07-28).
            print(f"l2_cache lookup crashed (treating as miss): {str(exc)[:160]}")
            cached_verdict_row = None

    if cached_verdict_row and cached_verdict_row.get("details"):
        cached_verdict_details = cached_verdict_row["details"]

    # --- Parallel fetch ---
    _clean_awards = _make_award_cleaner(travelers)

    async def outbound_task():
        raw = await search_award_availability(
            origin,
            destination,
            departure_date,
            cabin,
            end_date=departure_date_end,
            max_stops=max_stops,
        )
        return _clean_awards(raw)

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
        return _clean_awards(raw)

    if provider_payload is not None:
        # Payload-cache hit: ZERO provider calls. Cash + awards + samplers all
        # come from the cached fetch (<=30 min old, shared across users).
        outbound_awards = provider_payload.get("outbound_awards") or []
        return_awards = provider_payload.get("return_awards") or []
        cash_data = provider_payload.get("cash_data") or {}
    else:
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
    if provider_payload is not None:
        cash_out_by_date = provider_payload.get("cash_out_by_date") or {}
        cash_ret_by_date = provider_payload.get("cash_ret_by_date") or {}
    else:
        cash_out_by_date, cash_ret_by_date = await asyncio.gather(
            sample_cash_prices_by_date(
                origin, destination, outbound_dates, cabin, travelers, max_stops=max_stops
            ),
            sample_cash_prices_by_date(
                destination, origin, return_dates, cabin, travelers, max_stops=max_stops
            ),
        )
        # Populate the shared payload cache for the next searcher (any user) —
        # but NEVER cache a cash-failed fetch (quota/outage): that serves the
        # outage to every repeat searcher for 30 minutes, including searches
        # made AFTER the provider recovers (2026-07-29: failed pre-warm runs
        # poisoned the demo routes with null-cash payloads).
        if cash_data.get("cash_price") is not None:
            put_cached_payload(supabase, cache_params, {
                "cash_data": cash_data,
                "outbound_awards": outbound_awards,
                "return_awards": return_awards,
                "cash_out_by_date": cash_out_by_date,
                "cash_ret_by_date": cash_ret_by_date,
            })
        else:
            print("payload_cache SKIP_WRITE (cash unavailable — not caching a failed fetch)")

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

    # --- 1-seat refetch dial (payload-cache hits only, operator-approved) ---
    # A cached award with remaining_seats == 1 is the row most likely to be
    # stale-wrong ("you can book this" on a seat someone just took). When the
    # SELECTED winner (either leg) is a 1-seater from cache, refetch just the
    # award legs fresh and re-select; cash stays cached.
    def _winner_seats(winner: dict | None, options: list[dict]) -> int | None:
        if not winner:
            return None
        for a in options:
            if (
                a.get("program") == winner.get("program")
                and a.get("points") == winner.get("points")
                and (winner.get("date") is None or a.get("date") == winner.get("date"))
            ):
                seats = a.get("remaining_seats")
                return int(seats) if seats is not None else None
        return None

    if provider_payload is not None:
        w_seats = _winner_seats((verdict_details or {}).get("winner"), award_options)
        rw_seats = _winner_seats((verdict_details or {}).get("return_winner"), return_award_options)
        if w_seats == 1 or rw_seats == 1:
            print(f"payload_cache 1seat_refetch: winner seats={w_seats} return_seats={rw_seats} — refreshing award legs (cash stays cached)")
            outbound_awards, return_awards = await asyncio.gather(outbound_task(), return_task())
            outbound_dates = [a.get("date") for a in outbound_awards if a.get("date")]
            return_dates = [a.get("date") for a in return_awards if a.get("date")]
            # Samplers run cache_first — dates already priced in the last 30
            # minutes serve from the cash cache, so the cash side stays cached.
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
            if award_options:
                winning_date = award_options[0].get("date")
            if return_award_options:
                winning_return_date = return_award_options[0].get("date")
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
            memory_cache.set(cache_params, search_id=search_id, verdict=inserted_verdict, user_id=user_id)
        except Exception as exc:
            print(f"l1_cache post-compute set failed (non-fatal): {str(exc)[:120]}")

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Supabase insert error (searches/verdicts): {getattr(e, 'details', str(e))}",
        )

    # Per-request ownership fork. Computed from the LIVE wallet and attached to
    # the RESPONSE only — never to verdict_details (which is persisted + shared
    # via memory_cache across users; ownership is per-user). compute_ownership
    # returns None unless this is a use_points verdict the user could (or can't)
    # actually afford.
    verdict_response = verdict_details
    if isinstance(verdict_details, dict):
        verdict_response = {
            **verdict_details,
            "ownership": compute_ownership(verdict_details, user_balances),
        }

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
        "cash_google_flights_url": cash_data.get("google_flights_url"),
        "price_level": cash_data.get("price_level"),
        "typical_price_range": cash_data.get("typical_price_range"),
        "flights": cash_data.get("flights", []),
        "award_options": award_options,
        "return_award_options": return_award_options,
        "verdict": verdict_response,
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
# Lazy return-flight details (display-only)
# ---------------------------------------------------------------------------
# Round-trip SerpAPI results carry return legs only via a second request keyed
# by the outbound's departure_token. Fetched lazily on To-Flight tab click so
# baseline search latency is untouched. Auth-gated (protects SerpAPI quota);
# never feeds verdict math.

@router.post("/return-flight")
@limiter.limit("20/minute")
async def return_flight_details(
    request: Request,
    origin: str = Query(...),
    destination: str = Query(...),
    date: str = Query(...),
    return_date: str = Query(...),
    departure_token: str = Query(...),
    cabin: str = Query(default="economy"),
    travelers: int = Query(default=1),
):
    auth_header = request.headers.get("authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    token = auth_header.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SERVICE_KEY},
        )
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    from app.services.flight_pricing.serpapi_provider import get_serpapi_return_flights

    info = await get_serpapi_return_flights(
        origin=origin,
        destination=destination,
        date=date,
        return_date=return_date,
        departure_token=departure_token,
        cabin=cabin,
        travelers=travelers,
    )
    return {"return_flight": info}


# ---------------------------------------------------------------------------
# Shared IP-hash helpers (used by the newsletter dedupe; the guest public-search
# flow that originally introduced them was removed).
# ---------------------------------------------------------------------------
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
