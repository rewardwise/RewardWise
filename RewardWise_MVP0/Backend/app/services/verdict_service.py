import logging
import os
from datetime import date as date_cls, timedelta
from typing import Optional
from urllib.parse import urlencode

# Re-exported so callers/tests can reach the deterministic ownership fork via the
# verdict engine module. Implementation lives in ownership.py (it must run
# per-request outside the shared verdict cache — see that module's docstring).
from app.services.ownership import compute_ownership  # noqa: F401

logger = logging.getLogger(__name__)

CPP_PAY_CASH_THRESHOLD = 1.25
CPP_GRAY_ZONE_MIDPOINT = 1.5
CPP_USE_POINTS_STRONG_THRESHOLD = 1.8
CHEAP_CASH_THRESHOLD_USD = 250

# Tier explanation copy is rendered verbatim by the frontend. Any wording
# change here is a user-visible change. Avoid the words "redemption", "cents
# per point", and "cpp" — the ELI5 ribbon stays plain English.
TIER_EXPLANATION_PREMIUM = (
    "This is one of the best uses of your points for this trip — strong value, "
    "book if you're ready."
)
TIER_EXPLANATION_SOLID = (
    "Your points stretch further than cash here, but it's not a top-tier "
    "redemption. Worth doing if you want to preserve cash."
)
TIER_EXPLANATION_MARGINAL = (
    "Barely better than cash. Consider waiting for a stronger date or "
    "comparing other routes."
)


def _classify_tier(cpp: Optional[float]) -> tuple[Optional[str], Optional[str]]:
    """Return (verdict_tier, tier_explanation) for a use_points verdict.

    Bands mirror the cpp thresholds above. Callers gate on recommendation —
    this helper only computes the cpp-band label.
    """
    if cpp is None:
        return None, None
    if cpp >= CPP_USE_POINTS_STRONG_THRESHOLD:
        return "premium", TIER_EXPLANATION_PREMIUM
    if cpp >= CPP_GRAY_ZONE_MIDPOINT:
        return "solid", TIER_EXPLANATION_SOLID
    if cpp >= CPP_PAY_CASH_THRESHOLD:
        return "marginal", TIER_EXPLANATION_MARGINAL
    return None, None

# Mirrors Frontend/utils/dateInput.ts DEFAULT_CASH_HORIZON_DAYS = 329
# (SerpAPI / Google Flights GDS bound, established in PR #140). Past this
# horizon, cash providers legitimately return no data; within it, an empty
# cash_price indicates an upstream failure (quota, timeout, route gap).
# Overridable via env so backend + frontend can be tuned together if the
# provider bound shifts.
CASH_HORIZON_DAYS = int(os.environ.get("CASH_HORIZON_DAYS", "329"))

PROGRAM_URL_OVERRIDES = {
    "american": "https://www.aa.com/",
    "aeroplan": "https://www.aircanada.com/",
    "velocity": "https://www.virginaustralia.com/",
    "lifemiles": "https://www.lifemiles.com/",
    "smiles": "https://www.smiles.com.br/",
    "singapore": "https://www.singaporeair.com/",
    "cathay": "https://www.cathaypacific.com/",
    "qatar": "https://www.qatarairways.com/",
    "turkish": "https://www.turkishairlines.com/",
    "ethiopian": "https://www.ethiopianairlines.com/",
    "alaska": "https://www.alaskaair.com/",
    "ana": "https://www.ana.co.jp/",
}


def _get_airline_url(program: str) -> str:
    name = (program or "").lower().strip()
    if name in PROGRAM_URL_OVERRIDES:
        return PROGRAM_URL_OVERRIDES[name]
    return f"https://www.{name}.com/" if name else "https://www.google.com/travel/flights"


def _get_booking_link(program: Optional[str], trip_ids: list) -> dict:
    airline_url = _get_airline_url(program or "")
    return {
        "seats_aero_link": None,
        "airline_link": airline_url,
        "preferred": "airline" if program else "none",
    }


def _united_url(
    *,
    origin: str,
    destination: str,
    depart_date: str,
    return_date: Optional[str],
    travelers: int,
    is_award: bool,
) -> str:
    """Build United search-results URL for cash or award handoff.

    Cash: omits `at` and `rm`; sets tqp=R.
    Award: at=1, rm=1, tqp=A. Anonymous users redirect to login with params
           preserved; logged-in users see award inventory directly.

    Round-trip: includes r, includes newHP=True, omits tt, sc has comma form.
    One-way: omits r, omits newHP, sets tt=1, sc has single value.

    Cabin: hard-coded to economy (sc=7). Cabin pass-through deferred.
    """
    base = "https://www.united.com/en/us/fsr/choose-flights"
    is_roundtrip = return_date is not None

    params: dict[str, str] = {
        "f": origin.upper(),
        "t": destination.upper(),
        "d": depart_date,
        "px": str(travelers),
        "taxng": "1",
        "clm": "7",
        "st": "bestmatches",
        "tqp": "A" if is_award else "R",
    }

    if is_roundtrip:
        params["r"] = return_date  # type: ignore[assignment]
        params["sc"] = "7,7"
        params["newHP"] = "True"
    else:
        params["sc"] = "7"
        params["tt"] = "1"

    if is_award:
        params["at"] = "1"
        params["rm"] = "1"

    return f"{base}?{urlencode(params)}"


def _get_booking_link_for_verdict(
    program: Optional[str],
    trip_ids: list,
    *,
    origin: Optional[str],
    destination: Optional[str],
    depart_date: Optional[str],
    return_date: Optional[str],
    travelers: Optional[int],
    recommendation: str,
) -> dict:
    """Return booking_link dict, using templated URL when program is deep-linkable.

    Currently templated: United (cash + award). All other programs fall through
    to homepage handoff via the existing _get_booking_link.

    Extending to more programs: add cases here, do NOT modify _get_booking_link.
    """
    if (
        program
        and program.lower().strip() == "united"
        and recommendation in {"pay_cash", "use_points"}
        and origin
        and destination
        and depart_date
        and travelers
    ):
        return {
            "seats_aero_link": None,
            "airline_link": _united_url(
                origin=origin,
                destination=destination,
                depart_date=depart_date,
                return_date=return_date,
                travelers=travelers,
                is_award=(recommendation == "use_points"),
            ),
            "preferred": "airline",
        }
    return _get_booking_link(program, trip_ids)


def _is_past_cash_horizon(depart_date: str, today: Optional[date_cls] = None) -> bool:
    """True if depart_date is beyond the cash-provider GDS horizon.

    Used to distinguish legitimate-horizon cash absences from upstream provider
    failures (quota, timeout, route gap), so the UI can render cause-aware copy
    instead of always blaming the user's date. Unparseable dates return False —
    the safer default is to treat them as upstream so we don't lie about a
    horizon cause we couldn't actually confirm.
    """
    try:
        depart = date_cls.fromisoformat(depart_date)
    except (TypeError, ValueError):
        return False
    today = today or date_cls.today()
    return depart > today + timedelta(days=CASH_HORIZON_DAYS)


def _fmt(name: str) -> str:
    return (name or "").replace("_", " ").title()


def _cash_label(cash_price: Optional[float]) -> str:
    return f"${cash_price:.0f}" if cash_price is not None else "cash unavailable"


def _pick_inbound_winner(
    outbound_winner: Optional[dict], return_awards: Optional[list]
) -> Optional[dict]:
    """Return the inbound award that matches the outbound winner's program.

    Used to honestly cost a round-trip redemption: seats.aero awards are one-way
    per pax, so the true RT cost is outbound + return points (both per pax).
    Picking the program-matched inbound preserves the user-bookable assumption —
    you can't mix programs on a single award itinerary. When no program-matched
    return is available, fall back to one-way costing (return = None) rather
    than silently swapping in an unbookable cross-program return.
    """
    if not outbound_winner or not return_awards:
        return None
    program = (outbound_winner.get("program") or "").lower()
    if not program:
        return None
    for award in return_awards:
        if (award.get("program") or "").lower() == program:
            return award
    return None


def _pick_costing_inbound(return_awards: Optional[list]) -> Optional[dict]:
    """Best ANY-program return award, for honest full-trip costing.

    Awards here are separate one-way bookings — the product's How-to-book
    explicitly instructs booking each leg on its own program — so a
    cross-program return is bookable reality, not an unbookable synthetic.
    Used when no same-program return exists: the old behavior costed the
    round trip with OUTBOUND-ONLY points against the FULL round-trip cash,
    inflating cpp ~2x and flipping verdicts to use_points that honest math
    calls pay_cash (replay: >=1 in 6 of all use_points verdicts — a floor).
    """
    if not return_awards:
        return None
    return min(
        (a for a in return_awards if a.get("points")),
        key=lambda a: (int(a.get("points") or 0), float(a.get("taxes") or 0)),
        default=None,
    )


def _matched_cpp(
    cash_price: Optional[float],
    outbound_points: int,
    outbound_taxes: float,
    inbound_winner: Optional[dict],
    travelers: int,
    is_roundtrip: bool = False,
) -> Optional[float]:
    """Full-booking cents-per-point: (cash − total taxes) / total points × 100.

    Scope: all travelers, both legs when a matched-program return award exists,
    outbound-only when there is no matched return (one-way fallback). This is
    the number the user actually experiences — winner.cpp on the seats.aero
    object is per-pax / per-leg and biases the scope by `legs × travelers`.

    Returns None when the math is undefined (no cash price, or zero points).
    """
    if cash_price is None:
        return None
    travelers = max(int(travelers or 1), 1)
    return_points = int((inbound_winner or {}).get("points") or 0)
    return_taxes = float((inbound_winner or {}).get("taxes") or 0)
    points_per_pax = int(outbound_points or 0) + return_points
    if points_per_pax <= 0:
        return None
    # Round trip with NO return award at all: cost the outbound award against
    # HALF the round-trip fare. The old behavior divided the FULL round-trip
    # cash by outbound-only points, inflating cpp ~2x (the fallback bug).
    effective_cash = float(cash_price)
    if is_roundtrip and not inbound_winner:
        effective_cash = effective_cash / 2.0
    total_points = points_per_pax * travelers
    total_taxes = (float(outbound_taxes or 0) + return_taxes) * travelers
    return round((effective_cash - total_taxes) / total_points * 100, 4)


def _display_award_totals(
    outbound_points: int,
    outbound_taxes: float,
    inbound_winner: Optional[dict],
    travelers: int,
) -> tuple[int, float]:
    """Matched-scope TOTAL points and taxes for display copy.

    The explanation strings compare against the full-trip cash price, so the
    award side must be the same basis (both legs when a matched return exists,
    all travelers) — winner.points/taxes alone are per-leg per-pax and made the
    one-liner mix bases ("$217 round-trip cash vs 16,100 one-way points").
    Copy-only: gates/thresholds already use _matched_cpp and are unchanged.
    """
    t = max(int(travelers or 1), 1)
    return_points = int((inbound_winner or {}).get("points") or 0)
    return_taxes = float((inbound_winner or {}).get("taxes") or 0)
    total_points = (int(outbound_points or 0) + return_points) * t
    total_taxes = (float(outbound_taxes or 0) + return_taxes) * t
    return total_points, total_taxes


def _metrics(
    cash_price: Optional[float],
    winner: Optional[dict],
    inbound_winner: Optional[dict] = None,
    travelers: int = 1,
    is_roundtrip: bool = False,
) -> dict:
    """Grand-total, matched-scope verdict metrics.

    Every numeric field below is the FULL BOOKING total — all travelers, both
    legs when round-trip (just outbound when one-way). This is the scope users
    see in the cash fare from the provider and the scope they care about for
    "what does this redemption actually cost me." Specifically:

        points_cost                = (outbound + return) × travelers
        points_cost_per_traveler   = (outbound + return)
        taxes                      = (outbound + return) × travelers
        cpp                        = (cash − taxes) / points_cost × 100

    The cpp here is matched-scope, so cpp × points_cost / 100 ≈ savings
    reconciles cleanly. This replaces the prior implementation that copied
    `winner.cpp` (one-way per-pax score) into metrics — that bias rendered
    multi-traveler RT verdicts as e.g. "237k pts / 4.01¢" when the honest
    numbers are "474k pts / 2.00¢".

    `winner.cpp` (the per-pax one-way score on the award object) is still
    used by the recommendation gates in generate_verdict and remains
    untouched on the winner payload for back-compat. See the comment block
    at the first recommendation gate for the known bias and the follow-up
    PR that re-scopes the gate logic.
    """
    winner = winner or {}
    travelers = max(int(travelers or 1), 1)

    outbound_points_per_pax = int(winner.get("points") or 0)
    return_points_per_pax = int((inbound_winner or {}).get("points") or 0)
    points_per_pax_rt = outbound_points_per_pax + return_points_per_pax

    outbound_taxes = float(winner.get("taxes") or 0)
    return_taxes = float((inbound_winner or {}).get("taxes") or 0)
    taxes = round((outbound_taxes + return_taxes) * travelers, 2)

    points_cost: Optional[int] = (
        points_per_pax_rt * travelers if points_per_pax_rt > 0 else None
    )
    points_cost_per_traveler: Optional[int] = (
        points_per_pax_rt if points_per_pax_rt > 0 else None
    )

    cpp: Optional[float] = _matched_cpp(
        cash_price, outbound_points_per_pax, outbound_taxes, inbound_winner, travelers,
        is_roundtrip=is_roundtrip,
    )
    # Scope of every figure in this dict. cash/2 is an ESTIMATE with a known
    # asymmetry: conservative for the verdict (understates cpp -> biases
    # pay_cash, safe) but OPTIMISTIC for the user's out-of-pocket return cost
    # (one-way fares routinely exceed half the round trip) — display copy must
    # hedge it even though the verdict math needn't.
    scope = (
        "outbound_only" if (is_roundtrip and not inbound_winner)
        else ("round_trip" if is_roundtrip else "one_way")
    )
    comparison_cash: Optional[float] = None
    savings: Optional[float] = None
    if cash_price is not None:
        effective_cash = float(cash_price)
        if scope == "outbound_only":
            effective_cash = effective_cash / 2.0
        comparison_cash = round(effective_cash, 2)
        savings = max(0.0, round(effective_cash - taxes, 2))
    return {
        "cash_price": cash_price,
        "scope": scope,
        "comparison_cash": comparison_cash,
        "points_cost": points_cost,
        "points_cost_per_traveler": points_cost_per_traveler,
        "travelers": travelers,
        "taxes": taxes,
        "cpp": cpp,
        "estimated_savings": savings,
    }


def _build_next_step(
    recommendation: str,
    origin: str,
    destination: str,
    cabin: str,
    *,
    cpp: Optional[float] = None,
    cash_price: Optional[float] = None,
    remaining_seats: int = 0,
    urgency: bool = False,
    program_label: Optional[str] = None,
    data_quality: str = "full",
) -> Optional[dict]:
    """Build next-step suggestion or return None when verdict is its own answer.

    Returns None aggressively, better to say nothing than say something generic.
    """
    program = program_label or "the airline"
    cabin_lower = (cabin or "economy").lower()
    is_premium = cabin_lower in {"premium_economy", "business", "first"}

    if recommendation == "use_points":
        if urgency and remaining_seats > 0:
            seat_word = "seat" if remaining_seats == 1 else "seats"
            return {
                "label": f"Book now, only {remaining_seats} {seat_word} left",
                "prompt": f"Lock this in on {program} before someone else grabs it.",
            }
        return None

    if recommendation == "pay_cash":
        if cabin_lower == "economy" and cash_price is not None and cash_price <= 250:
            return None
        if is_premium and cpp is not None and cpp < 1.25:
            return {
                "label": "There's probably a better deal",
                "prompt": "Premium awards usually beat this. Check a different date or another airline program.",
            }
        if cabin_lower == "economy" and cpp is not None and cpp < 1.25:
            return {
                "label": "Save your points for a bigger trip",
                "prompt": "Your points stretch further on premium cabins or long-haul flights. Hold off on this one.",
            }
        return None

    if recommendation == "wait":
        if data_quality != "full":
            return {
                "label": "Try the search again",
                "prompt": "Live pricing came back thin. Running it again usually surfaces a real fare.",
            }
        if cpp is not None:
            return {
                "label": "Worth checking nearby dates",
                "prompt": f"{program} at {cpp:.1f}¢/pt is okay, not great. A few days either side often turns up better availability.",
            }

    return {
        "label": "Try different dates",
        "prompt": "Nearby dates often turn up better options.",
    }


def _base_response(
    *,
    recommendation: str,
    verdict_label: str,
    headline: str,
    explanation: str,
    confidence: str,
    confidence_reason: str,
    booking_note: str,
    booking_link: Optional[dict] = None,
    winner: Optional[dict] = None,
    inbound_winner: Optional[dict] = None,
    travelers: int = 1,
    cash_price: Optional[float] = None,
    data_quality: str = "full",
    missing_sources: Optional[list] = None,
    safe_fallback_used: bool = False,
    next_step: Optional[dict] = None,
    is_roundtrip: bool = False,
) -> dict:
    missing_sources = missing_sources or []
    winner = winner or None
    booking_link = booking_link or {
        "seats_aero_link": None,
        "airline_link": None,
        "preferred": "none",
    }
    pay_cash = recommendation == "pay_cash"
    verdict = f"{verdict_label}: {headline} {explanation}".strip()
    metrics = _metrics(cash_price, winner, inbound_winner, travelers, is_roundtrip=is_roundtrip)
    # Tier badge is driven by the matched-scope cpp on metrics, not by
    # winner.cpp. winner.cpp is one-way per-pax and overstates the
    # redemption rate on multi-traveler / round-trip searches.
    verdict_tier: Optional[str] = None
    tier_explanation: Optional[str] = None
    if recommendation == "use_points" and winner is not None:
        verdict_tier, tier_explanation = _classify_tier(metrics.get("cpp"))
    return {
        "recommendation": recommendation,
        "verdict_label": verdict_label,
        "headline": headline,
        "explanation": explanation,
        "verdict": verdict,
        "winner": winner,
        "pay_cash": pay_cash,
        "confidence": confidence,
        "confidence_reason": confidence_reason,
        "booking_note": booking_note,
        "booking_link": booking_link,
        "data_quality": data_quality,
        "missing_sources": missing_sources,
        "safe_fallback_used": safe_fallback_used,
        "metrics": metrics,
        "next_step": next_step,
        "verdict_tier": verdict_tier,
        "tier_explanation": tier_explanation,
    }


def _choose_candidate(award_options: list, user_programs: Optional[list]) -> tuple[list, list]:
    if not award_options:
        return [], []
    if not user_programs:
        return award_options, award_options
    user_lower = [p.lower() for p in user_programs]
    user_picks = [a for a in award_options if a.get("program", "").lower() in user_lower]
    return user_picks, award_options


def _gray_zone_response(
    *,
    recommendation: str,
    program: Optional[str],
    program_label: str,
    points: int,
    cpp: float,
    cash_price: float,
    trip_ids: list,
    display_origin: str,
    display_destination: str,
    winner_origin: str,
    winner_destination: str,
    date: str,
    return_date: Optional[str],
    travelers: int,
    winner_payload: dict,
    inbound_winner: Optional[dict],
    data_quality: str,
    missing_sources: list,
    is_roundtrip: bool = False,
) -> dict:
    """Build the gray-zone (1.25 <= cpp < 1.8) response for pay_cash or use_points.

    Gray-zone next_step is None per product decision; headline + explanation carry
    the framing.
    """
    cash_label = _cash_label(cash_price)
    display_points, _display_taxes_unused = _display_award_totals(
        points, 0, inbound_winner, travelers
    )
    trip_basis = "for the whole trip" if inbound_winner else "for the outbound leg"
    if recommendation == "pay_cash":
        verdict_label = "Pay Cash"
        headline = "Pay cash. Save your points for a stronger redemption."
        explanation = (
            f"I found {program_label} at {display_points:,} points {trip_basis} versus {cash_label} cash for the round trip."
            f" At {cpp:.2f}¢/pt, the award value here is below the threshold where points typically beat cash."
            " Paying cash preserves your points for a higher-value redemption on a different trip."
        )
        confidence_reason = (
            "Both cash and award data were found. The award value is below the 1.5¢/pt"
            " threshold where points usually outperform cash."
        )
        booking_note = "Pay cash and keep your points for a higher-value redemption."
        booking_origin = display_origin
        booking_destination = display_destination
    else:
        verdict_label = "Use Points"
        headline = "Use points. Better than paying cash, though not the strongest redemption."
        explanation = (
            f"I found {program_label} at {display_points:,} points {trip_basis} versus {cash_label} cash for the round trip."
            f" At {cpp:.2f}¢/pt, this beats paying cash, but it is not at premium-redemption levels."
            " If you have flexibility, you might find better value on a different route or date."
        )
        confidence_reason = (
            "Both cash and award data were found. The award value is above the 1.5¢/pt"
            " threshold, but not at the premium-redemption range."
        )
        booking_note = f"Verify the award on {program_label}'s site before you transfer any points."
        booking_origin = winner_origin
        booking_destination = winner_destination

    return _base_response(
        recommendation=recommendation,
        verdict_label=verdict_label,
        headline=headline,
        explanation=explanation,
        confidence="medium",
        confidence_reason=confidence_reason,
        booking_note=booking_note,
        booking_link=_get_booking_link_for_verdict(
            program,
            trip_ids,
            origin=booking_origin,
            destination=booking_destination,
            depart_date=date,
            return_date=return_date,
            travelers=travelers,
            recommendation=recommendation,
        ),
        winner=winner_payload,
        inbound_winner=inbound_winner,
        is_roundtrip=is_roundtrip,
        travelers=travelers,
        cash_price=cash_price,
        data_quality=data_quality,
        missing_sources=missing_sources,
        safe_fallback_used=bool(missing_sources),
        next_step=None,
    )


async def generate_verdict(
    origin: str,
    destination: str,
    date: str,
    cabin: str,
    travelers: int,
    is_roundtrip: bool,
    return_date: Optional[str],
    cash_price: Optional[float],
    award_options: list,
    return_award_options: list,
    user_programs: Optional[list] = None,
) -> dict:
    # When origin/destination came in as a metro CSV (e.g. "JFK,LGA,EWR"),
    # use the first airport as a fallback for prompts that need a single code,
    # and prefer the actual winning award's airport once we have a winner.
    is_metro_origin = "," in origin
    is_metro_destination = "," in destination
    display_origin = origin.split(",")[0]
    display_destination = destination.split(",")[0]

    candidates, all_awards = _choose_candidate(award_options, user_programs)
    missing_sources: list[str] = []
    if cash_price is None:
        missing_sources.append("cash_price")
    if not all_awards:
        missing_sources.append("award_space")

    data_quality = "full"
    if len(missing_sources) == 2:
        data_quality = (
            "missing_both_horizon"
            if _is_past_cash_horizon(date)
            else "missing_both_upstream"
        )
    elif missing_sources == ["cash_price"]:
        data_quality = (
            "missing_cash_horizon"
            if _is_past_cash_horizon(date)
            else "missing_cash_upstream"
        )
    elif missing_sources == ["award_space"]:
        data_quality = "missing_awards"
    elif missing_sources:
        data_quality = "partial"

    # No usable data at all.
    if cash_price is None and not all_awards:
        response = _base_response(
            recommendation="wait",
            verdict_label="Wait",
            headline="I do not have enough live data to make a safe call yet.",
            explanation="I could not confirm either live cash pricing or award availability for this route, so the safest move is to wait or retry the search.",
            confidence="low",
            confidence_reason="Both the cash and award data sources were unavailable for this search.",
            booking_note="Retry this search in a moment or try a nearby date.",
            cash_price=cash_price,
            travelers=travelers,
            data_quality=data_quality,
            missing_sources=missing_sources,
            safe_fallback_used=True,
            next_step=_build_next_step(
                "wait",
                display_origin,
                display_destination,
                cabin,
                cash_price=cash_price,
                data_quality=data_quality,
            ),
        )
        return response

    # Cash only.
    if cash_price is not None and not all_awards:
        cash_label = _cash_label(cash_price)
        response = _base_response(
            recommendation="pay_cash",
            verdict_label="Pay Cash",
            headline=f"Cash wins here at {cash_label}.",
            explanation="I could not find award availability worth using, so paying cash is the safer move right now.",
            confidence="medium",
            confidence_reason="Live cash pricing was available, but no matching award availability was found.",
            booking_note="Book the cash fare and save your points for a stronger redemption.",
            cash_price=cash_price,
            travelers=travelers,
            data_quality=data_quality,
            missing_sources=missing_sources,
            safe_fallback_used=bool(missing_sources),
            next_step=_build_next_step(
                "pay_cash",
                display_origin,
                display_destination,
                cabin,
                cash_price=cash_price,
                data_quality=data_quality,
            ),
        )
        return response

    # Awards exist but the user's programs do not cover them.
    if all_awards and user_programs and not candidates:
        cash_label = _cash_label(cash_price)
        response = _base_response(
            recommendation="pay_cash" if cash_price is not None else "wait",
            verdict_label="Pay Cash" if cash_price is not None else "Wait",
            headline=(
                f"There is award space, but none of your current programs can book it, so {cash_label} is the cleaner move."
                if cash_price is not None
                else "There is award space, but none of your current programs can book it right now."
            ),
            explanation="You would need a different program or transfer path for the available award space, so this is not a clean points redemption from your wallet.",
            confidence="medium" if cash_price is not None else "low",
            confidence_reason="Award space was found, but not through the user's redeemable programs.",
            booking_note="Keep your points for a route your wallet can actually support.",
            cash_price=cash_price,
            travelers=travelers,
            data_quality=data_quality,
            missing_sources=missing_sources,
            safe_fallback_used=bool(missing_sources),
            next_step=_build_next_step(
                "pay_cash" if cash_price is not None else "wait",
                display_origin,
                display_destination,
                cabin,
                cash_price=cash_price,
                data_quality=data_quality,
            ),
        )
        return response

    # Candidate winner.
    winner = (candidates or all_awards)[0]
    # Round-trip inbound winner: program-matched return award, or None if no
    # match (one-way fallback). Costs the redemption honestly as
    # outbound + return points instead of doubling outbound or dropping return.
    inbound_winner: Optional[dict] = (
        _pick_inbound_winner(winner, return_award_options) if is_roundtrip else None
    )
    # Honest full-trip costing: same-program return when it exists, else the
    # best any-program return (separate one-way bookings are the product's
    # actual booking model). None only when the search has no return awards.
    costing_inbound: Optional[dict] = (
        inbound_winner or (_pick_costing_inbound(return_award_options) if is_roundtrip else None)
    )
    program = winner.get("program") or "unknown"
    points = int(winner.get("points") or 0)
    taxes = float(winner.get("taxes") or 0)
    cpp = float(winner.get("cpp") or 0)
    direct = bool(winner.get("direct", False))
    remaining_seats = int(winner.get("remaining_seats") or 0)
    program_label = _fmt(program)
    trip_ids = winner.get("trip_ids", []) if isinstance(winner, dict) else []
    winner_origin = winner.get("origin_airport") or display_origin
    winner_destination = winner.get("destination_airport") or display_destination
    winner_payload = {
        "origin_airport": winner_origin,
        "destination_airport": winner_destination,
        "program": program,
        "points": points,
        "taxes": taxes,
        "cpp": cpp,
        "direct": direct,
    }

    # Awards only, no cash comparison.
    if cash_price is None:
        wait_pts, _wt = _display_award_totals(points, 0, costing_inbound, travelers)
        wait_basis = "for the whole trip" if costing_inbound else "for the outbound leg"
        response = _base_response(
            recommendation="wait",
            verdict_label="Wait",
            headline=f"{program_label} has award space, but I do not have a live cash fare to compare it against.",
            explanation=f"The best current option I found is {wait_pts:,} points {wait_basis}{' nonstop' if direct else ''}. Without a live cash price, I cannot safely say whether using points beats paying cash.",
            confidence="low",
            confidence_reason="Award availability was found, but live cash pricing was unavailable.",
            booking_note=f"If you want to use points, verify the award on {program_label}'s site before transferring.",
            booking_link=_get_booking_link_for_verdict(
                program,
                trip_ids,
                origin=display_origin,
                destination=display_destination,
                depart_date=date,
                return_date=return_date,
                travelers=travelers,
                recommendation="wait",
            ),
            winner=winner_payload,
            inbound_winner=costing_inbound,
            is_roundtrip=is_roundtrip,
            travelers=travelers,
            cash_price=cash_price,
            data_quality=data_quality,
            missing_sources=missing_sources,
            safe_fallback_used=True,
            next_step=_build_next_step(
                "wait",
                winner_origin,
                winner_destination,
                cabin,
                cpp=cpp,
                cash_price=cash_price,
                remaining_seats=remaining_seats,
                program_label=program_label,
                data_quality=data_quality,
            ),
        )
        return response

    savings = max(0, round(cash_price - taxes, 2))
    urgency = 0 < remaining_seats <= 3

    # Recommendation gates use MATCHED-SCOPE cpp — full-booking cash net of
    # taxes over total points across all travelers and both legs (when a
    # program-matched return exists). winner.cpp from the seats.aero award
    # object is per-pax / per-leg and overstates value by `legs × travelers`,
    # which biased gates toward use_points on multi-traveler RTs (verified by
    # historical replay: 53.5% of legacy use_points verdicts were sub-1.25¢/pt
    # under matched scope). winner.cpp stays on winner_payload (FE per-leg
    # display), but every gate / tier band / confidence / next_step copy
    # downstream reads matched_cpp via the local `cpp` rebind below.
    matched_cpp = _matched_cpp(
        cash_price, points, taxes, costing_inbound, travelers, is_roundtrip=is_roundtrip
    )
    if matched_cpp is not None:
        cpp = matched_cpp

    if cash_price <= CHEAP_CASH_THRESHOLD_USD or cpp < CPP_PAY_CASH_THRESHOLD:
        display_points, display_taxes = _display_award_totals(
            points, taxes, inbound_winner, travelers
        )
        explanation = (
            f"Cash is only {_cash_label(cash_price)} for the whole trip, while the best award"
            f" I found is {display_points:,} points"
            f"{' plus about $' + str(int(round(display_taxes))) + ' in taxes' if display_taxes else ''}"
            " for the same trip. Your points are likely worth more on a different trip."
        )
        response = _base_response(
            recommendation="pay_cash",
            verdict_label="Pay Cash",
            headline=f"Cash wins here at {_cash_label(cash_price)}.",
            explanation=explanation,
            confidence="high" if cpp < 1.0 or cash_price <= 200 else "medium",
            confidence_reason="Live cash pricing is low relative to the best award option available.",
            booking_note="Pay cash and keep your points for a higher-value redemption.",
            booking_link=_get_booking_link_for_verdict(
                program,
                trip_ids,
                origin=display_origin,
                destination=display_destination,
                depart_date=date,
                return_date=return_date,
                travelers=travelers,
                recommendation="pay_cash",
            ),
            winner=winner_payload,
            inbound_winner=costing_inbound,
            is_roundtrip=is_roundtrip,
            travelers=travelers,
            cash_price=cash_price,
            data_quality=data_quality,
            missing_sources=missing_sources,
            safe_fallback_used=bool(missing_sources),
            next_step=_build_next_step(
                "pay_cash",
                winner_origin,
                winner_destination,
                cabin,
                cpp=cpp,
                cash_price=cash_price,
                remaining_seats=remaining_seats,
                urgency=urgency,
                program_label=program_label,
                data_quality=data_quality,
            ),
        )
        return response

    if cpp >= CPP_USE_POINTS_STRONG_THRESHOLD:
        strong_pts, strong_taxes = _display_award_totals(
            points, taxes, costing_inbound, travelers
        )
        strong_basis = "for the whole trip" if costing_inbound else "for the outbound leg"
        explanation = (
            f"The best award is {strong_pts:,} points"
            f"{' plus about $' + str(int(round(strong_taxes))) + ' in taxes' if strong_taxes else ''}"
            f" {strong_basis}, which saves about ${savings:,.0f} compared with paying {_cash_label(cash_price)} cash."
        )
        if urgency:
            explanation += f" There are only {remaining_seats} seat{'s' if remaining_seats != 1 else ''} left, so this is worth acting on soon."
        metro_suffix = (
            f" Best from {winner_origin}{(' to ' + winner_destination) if is_metro_destination else ''}."
            if is_metro_origin or is_metro_destination
            else ""
        )
        response = _base_response(
            recommendation="use_points",
            verdict_label="Use Points",
            headline=f"{program_label} is the strongest redemption on this trip.{metro_suffix}",
            explanation=explanation,
            confidence="high",
            confidence_reason="Live cash pricing and matching award availability were both found, and the cents-per-point value is strong.",
            booking_note=f"Verify the award on {program_label}'s site before you transfer any points.",
            booking_link=_get_booking_link_for_verdict(
                program,
                trip_ids,
                origin=winner_origin,
                destination=winner_destination,
                depart_date=date,
                return_date=return_date,
                travelers=travelers,
                recommendation="use_points",
            ),
            winner=winner_payload,
            inbound_winner=costing_inbound,
            is_roundtrip=is_roundtrip,
            travelers=travelers,
            cash_price=cash_price,
            data_quality=data_quality,
            missing_sources=missing_sources,
            safe_fallback_used=bool(missing_sources),
            next_step=_build_next_step(
                "use_points",
                winner_origin,
                winner_destination,
                cabin,
                cpp=cpp,
                cash_price=cash_price,
                remaining_seats=remaining_seats,
                urgency=urgency,
                program_label=program_label,
                data_quality=data_quality,
            ),
        )
        return response

    if CPP_PAY_CASH_THRESHOLD <= cpp < CPP_GRAY_ZONE_MIDPOINT:
        return _gray_zone_response(
            recommendation="pay_cash",
            program=program,
            program_label=program_label,
            points=points,
            cpp=cpp,
            cash_price=cash_price,
            trip_ids=trip_ids,
            display_origin=display_origin,
            display_destination=display_destination,
            winner_origin=winner_origin,
            winner_destination=winner_destination,
            date=date,
            return_date=return_date,
            travelers=travelers,
            winner_payload=winner_payload,
            inbound_winner=costing_inbound,
            is_roundtrip=is_roundtrip,
            data_quality=data_quality,
            missing_sources=missing_sources,
        )

    if CPP_GRAY_ZONE_MIDPOINT <= cpp < CPP_USE_POINTS_STRONG_THRESHOLD:
        return _gray_zone_response(
            recommendation="use_points",
            program=program,
            program_label=program_label,
            points=points,
            cpp=cpp,
            cash_price=cash_price,
            trip_ids=trip_ids,
            display_origin=display_origin,
            display_destination=display_destination,
            winner_origin=winner_origin,
            winner_destination=winner_destination,
            date=date,
            return_date=return_date,
            travelers=travelers,
            winner_payload=winner_payload,
            inbound_winner=costing_inbound,
            is_roundtrip=is_roundtrip,
            data_quality=data_quality,
            missing_sources=missing_sources,
        )

    # Defensive fallback.
    return _base_response(
        recommendation="wait",
        verdict_label="Wait",
        headline="I have the trip data, but I am not comfortable forcing a recommendation yet.",
        explanation="Try a nearby date or a different cabin so I can compare a cleaner set of options.",
        confidence="low",
        confidence_reason="The result landed in a fallback decision path.",
        booking_note="Retry with a nearby date for a stronger answer.",
        booking_link=_get_booking_link_for_verdict(
            program,
            trip_ids,
            origin=display_origin,
            destination=display_destination,
            depart_date=date,
            return_date=return_date,
            travelers=travelers,
            recommendation="wait",
        ),
        winner=winner_payload,
        inbound_winner=costing_inbound,
            is_roundtrip=is_roundtrip,
        travelers=travelers,
        cash_price=cash_price,
        data_quality=data_quality,
        missing_sources=missing_sources,
        safe_fallback_used=True,
        next_step=_build_next_step(
            "wait",
            winner_origin,
            winner_destination,
            cabin,
            cpp=cpp,
            cash_price=cash_price,
            remaining_seats=remaining_seats,
            urgency=urgency,
            program_label=program_label,
            data_quality=data_quality,
        ),
    )