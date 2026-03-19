import random
from typing import Optional

PROGRAM_URL_OVERRIDES = {
    "american":  "https://www.aa.com/",
    "aeroplan":  "https://www.aircanada.com/",
    "velocity":  "https://www.virginaustralia.com/",
    "lifemiles": "https://www.lifemiles.com/",
    "smiles":    "https://www.smiles.com.br/",
    "singapore": "https://www.singaporeair.com/",
    "cathay":    "https://www.cathaypacific.com/",
    "qatar":     "https://www.qatarairways.com/",
    "turkish":   "https://www.turkishairlines.com/",
    "ethiopian": "https://www.ethiopianairlines.com/",
    "alaska":    "https://www.alaskaair.com/",
}


def _get_airline_url(program: str) -> str:
    name = program.lower().strip()
    if name in PROGRAM_URL_OVERRIDES:
        return PROGRAM_URL_OVERRIDES[name]
    return f"https://www.{name}.com/"


def _get_booking_link(program: str, trip_ids: list) -> dict:
    airline_url = _get_airline_url(program)
    return {
        "seats_aero_link": None,
        "airline_link": airline_url,
        "preferred": "airline",
    }


def _fmt(name: str) -> str:
    return name.replace("_", " ").title()


def _ftype(direct: bool) -> str:
    return "nonstop" if direct else "connecting"


def _build_verdict(
    origin: str,
    destination: str,
    cabin: str,
    travelers: int,
    is_roundtrip: bool,
    cash_price: Optional[float],
    award_options: list,
    user_programs: Optional[list],
) -> dict:
    candidates = award_options
    if user_programs:
        user_lower = [p.lower() for p in user_programs]
        user_picks = [a for a in award_options if a.get("program", "").lower() in user_lower]
        if user_picks:
            candidates = user_picks

    if not candidates:
        return {
            "verdict": f"Nothing's showing up on points for {origin}→{destination} right now. Just book the cash fare.",
            "winner": None,
            "pay_cash": True,
            "confidence": "high",
            "booking_note": "Check Google Flights for the best cash price.",
        }

    top      = candidates[0]
    program  = top.get("program", "unknown")
    prog     = _fmt(program)
    points   = top.get("points", 0)
    taxes    = top.get("taxes") or 0
    cpp      = top.get("cpp") or 0
    direct   = top.get("direct", False)
    seats    = top.get("remaining_seats", 0)
    pts_str  = f"{points:,}"
    ftype    = _ftype(direct)
    urgency  = 0 < seats <= 3

    if cash_price is None:
        return {
            "verdict": (
                f"{prog} has {pts_str} pts available {ftype} — "
                f"couldn't pull a cash price to compare but that's your best award option right now."
            ),
            "winner": {"program": program, "points": points, "taxes": taxes, "cpp": cpp, "direct": direct},
            "pay_cash": False,
            "confidence": "low",
            "booking_note": f"Search {prog}'s site to verify and book.",
        }

    cash_str  = f"${cash_price:.0f}"
    saves     = round(cash_price - taxes)
    saves_str = f"~${saves:,}"

    if cash_price < 250:
        return {
            "verdict": (
                f"Honestly just pay the {cash_str} cash — even {prog} at {pts_str} pts isn't worth burning "
                f"points on a flight this cheap. Save them for a bigger trip."
            ),
            "winner": None,
            "pay_cash": True,
            "confidence": "high",
            "booking_note": "Book directly through Google Flights or the airline's site.",
        }

    tax_ratio = taxes / cash_price if cash_price else 0
    if tax_ratio > 0.4 and cpp >= 1.3:
        low_tax_alts = [
            a for a in award_options
            if (a.get("taxes") or 0) < taxes * 0.5 and (a.get("cpp") or 0) >= 1.0
        ]
        if low_tax_alts:
            alt       = low_tax_alts[0]
            alt_prog  = _fmt(alt.get("program", ""))
            alt_pts   = f"{alt.get('points', 0):,}"
            alt_taxes = alt.get("taxes") or 0
            alt_saves = round(cash_price - alt_taxes)
            return {
                "verdict": (
                    f"{prog} looks good on paper but you'd still owe ${taxes:.0f} in taxes on top of {pts_str} pts. "
                    f"{alt_prog} at {alt_pts} pts + ${alt_taxes:.0f} fees saves you ~${alt_saves:,} — better deal overall."
                ),
                "winner": {
                    "program": alt.get("program"),
                    "points": alt.get("points"),
                    "taxes": alt_taxes,
                    "cpp": alt.get("cpp"),
                    "direct": alt.get("direct"),
                },
                "pay_cash": False,
                "confidence": "high",
                "booking_note": f"Go with {alt_prog} — search their site to book with your points.",
            }
        else:
            return {
                "verdict": (
                    f"Ngl {prog} at {pts_str} pts is tempting but you'd still pay ${taxes:.0f} in taxes — "
                    f"with cash at {cash_str} that's not a huge save. Easier to just pay cash here."
                ),
                "winner": None,
                "pay_cash": True,
                "confidence": "medium",
                "booking_note": "Total out-of-pocket with points isn't much better than cash on this route.",
            }

    if cpp >= 2.0:
        if urgency:
            templates = [
                f"Only {seats} seat{'s' if seats > 1 else ''} left on {prog} at {pts_str} pts — cash is {cash_str} and you'd save {saves_str}. Lock it in now.",
                f"{prog} at {pts_str} pts saves you {saves_str} vs {cash_str} cash and there's only {seats} seat{'s' if seats > 1 else ''} left. Go.",
            ]
            booking_note = f"Only {seats} seat{'s' if seats > 1 else ''} left — head to {prog}'s site and book now."
        else:
            templates = [
                f"{prog} at {pts_str} pts {ftype} is genuinely one of the better deals here — cash is {cash_str} and you'd save {saves_str}. Book it.",
                f"Okay yeah this is a good one — {prog} at {pts_str} pts saves you {saves_str} vs {cash_str} cash. Don't sleep on this.",
                f"{prog} at {pts_str} pts is exactly what points are for — cash is {cash_str}, you save {saves_str}. Do it.",
                f"This is the kind of redemption you save points for. {prog} at {pts_str} pts {ftype}, saves you {saves_str} vs {cash_str} cash.",
            ]
            booking_note = f"Head to {prog}'s site and search with your loyalty account to book."
        pay_cash   = False
        confidence = "high"

    elif cpp >= 1.5:
        templates = [
            f"{prog} at {pts_str} pts is actually not bad — cash is {cash_str} and you'd save {saves_str}. Worth it if you've got the points.",
            f"Honestly {prog} at {pts_str} pts is solid. You'd save {saves_str} vs {cash_str} cash — I'd go for it.",
            f"{prog} at {pts_str} pts {ftype} saves you {saves_str} vs {cash_str} cash. That's decent value — worth redeeming.",
            f"Yeah {prog} at {pts_str} pts works here. Cash is {cash_str}, you save {saves_str}. Not a slam dunk but solid.",
        ]
        pay_cash     = False
        confidence   = "high"
        booking_note = f"Head to {prog}'s site and search with your loyalty account to book."

    elif cpp >= 1.3:
        templates = [
            f"{prog} at {pts_str} pts is okay — you'd save {saves_str} vs {cash_str} cash but it's not a home run. Only do it if you're flush on points.",
            f"Tbh {prog} at {pts_str} pts is fine, saves you {saves_str} vs {cash_str} cash. Decent but I'd only burn them if you've got plenty.",
            f"{prog} at {pts_str} pts gets you {saves_str} in savings vs {cash_str} cash. Not amazing, not terrible — your call.",
            f"It's okay. {prog} at {pts_str} pts saves you {saves_str} vs paying {cash_str} cash. Worth it only if you've got more points than you know what to do with.",
        ]
        pay_cash     = False
        confidence   = "medium"
        booking_note = f"Only redeem if you have plenty of {prog} points — search their site to book."

    else:
        templates = [
            f"Just pay the {cash_str} cash — {prog} at {pts_str} pts isn't giving you enough value here. Save those points for a bigger trip.",
            f"Yeah no, {prog} at {pts_str} pts isn't worth it when cash is only {cash_str}. You'd barely save anything — hold the points.",
            f"Skip the points on this one. {prog} at {pts_str} pts just doesn't move the needle when cash is {cash_str}. Save them for something better.",
            f"Ngl {prog} at {pts_str} pts is a bad burn here — cash is {cash_str} and the savings aren't there. Pay cash, keep your points.",
        ]
        pay_cash     = True
        confidence   = "medium" if cpp > 1.0 else "high"
        booking_note = "Book directly through Google Flights or the airline's site for the cash fare."

    verdict_text = random.choice(templates)
    winner = None if pay_cash else {
        "program": program,
        "points": points,
        "taxes": taxes,
        "cpp": cpp,
        "direct": direct,
    }

    return {
        "verdict": verdict_text,
        "winner": winner,
        "pay_cash": pay_cash,
        "confidence": confidence,
        "booking_note": booking_note,
    }

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
    verdict_data = _build_verdict(
        origin=origin,
        destination=destination,
        cabin=cabin,
        travelers=travelers,
        is_roundtrip=is_roundtrip,
        cash_price=cash_price,
        award_options=award_options,
        user_programs=user_programs,
    )

    winner  = verdict_data.get("winner") or {}
    program = winner.get("program")
    if program:
        matched  = next((a for a in award_options if a.get("program", "").lower() == program.lower()), None)
        trip_ids = matched.get("trip_ids", []) if matched else []
        verdict_data["booking_link"] = _get_booking_link(program, trip_ids)
    else:
        verdict_data["booking_link"] = {
            "seats_aero_link": None,
            "airline_link": None,
            "preferred": "none",
        }

    return verdict_data