import logging
from typing import Optional

from app.services.seats_service import get_trip_detail

logger = logging.getLogger(__name__)

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

PROGRAM_HOST_MAP = {
    "aeroplan": "aircanada.com",
    "american": "aa.com",
    "alaska": "alaskaair.com",
    "delta": "delta.com",
    "united": "united.com",
    "british": "britishairways.com",
    "qantas": "qantas.com",
    "qatar": "qatarairways.com",
    "finnair": "finnair.com",
    "ana": "ana.co.jp",
    "virginatlantic": "virginatlantic.com",
    "smiles": "smiles.com.br",
    "lifemiles": "lifemiles.com",
    "korean": "koreanair.com",
    "avianca": "lifemiles.com",
    "flyingblue": "flyingblue.com",
    "air_france": "airfrance.com",
    "singapore": "singaporeair.com",
    "cathay": "cathaypacific.com",
    "turkish": "turkishairlines.com",
    "etihad": "etihad.com",
    "emirates": "emirates.com",
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


def _pick_booking_link(booking_links: list, winner_program: str) -> Optional[str]:
    """Pick the deep link that matches the winner's program by URL host pattern.

    Falls back to the first link if no host match. Returns None if list empty.
    """
    if not booking_links:
        return None

    expected_host = PROGRAM_HOST_MAP.get((winner_program or "").lower())
    if expected_host:
        for link_obj in booking_links:
            url = (link_obj or {}).get("link") or ""
            if expected_host in url.lower():
                return url

    first = booking_links[0] if booking_links else {}
    return (first or {}).get("link") or None


async def _resolve_use_points_booking_link(
    program: Optional[str],
    trip_ids: list,
    fallback: dict,
) -> dict:
    """Fetch /trips/{id} for the winner and override seats_aero_link with the
    program-matched deep link. On any failure, return the fallback (homepage).
    """
    if not trip_ids:
        return fallback
    try:
        detail = await get_trip_detail(trip_ids[0])
    except Exception as exc:
        logger.warning("get_trip_detail failed for trip_id=%s: %s", trip_ids[0], exc)
        return fallback
    booking_links = (detail or {}).get("booking_links") or []
    deep_link = _pick_booking_link(booking_links, program or "")
    if not deep_link:
        return fallback
    return {
        "seats_aero_link": deep_link,
        "airline_link": fallback.get("airline_link"),
        "preferred": "seats_aero",
    }


def _fmt(name: str) -> str:
    return (name or "").replace("_", " ").title()


def _cash_label(cash_price: Optional[float]) -> str:
    return f"${cash_price:.0f}" if cash_price is not None else "cash unavailable"


def _metrics(cash_price: Optional[float], winner: Optional[dict]) -> dict:
    winner = winner or {}
    taxes = winner.get("taxes") or 0
    points_cost = winner.get("points")
    cpp = winner.get("cpp")
    savings = None
    if cash_price is not None and taxes is not None:
        savings = max(0, round(float(cash_price) - float(taxes), 2))
    return {
        "cash_price": cash_price,
        "points_cost": points_cost,
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
    is_premium = cabin_lower in {"business", "first", "premium_economy"}

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
    cash_price: Optional[float] = None,
    data_quality: str = "full",
    missing_sources: Optional[list] = None,
    safe_fallback_used: bool = False,
    next_step: Optional[dict] = None,
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
        "metrics": _metrics(cash_price, winner),
        "next_step": next_step,
    }


def _choose_candidate(award_options: list, user_programs: Optional[list]) -> tuple[list, list]:
    if not award_options:
        return [], []
    if not user_programs:
        return award_options, award_options
    user_lower = [p.lower() for p in user_programs]
    user_picks = [a for a in award_options if a.get("program", "").lower() in user_lower]
    return user_picks, award_options


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
    del date, is_roundtrip, return_date, return_award_options  # reserved for future richer copy

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
        data_quality = "missing_both"
    elif missing_sources == ["cash_price"]:
        data_quality = "missing_cash"
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
    program = winner.get("program") or "unknown"
    points = int(winner.get("points") or 0)
    taxes = float(winner.get("taxes") or 0)
    cpp = float(winner.get("cpp") or 0)
    direct = bool(winner.get("direct", False))
    remaining_seats = int(winner.get("remaining_seats") or 0)
    program_label = _fmt(program)
    trip_ids = winner.get("trip_ids", []) if isinstance(winner, dict) else []
    booking_link = _get_booking_link(program, trip_ids)
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
        response = _base_response(
            recommendation="wait",
            verdict_label="Wait",
            headline=f"{program_label} has award space, but I do not have a live cash fare to compare it against.",
            explanation=f"The best current option I found is {points:,} points{' nonstop' if direct else ''}. Without a live cash price, I cannot safely say whether using points beats paying cash.",
            confidence="low",
            confidence_reason="Award availability was found, but live cash pricing was unavailable.",
            booking_note=f"If you want to use points, verify the award on {program_label}'s site before transferring.",
            booking_link=booking_link,
            winner=winner_payload,
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

    if cash_price <= 250 or cpp < 1.25:
        explanation = (
            f"Cash is only {_cash_label(cash_price)}, while the best award I found is {points:,} points"
            f"{' plus about $' + str(int(round(taxes))) + ' in taxes' if taxes else ''}."
            " Your points are likely worth more on a different trip."
        )
        response = _base_response(
            recommendation="pay_cash",
            verdict_label="Pay Cash",
            headline=f"Cash wins here at {_cash_label(cash_price)}.",
            explanation=explanation,
            confidence="high" if cpp < 1.0 or cash_price <= 200 else "medium",
            confidence_reason="Live cash pricing is low relative to the best award option available.",
            booking_note="Pay cash and keep your points for a higher-value redemption.",
            booking_link=booking_link,
            winner=winner_payload,
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

    if cpp >= 1.8:
        explanation = (
            f"The best award is {points:,} points"
            f"{' plus about $' + str(int(round(taxes))) + ' in taxes' if taxes else ''}"
            f", which saves about ${savings:,.0f} compared with paying {_cash_label(cash_price)} cash."
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
            booking_link=await _resolve_use_points_booking_link(program, trip_ids, booking_link),
            winner=winner_payload,
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

    if 1.25 <= cpp < 1.8:
        response = _base_response(
            recommendation="wait",
            verdict_label="Wait",
            headline="This one is close enough that I would check another date before booking.",
            explanation=(
                f"I found {program_label} at {points:,} points versus {_cash_label(cash_price)} cash."
                f" That is decent value, but not a slam dunk once you factor in the fees and flexibility tradeoff."
            ),
            confidence="medium",
            confidence_reason="Both cash and award data were found, but the value gap is not wide enough to be decisive.",
            booking_note="Try shifting the date or cabin to see if better award value opens up.",
            booking_link=booking_link,
            winner=winner_payload,
            cash_price=cash_price,
            data_quality=data_quality,
            missing_sources=missing_sources,
            safe_fallback_used=bool(missing_sources),
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
        return response

    # Defensive fallback.
    return _base_response(
        recommendation="wait",
        verdict_label="Wait",
        headline="I have the trip data, but I am not comfortable forcing a recommendation yet.",
        explanation="Try a nearby date or a different cabin so I can compare a cleaner set of options.",
        confidence="low",
        confidence_reason="The result landed in a fallback decision path.",
        booking_note="Retry with a nearby date for a stronger answer.",
        booking_link=booking_link,
        winner=winner_payload,
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