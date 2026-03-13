"""
RW-VerdictGenerator: AI-powered verdict using Gemini Flash 2.0
Place at: RewardWise_MVP0/Backend/app/services/verdict_service.py

Generates a natural language verdict from search results + user wallet context.
Falls back gracefully if Gemini is unavailable.
"""

import json
import os
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv

# Explicitly find .env relative to this file — works regardless of where uvicorn is launched
load_dotenv(dotenv_path=Path(__file__).resolve().parents[2] / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# ---------------------------------------------------------------------------
# Booking link helpers
# ---------------------------------------------------------------------------

# seats.aero source name → airline booking URL
PROGRAM_BOOKING_URLS = {
    "american":   "https://www.aa.com/aadvantage-shopping/flights",
    "united":     "https://www.united.com/en/us/flights/book",
    "delta":      "https://www.delta.com/us/en/booking/book-a-flight",
    "aeroplan":   "https://www.aircanada.com/us/en/aco/home/book/flights.html",
    "qantas":     "https://www.qantas.com/us/en/book-a-trip/flights.html",
    "alaska":     "https://www.alaskaair.com/flights",
    "jetblue":    "https://www.jetblue.com/book",
    "emirates":   "https://www.emirates.com/us/english/book/",
    "velocity":   "https://www.virginaustralia.com/us/en/plan/book-flights/",
    "avianca":    "https://www.avianca.com/us/en/",
    "turkish":    "https://www.turkishairlines.com/en-us/flights/",
    "cathay":     "https://www.cathaypacific.com/cx/en_US/book-a-trip/flights.html",
    "singapore":  "https://www.singaporeair.com/en_UK/us/plan-travel/book-flights/",
    "lifemiles":  "https://www.lifemiles.com/mult/land/landingv2.aspx",
    "smiles":     "https://www.smiles.com.br/en",
    "ethiopian":  "https://www.ethiopianairlines.com/us/book/booking",
    "spirit":     "https://www.spirit.com/book",
    "frontier":   "https://www.flyfrontier.com/flights/book-flights/",
}


def _get_booking_link(program: str, trip_ids: list) -> dict:
    """
    Returns booking link options:
    - seats_aero_link: direct deeplink if trip_id is available
    - airline_link: airline's own booking page as fallback
    - preferred: which one to surface to the user
    """
    program_lower = program.lower()
    airline_url = PROGRAM_BOOKING_URLS.get(program_lower)
    seats_aero_link = f"https://seats.aero/booking/{trip_ids[0]}" if trip_ids else None

    return {
        "seats_aero_link": seats_aero_link,
        "airline_link": airline_url,
        "preferred": "seats_aero" if seats_aero_link else "airline",
    }


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

def _build_prompt(
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
    user_programs: Optional[list],
) -> str:
    trip_type = "round trip" if is_roundtrip else "one way"
    traveler_str = f"{travelers} traveler{'s' if travelers > 1 else ''}"
    cash_str = f"${cash_price:.0f}" if cash_price else "unavailable"

    # Split awards into user's vs others
    if user_programs:
        user_programs_lower = [p.lower() for p in user_programs]
        user_awards = [a for a in award_options if a.get("program", "").lower() in user_programs_lower]
        other_awards = [a for a in award_options if a.get("program", "").lower() not in user_programs_lower]
        wallet_line = f"The user's loyalty programs: {', '.join(user_programs)}."
    else:
        user_awards = []
        other_awards = award_options
        wallet_line = "The user's loyalty programs are unknown — recommend the best option available."

    # Translate CPP into plain English tiers — keep math away from Gemini's output
    def value_tier(cpp: float) -> str:
        if cpp >= 2.0: return "excellent value"
        if cpp >= 1.5: return "solid value"
        if cpp >= 1.1: return "decent but not amazing value"
        return "poor value — basically the same as paying cash"

    def fmt(awards: list, limit: int = 5) -> str:
        if not awards:
            return "  None"
        lines = []
        for a in awards[:limit]:
            taxes = a.get("taxes", 0)
            tax_str = f" + ${taxes:.0f} in taxes" if taxes else ""
            direction = "Nonstop" if a.get("direct") else "Connecting"
            tier = value_tier(a.get("cpp", 0))
            seats = a.get("remaining_seats", "?")
            lines.append(f"  • {a.get('program')}: {a.get('points', 0):,} pts{tax_str} | {direction} | {tier} | {seats} seats left")
        return "\n".join(lines)

    return_section = (
        f"\nRETURN LEG ({destination} → {origin}):\n{fmt(return_award_options, 3)}"
        if is_roundtrip and return_award_options else ""
    )

    return f"""You are RewardWise — a sharp, funny best friend who also happens to be obsessed with travel rewards. You're texting the user your honest take. You get excited about good deals and you're real about bad ones.

STRICT TONE RULES (break these and you fail):
- Write like you're texting, not presenting a report. Short. Punchy. Real.
- Use casual language: "honestly", "ngl", "just", "tbh", "kinda", "literally", "yeah"
- You can use mild enthusiasm: "oh this is a good one", "yeah no skip this", "actually not bad"
- 2-3 sentences MAX. No intros, no sign-offs, no "based on the data"
- NEVER sound like a financial advisor or corporate chatbot
- NEVER use bullet points, headers, or numbered lists
- NEVER mention CPP, cents per point, redemption rate, or any math
- NEVER start with "Based on", "Looking at", "According to", or "I recommend"
- Always name the program and points amount + the cash price so they know what you're talking about

GOOD EXAMPLES (match this energy):
- "Honestly just pay the $276 here — Spirit at 10,500 pts is fine but the cash price is so low it's not worth burning points. Save them for something better."
- "Alaska at 150k pts for business class to Tokyo?? Yeah that's a steal, the cash price is $9k. Book it before those seats disappear."
- "Ngl the Qatar option (16k pts) is tempting but with only 1 seat left and $317 cash, I'd just pay cash and hold your points for a longer haul."
- "Ethiopian at 22,500 pts nonstop is lowkey solid here. Cash is $431 so you're getting decent value — I'd go for it if you've got the points to spare."

BAD EXAMPLES (never do this):
- "Based on the available options, I recommend using your Alaska Airlines miles..."
- "The optimal redemption strategy here would be..."
- "I suggest considering the Spirit Airlines award availability..."

FLIGHT: {origin} → {destination} | {trip_type} | {traveler_str} | {cabin}
DATES: {date}{f" → {return_date}" if return_date else ""}
CASH PRICE: {cash_str}
{wallet_line}

USER'S PROGRAMS (outbound):
{fmt(user_awards) if user_awards else "  None of the user's programs have availability on this route."}

OTHER PROGRAMS (outbound):
{fmt(other_awards)}
{return_section}

Respond ONLY with valid JSON, no markdown, no extra text:
{{
  "verdict": "<2-3 sentences, texting tone, name the program + points + cash price, no math>",
  "winner": {{
    "program": "<program name or null if paying cash>",
    "points": <integer or null>,
    "taxes": <number or null>,
    "cpp": <float or null>,
    "direct": <true | false | null>
  }},
  "pay_cash": <true if cash beats points, false if points win>,
  "confidence": "<high | medium | low>",
  "booking_note": "<one punchy sentence on what to do next — casual, not corporate>"
}}"""


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

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
    """
    Calls Gemini Flash 2.0 and returns a structured verdict + booking links.
    Falls back gracefully if the API call fails.
    """

    async def _attach_booking_link(verdict_data: dict) -> dict:
        winner = verdict_data.get("winner") or {}
        program = winner.get("program")
        if program:
            matched = next(
                (a for a in award_options if a.get("program", "").lower() == program.lower()),
                None,
            )
            trip_ids = matched.get("trip_ids", []) if matched else []
            verdict_data["booking_link"] = _get_booking_link(program, trip_ids)
        else:
            verdict_data["booking_link"] = {
                "seats_aero_link": None,
                "airline_link": None,
                "preferred": "none",
            }
        return verdict_data

    if not GEMINI_API_KEY:
        print("❌ GEMINI_API_KEY not set — using fallback verdict")
        return await _attach_booking_link(
            _fallback_verdict(award_options, cash_price, user_programs)
        )

    prompt = _build_prompt(
        origin=origin,
        destination=destination,
        date=date,
        cabin=cabin,
        travelers=travelers,
        is_roundtrip=is_roundtrip,
        return_date=return_date,
        cash_price=cash_price,
        award_options=award_options,
        return_award_options=return_award_options,
        user_programs=user_programs,
    )

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash-lite:generateContent?key={GEMINI_API_KEY}"
    )

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            res = await client.post(
                url,
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.5,
                        "maxOutputTokens": 500,
                    },
                },
            )
            res.raise_for_status()
            data = res.json()

        raw = data["candidates"][0]["content"]["parts"][0]["text"].strip()

        # Strip markdown code fences if Gemini wraps in ```json ... ```
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        return await _attach_booking_link(json.loads(raw))

    except Exception as e:
        print(f"❌ Gemini verdict failed: {e}")
        return await _attach_booking_link(
            _fallback_verdict(award_options, cash_price, user_programs)
        )


# ---------------------------------------------------------------------------
# Rule-based fallback (Gemini unavailable)
# ---------------------------------------------------------------------------

def _fallback_verdict(
    award_options: list,
    cash_price: Optional[float],
    user_programs: Optional[list] = None,
) -> dict:
    # Prefer user's programs if known
    candidates = award_options
    if user_programs:
        user_lower = [p.lower() for p in user_programs]
        user_awards = [a for a in award_options if a.get("program", "").lower() in user_lower]
        if user_awards:
            candidates = user_awards

    if not candidates:
        return {
            "verdict": "No award availability on this route right now. Paying cash is your best move.",
            "winner": None,
            "pay_cash": True,
            "confidence": "high",
            "booking_note": "Check the airline's website directly for cash fares.",
        }

    top = candidates[0]
    cpp = top.get("cpp", 0)
    program = top.get("program", "Unknown")
    points = top.get("points", 0)
    taxes = top.get("taxes", 0)
    direct = top.get("direct", False)
    flight_type = "nonstop" if direct else "connecting"
    cash_str = f"${cash_price:.0f}" if cash_price else "the cash fare"

    if cpp >= 1.5:
        verdict = (
            f"Go with {program} — {points:,} points gets you a {flight_type} at {cpp:.1f}¢/pt, "
            f"which is solid value. Worth redeeming here."
        )
        pay_cash = False
        confidence = "high"
    elif cpp >= 1.1:
        verdict = (
            f"{program} gives you {cpp:.1f}¢/pt on this route — reasonable but not a home run. "
            f"If you're flush on points it works, but {cash_str} cash isn't unreasonable either."
        )
        pay_cash = False
        confidence = "medium"
    else:
        verdict = (
            f"At {cpp:.1f}¢/pt, {program} isn't giving you great value here. "
            f"With cash at {cash_str}, you're better off saving your points for a stronger redemption."
        )
        pay_cash = True
        confidence = "medium"

    return {
        "verdict": verdict,
        "winner": {"program": program, "points": points, "taxes": taxes, "cpp": cpp, "direct": direct},
        "pay_cash": pay_cash,
        "confidence": confidence,
        "booking_note": f"Head to {program}'s website and search with your loyalty account to complete the booking.",
    }