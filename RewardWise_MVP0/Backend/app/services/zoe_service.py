from typing import Dict, Any, List, Optional
from app.api.validators import SearchParams
from app.services.llm import generate_text
import re
import json
import asyncio
from app.rag.flights_retriever import retrieve
from app.services.verdict_service import generate_verdict
from app.services.seats_service import search_award_availability
from app.services.pricing_service import get_cash_price
from app.utils.math_utils import calculate_cpp
from datetime import datetime

# ─────────────────────────────────────────────────────────────────────────────
# PROGRAM_ALIASES  (must match search.py exactly)
# seats.aero source string → card program names that transfer there
# Without this, user_programs never matches award programs in _build_verdict
# ─────────────────────────────────────────────────────────────────────────────
PROGRAM_ALIASES: dict[str, list[str]] = {
    "united":         ["United MileagePlus"],
    "delta":          ["Delta SkyMiles"],
    "american":       ["Citi ThankYou Points", "Chase Ultimate Rewards"],
    "alaska":         [],
    "jetblue":        [],
    "aeroplan":       ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    "virginatlantic": ["Chase Ultimate Rewards", "Capital One Miles"],
    "flyingblue":     ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    "british":        ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    "singapore":      ["Chase Ultimate Rewards", "Amex Membership Rewards"],
    "cathay":         ["Chase Ultimate Rewards", "Amex Membership Rewards"],
    "emirates":       ["Chase Ultimate Rewards", "Amex Membership Rewards"],
    "turkish":        ["Chase Ultimate Rewards"],
    "qantas":         ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    "avianca":        ["Capital One Miles"],
    "lifemiles":      ["Capital One Miles"],
    "etihad":         ["Amex Membership Rewards"],
    "qatar":          ["Amex Membership Rewards"],
    "saudia":         [],
    "smiles":         [],
    "azul":           [],
    "korean":         [],
    "ana":            ["Amex Membership Rewards"],
    "air_france":     ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    "hyatt":          ["World of Hyatt"],
    "marriott":       ["Marriott Bonvoy"],
}


def _wallet_to_programs(wallet: list) -> list[str]:
    """
    Map wallet card program names → seats.aero source strings.
    e.g. user has "Amex Membership Rewards" → ["qatar", "etihad", "ana", ...]
    This must mirror what search.py's _get_user_programs() does.
    """
    owned = {
        (card.get("program") or card.get("name") or "").strip()
        for card in wallet
    }
    return [
        source
        for source, aliases in PROGRAM_ALIASES.items()
        if any(alias in owned for alias in aliases)
    ]


# ─────────────────────────────────────────────────────────────────────────────
# CITY → IATA  (city dict checked FIRST so "nyc" → JFK not → "NYC")
# ─────────────────────────────────────────────────────────────────────────────
CITY_TO_AIRPORT = {
    "new york": "JFK", "nyc": "JFK",
    "los angeles": "LAX", "la": "LAX",
    "san francisco": "SFO", "sf": "SFO",
    "seattle": "SEA", "chicago": "ORD",
    "houston": "IAH", "dallas": "DFW",
    "miami": "MIA", "atlanta": "ATL",
    "boston": "BOS", "washington dc": "IAD", "dc": "IAD",
    "denver": "DEN", "las vegas": "LAS", "vegas": "LAS",
    "orlando": "MCO", "phoenix": "PHX",
    "san diego": "SAN", "minneapolis": "MSP",
    "detroit": "DTW", "philadelphia": "PHL",
    "charlotte": "CLT", "tampa": "TPA",
    "austin": "AUS", "nashville": "BNA",
    "salt lake city": "SLC", "portland": "PDX",
    "oakland": "OAK", "san jose": "SJC",
    "london": "LHR", "paris": "CDG", "amsterdam": "AMS",
    "frankfurt": "FRA", "munich": "MUC", "zurich": "ZRH",
    "vienna": "VIE", "madrid": "MAD", "barcelona": "BCN",
    "rome": "FCO", "milan": "MXP", "dublin": "DUB",
    "lisbon": "LIS", "copenhagen": "CPH", "stockholm": "ARN",
    "oslo": "OSL", "helsinki": "HEL", "istanbul": "IST",
    "tokyo": "NRT", "osaka": "KIX", "seoul": "ICN",
    "beijing": "PEK", "shanghai": "PVG", "hong kong": "HKG",
    "singapore": "SIN", "bangkok": "BKK", "kuala lumpur": "KUL",
    "jakarta": "CGK", "manila": "MNL", "delhi": "DEL",
    "mumbai": "BOM", "bangalore": "BLR", "hyderabad": "HYD",
    "chennai": "MAA", "kolkata": "CCU", "doha": "DOH",
    "dubai": "DXB", "abu dhabi": "AUH",
    "sydney": "SYD", "melbourne": "MEL", "brisbane": "BNE",
    "perth": "PER", "auckland": "AKL",
    "toronto": "YYZ", "vancouver": "YVR", "montreal": "YUL", "calgary": "YYC",
    "mexico city": "MEX", "cancun": "CUN", "sao paulo": "GRU",
    "rio": "GIG", "buenos aires": "EZE", "lima": "LIM",
    "bogota": "BOG", "santiago": "SCL",
}


def normalize_location(value: str) -> str:
    if not value:
        return value
    v = value.lower().strip()
    if v in CITY_TO_AIRPORT:
        return CITY_TO_AIRPORT[v]
    for city, code in CITY_TO_AIRPORT.items():
        if city in v:
            return code
    v_nospace = v.replace(" ", "").replace("-", "")
    for city, code in CITY_TO_AIRPORT.items():
        if city.replace(" ", "") == v_nospace:
            return code
    for city, code in CITY_TO_AIRPORT.items():
        if city.replace(" ", "") in v_nospace:
            return code
    if len(v) == 3 and v.isalpha():
        return v.upper()
    return value.upper() if len(value) <= 4 else value


def format_wallet_context(wallet):
    if not wallet:
        return "User has no wallet data."
    lines = []
    for card in wallet:
        program = card.get("program") or card.get("name")
        points = int(card.get("points") or card.get("balance") or 0)
        if program and points:
            lines.append(f"{program}: {points} points")
    return "\n".join(lines) if lines else "User has no points yet."


def is_question(text: str) -> bool:
    text = text.lower()
    return any(k in text for k in ["how", "what", "why", "when", "where", "points", "miles", "balance"])


def looks_like_date_range(text: str) -> bool:
    months = [
        "january","february","march","april","may","june","july",
        "august","september","october","november","december",
        "jan","feb","mar","apr","jun","jul","aug","sep","oct","nov","dec",
    ]
    t = text.lower()
    return any(m in t for m in months) or bool(re.search(r'\d', t))


def parse_date_string(date_str: str):
    if not date_str:
        return None
    date_str = date_str.strip()
    for fmt in ["%B %d %Y", "%B %d, %Y", "%b %d %Y", "%b %d, %Y",
                "%Y-%m-%d", "%m/%d/%Y", "%B %d", "%b %d"]:
        try:
            parsed = datetime.strptime(date_str, fmt)
            if parsed.year == 1900:
                parsed = parsed.replace(year=datetime.now().year)
                if parsed.date() < datetime.now().date():
                    parsed = parsed.replace(year=datetime.now().year + 1)
            return parsed.date()
        except ValueError:
            continue
    return None


def validate(slots):
    try:
        return SearchParams(**slots)
    except Exception:
        return None


async def retrieve_context(query: str):
    results = await retrieve(query, top_k=3)
    if not results:
        return "No relevant knowledge found."
    return "\n".join([f"{r.title}\n{r.snippet}" for r in results])


async def handle_question(text: str, wallet):
    text_lower = text.lower()
    if "points" in text_lower or "balance" in text_lower or "miles" in text_lower:
        if not wallet:
            return {"type": "answer", "message": "You haven't added any loyalty programs yet. Add your cards in Wallet to track your points."}
        lines, total = [], 0
        for card in wallet:
            program = card.get("program") or card.get("name")
            points = int(card.get("points") or card.get("balance") or 0)
            if program:
                lines.append(f"{program}: {points:,} points")
                total += points
        return {
            "type": "answer",
            "message": "Here's your current points balance:\n\n" + "\n".join(lines) + f"\n\nTotal: {total:,} points"
        }

    context = await retrieve_context(text)
    wallet_context = format_wallet_context(wallet)
    prompt = f"""You are Zoe, a smart travel rewards assistant.
USER WALLET:\n{wallet_context}\nKNOWLEDGE:\n{context}\nRULES:\n- Use wallet data when relevant\n- Be concise and practical\nUSER QUESTION:\n{text}"""
    try:
        answer = await generate_text(prompt)
    except Exception as e:
        print("LLM ERROR:", str(e))
        answer = None
    return {"type": "answer", "message": answer or "I couldn't answer that. Try asking differently."}


def format_history_for_prompt(history: List[Dict]) -> str:
    if not history:
        return ""
    lines = []
    for msg in history[-10:]:
        lines.append(msg.get("content", ""))
    return "\n".join(lines)


async def handle_zoe(payload: Dict[str, Any], request=None) -> Dict[str, Any]:
    text    = payload.get("message", "")
    wallet  = payload.get("wallet", [])
    incoming = payload.get("slots", {}) or {}
    history = payload.get("history", [])

    print("📩 USER:", text)
    print("📦 INCOMING SLOTS:", incoming)

    # ── Normalize incoming state ──────────────────────────────────────────────
    state: Dict[str, Any] = {}
    for k, v in incoming.items():
        if v is None or v == "":
            continue
        if k == "cabin":
            state[k] = str(v).lower()
        elif k in ["origin", "destination"]:
            state[k] = normalize_location(str(v))
        elif k == "travelers":
            try:
                state[k] = int(v)
            except (ValueError, TypeError):
                state[k] = v
        elif k == "tripType":
            val = str(v).lower()
            state[k] = "oneway" if "one" in val else "roundtrip" if "round" in val else val
        else:
            state[k] = v

    # ── Greeting ──────────────────────────────────────────────────────────────
    if text.lower().strip() in ["start", "hi", "hello", "hey"]:
        return {"type": "answer", "message": "Hey! Good to see you ✈️ Ready to plan your next trip?", "params": state}

    # ── Question handler ───────────────────────────────────────────────────────
    if is_question(text):
        result = await handle_question(text, wallet)
        result["params"] = state
        return result

    # ── RAG + LLM extraction ──────────────────────────────────────────────────
    context = await retrieve_context(text)
    history_str = format_history_for_prompt(history)

    extract_prompt = f"""You are extracting travel details from a conversation.

CONVERSATION SO FAR:
{history_str}

LATEST USER MESSAGE:
{text}

CURRENT KNOWN TRIP DETAILS:
{json.dumps(state)}

Extract ONLY NEW information. Return JSON with keys:
origin, destination, date, return_date, tripType, cabin, travelers, emotion

Rules:
- If already known → return null
- If not mentioned → return null
- tripType: "oneway" or "roundtrip" or null
- cabin: "economy", "business", or "first" or null
- travelers: integer or null
- dates: ISO YYYY-MM-DD if possible

Return ONLY valid JSON."""

    raw = await generate_text(extract_prompt)
    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start == -1 or end == 0:
            raise ValueError("No JSON")
        data = json.loads(raw[start:end])
    except Exception as e:
        print("❌ JSON PARSE ERROR:", str(e), "\nRAW:", raw)
        data = {}

    # ── Date range ("June 5 to June 10") ─────────────────────────────────────
    if " to " in text.lower() and looks_like_date_range(text):
        parts = re.split(r"\s+to\s+", text, maxsplit=1, flags=re.IGNORECASE)
        if len(parts) == 2:
            p0, p1 = parts[0].strip(), parts[1].strip()
            if not (len(p0) <= 4 and p0.isalpha() and len(p1) <= 4 and p1.isalpha()):
                if not state.get("date"):
                    state["date"] = p0
                if not state.get("return_date"):
                    state["return_date"] = p1
                if not state.get("tripType"):
                    state["tripType"] = "roundtrip"

    # ── Merge — never overwrite existing slots ────────────────────────────────
    for k, v in data.items():
        if not v:
            continue
        if state.get(k) is not None and state.get(k) != "":
            continue
        if k in ["origin", "destination"]:
            state[k] = normalize_location(str(v))
        elif k == "travelers":
            try:
                state[k] = int(v)
            except (ValueError, TypeError):
                pass
        elif k == "cabin":
            state[k] = str(v).lower()
        elif k == "tripType":
            val = str(v).lower()
            if "one" in val:
                state["tripType"] = "oneway"
                state.pop("return_date", None)
            elif "round" in val:
                state["tripType"] = "roundtrip"
        else:
            state[k] = v

    if not state.get("tripType") and state.get("return_date"):
        state["tripType"] = "roundtrip"

    print("🧠 STATE AFTER MERGE:", state)

    # ── Type coercion ─────────────────────────────────────────────────────────
    if isinstance(state.get("travelers"), str):
        try:
            state["travelers"] = int(state["travelers"])
        except ValueError:
            state["travelers"] = 1

    for date_key in ["date", "return_date"]:
        val = state.get(date_key)
        if val and isinstance(val, str):
            parsed = parse_date_string(val)
            if parsed:
                state[date_key] = str(parsed)

    # ── Readiness check ───────────────────────────────────────────────────────
    def is_ready_for_search(s: dict) -> bool:
        if not all(s.get(k) for k in ["origin", "destination", "date", "travelers", "cabin"]):
            return False
        if not s.get("tripType"):
            return False
        if s.get("tripType") == "roundtrip" and not s.get("return_date"):
            return False
        return True

    is_ready = is_ready_for_search(state)
    print("✅ IS READY:", is_ready, "| STATE:", state)

    # ── SEARCH ────────────────────────────────────────────────────────────────
    if is_ready:
        try:
            origin       = state["origin"]
            destination  = state["destination"]
            dep_date     = state["date"]
            ret_date     = state.get("return_date")
            cabin        = state.get("cabin", "economy")
            travelers    = int(state.get("travelers", 1))
            is_roundtrip = bool(ret_date)

            # Parallel award + cash fetch
            async def outbound():
                raw = await search_award_availability(origin, destination, dep_date, cabin)
                return [a for a in raw if a.get("remaining_seats", 0) >= travelers]

            async def ret_leg():
                if not ret_date:
                    return []
                raw = await search_award_availability(destination, origin, ret_date, cabin)
                return [a for a in raw if a.get("remaining_seats", 0) >= travelers]

            outbound_awards, cash_data, return_awards = await asyncio.gather(
                outbound(),
                get_cash_price(origin, destination, dep_date, cabin, travelers, ret_date),
                ret_leg(),
            )

            cash_price = cash_data.get("cash_price")

            def build_options(awards):
                results = []
                for award in awards:
                    pts = award.get("points")
                    if not pts:
                        continue
                    taxes = (award.get("taxes") or 0) / 100
                    cpp = calculate_cpp(cash_price, taxes, pts) if cash_price else None
                    results.append({**award, "cash_price": cash_price, "taxes": taxes, "cpp": cpp})
                results.sort(key=lambda x: x.get("cpp") or 0, reverse=True)
                return results

            award_options        = build_options(outbound_awards)
            return_award_options = build_options(return_awards)

            # ── CRITICAL: map wallet names → seats.aero sources ──────────────
            # Raw names ("Amex Membership Rewards") never equal "qatar" etc.
            # Must use PROGRAM_ALIASES — same logic as search.py
            user_programs = _wallet_to_programs(wallet)
            print("🎯 USER PROGRAMS (mapped):", user_programs)

            verdict = await generate_verdict(
                origin=origin,
                destination=destination,
                date=dep_date,
                cabin=cabin,
                travelers=travelers,
                is_roundtrip=is_roundtrip,
                return_date=ret_date,
                cash_price=cash_price,          # pass None — verdict_service handles it safely
                award_options=award_options,
                return_award_options=return_award_options,
                user_programs=user_programs or None,
            )

            # ── Build structured Zoe message ──────────────────────────────────
            pay_cash     = verdict.get("pay_cash", False)
            winner       = verdict.get("winner") or {}
            w_program    = winner.get("program", "")
            w_points     = winner.get("points", 0)
            w_taxes      = winner.get("taxes") or 0
            prog_fmt     = w_program.replace("_", " ").title() if w_program else ""
            cash_str     = f"${cash_price:.0f}" if cash_price else "N/A"
            travelers_label = f"{travelers} traveler{'s' if travelers != 1 else ''}"
            trip_label   = "roundtrip" if is_roundtrip else "one way"

            # Line 1 — context
            opening = (
                f"I see you're looking to fly from **{origin}** to **{destination}** "
                f"on {dep_date}, {travelers_label}, {cabin} class, {trip_label}."
            )

            if pay_cash:
                verdict_label = "**Verdict: Pay Cash 💵**"
                cost_line     = f"**Cash:** {cash_str}"
                savings_line  = "**You'd Save:** Points for a bigger trip ✈️"
                book_line     = "You can book directly through the airline or your preferred cash booking site. Safe travels!"
            else:
                verdict_label = "**Verdict: Use Points ✨**"
                total_pts     = w_points * travelers          # winner.points is per-person
                pts_str       = f"{total_pts:,}"
                per_person    = f" ({w_points:,} pts per person)" if travelers > 1 else ""
                cost_line     = f"**Points Required:** {pts_str} pts{per_person}"
                savings       = round(cash_price - w_taxes) if cash_price else None
                saves_str     = f"~${savings:,}" if savings else "significant savings"
                savings_line  = f"**You'd Save:** {saves_str}"
                airline_site  = f"{prog_fmt}'s site" if prog_fmt else "the airline's site"
                book_line     = f"You can book directly through {airline_site}. Safe travels!"

            zoe_msg = (
                f"{opening}\n\n"
                f"{verdict_label}\n"
                f"{cost_line}\n\n"
                f"{savings_line}\n\n"
                f"{book_line}"
            )

            return {
                "type": "search_result",
                "message": zoe_msg,
                "data": verdict,
                "params": state,
            }

        except Exception as e:
            import traceback
            print("❌ SEARCH ERROR:", traceback.format_exc())
            return {
                "type": "error",
                "message": "Sorry, I ran into an issue fetching results. Please try again.",
                "params": state,
            }

    # ── Ask next missing slot ─────────────────────────────────────────────────
    missing_order = ["origin", "destination", "date", "tripType", "travelers", "cabin"]
    missing = next((k for k in missing_order if not state.get(k)), None)
    if not missing and state.get("tripType") == "roundtrip" and not state.get("return_date"):
        missing = "return_date"

    known_summary = ", ".join(f"{k}={v}" for k, v in state.items() if v is not None and v != "")

    response_prompt = f"""You are Zoe, a friendly and emotionally intelligent travel assistant.

CONVERSATION:
{history_str}

CURRENT TRIP DETAILS (already collected):
{known_summary or "nothing yet"}

MISSING:
{missing or "nothing, all details collected!"}

Instructions:
- Acknowledge what the user just said naturally
- DO NOT ask for information already collected
- Ask ONLY for the one missing detail: {missing}
- Keep it short, warm, and human (1-2 sentences max)
- Do NOT use dashes or em dashes (— or -) in your response"""

    msg = await generate_text(response_prompt)

    return {
        "type": "followup",
        "message": msg,
        "params": state,
    }