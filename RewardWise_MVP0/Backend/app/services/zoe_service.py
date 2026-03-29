from typing import Dict, Any, List
from app.api.validators import SearchParams
from app.services.llm import generate_text
import re
import json
from app.rag.flights_retriever import retrieve
from app.services.verdict_service import generate_verdict
from datetime import datetime
from datetime import timedelta

CITY_TO_AIRPORT = {
    # 🇺🇸 Major US Cities
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

    # 🌍 Europe
    "london": "LHR", "paris": "CDG", "amsterdam": "AMS",
    "frankfurt": "FRA", "munich": "MUC", "zurich": "ZRH",
    "vienna": "VIE", "madrid": "MAD", "barcelona": "BCN",
    "rome": "FCO", "milan": "MXP", "dublin": "DUB",
    "lisbon": "LIS", "copenhagen": "CPH", "stockholm": "ARN",
    "oslo": "OSL", "helsinki": "HEL", "istanbul": "IST",

    # 🌏 Asia
    "tokyo": "NRT", "osaka": "KIX", "seoul": "ICN",
    "beijing": "PEK", "shanghai": "PVG", "hong kong": "HKG",
    "singapore": "SIN", "bangkok": "BKK", "kuala lumpur": "KUL",
    "jakarta": "CGK", "manila": "MNL", "delhi": "DEL",
    "mumbai": "BOM", "bangalore": "BLR", "hyderabad": "HYD",
    "chennai": "MAA", "kolkata": "CCU", "doha": "DOH",
    "dubai": "DXB", "abu dhabi": "AUH",

    # 🌏 Australia & NZ
    "sydney": "SYD", "melbourne": "MEL", "brisbane": "BNE",
    "perth": "PER", "auckland": "AKL",

    # 🌎 Canada
    "toronto": "YYZ", "vancouver": "YVR", "montreal": "YUL", "calgary": "YYC",

    # 🌎 Latin America
    "mexico city": "MEX", "cancun": "CUN", "sao paulo": "GRU",
    "rio": "GIG", "buenos aires": "EZE", "lima": "LIM",
    "bogota": "BOG", "santiago": "SCL",
}


def normalize_location(value: str):
    if not value:
        return value
    v = value.lower().strip()

    # 1. City dictionary first (catches "nyc"→"JFK", "la"→"LAX", etc.)
    #    Exact match
    if v in CITY_TO_AIRPORT:
        return CITY_TO_AIRPORT[v]

    # 2. Substring match ("new york city" still hits "new york")
    for city, code in CITY_TO_AIRPORT.items():
        if city in v:
            return code

    # 3. Space-stripped match ("newyork" → "new york", "losangeles" → "los angeles")
    v_nospace = v.replace(" ", "").replace("-", "")
    for city, code in CITY_TO_AIRPORT.items():
        if city.replace(" ", "") == v_nospace:
            return code

    # 4. Partial space-stripped ("newyorkcity")
    for city, code in CITY_TO_AIRPORT.items():
        if city.replace(" ", "") in v_nospace:
            return code

    # 5. Already a valid 3-letter IATA code
    if len(v) == 3 and v.isalpha():
        return v.upper()

    # 6. Unknown short string — uppercase and hope for the best
    return value.upper() if len(value) <= 4 else value


def format_wallet_context(wallet):
    if not wallet:
        return "User has no wallet data."
    lines = []
    for card in wallet:
        program = card.get("program") or card.get("name")
        points = card.get("points") or card.get("balance") or 0
        points = int(points)
        if program and points:
            lines.append(f"{program}: {points} points")
    return "\n".join(lines) if lines else "User has no points yet."


def is_question(text: str) -> bool:
    text = text.lower()
    keywords = ["how", "what", "why", "when", "where", "points", "miles", "balance"]
    return any(k in text for k in keywords)


def looks_like_date_range(text: str) -> bool:
    """
    Only treat 'to' as a date separator when the text contains month names or numbers
    that look like dates — NOT when it looks like a route (e.g. 'OAK to LAX').
    """
    months = [
        "january","february","march","april","may","june","july",
        "august","september","october","november","december",
        "jan","feb","mar","apr","jun","jul","aug","sep","oct","nov","dec"
    ]
    t = text.lower()
    has_month = any(m in t for m in months)
    has_digit = bool(re.search(r'\d', t))
    return has_month or has_digit


def parse_date_string(date_str: str):
    """Try multiple date formats, return a date object or None."""
    if not date_str:
        return None
    date_str = date_str.strip()
    formats = [
        "%B %d %Y", "%B %d, %Y",
        "%b %d %Y", "%b %d, %Y",
        "%Y-%m-%d", "%m/%d/%Y",
        "%B %d", "%b %d",        # no year — will use current year
    ]
    for fmt in formats:
        try:
            parsed = datetime.strptime(date_str, fmt)
            # If no year in format, assume next occurrence
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
            return {
                "type": "answer",
                "message": "You haven't added any loyalty programs yet. Add your cards in Wallet to track your points."
            }
        lines = []
        total = 0
        for card in wallet:
            program = card.get("program") or card.get("name")
            points = int(card.get("points") or card.get("balance") or 0)
            if program:
                lines.append(f"{program}: {points:,} points")
                total += points
        return {
            "type": "answer",
            "message": "Here's your current points balance:\n\n"
                       + "\n".join(lines)
                       + f"\n\nTotal: {total:,} points"
        }

    context = await retrieve_context(text)
    wallet_context = format_wallet_context(wallet)

    prompt = f"""You are Zoe, a smart travel rewards assistant.

USER WALLET:
{wallet_context}

KNOWLEDGE:
{context}

RULES:
- Use wallet data when relevant
- Use knowledge to explain value
- Be concise and practical

USER QUESTION:
{text}"""

    try:
        answer = await generate_text(prompt)
    except Exception as e:
        print("LLM ERROR:", str(e))
        answer = None

    return {
        "type": "answer",
        "message": answer or "I couldn't answer that. Try asking differently."
    }


def format_history_for_prompt(history: List[Dict]) -> str:
    """Format conversation history for inclusion in LLM prompts."""
    if not history:
        return ""
    lines = []
    for msg in history[-10:]:  # Last 10 messages for context
        role = msg.get("role", "user")
        content = msg.get("content", "")
        prefix = "User" if role == "user" else "Zoe"
        lines.append(f"{prefix}: {content}")
    return "\n".join(lines)


async def handle_zoe(payload: Dict[str, Any], request=None) -> Dict[str, Any]:
    text = payload.get("message", "")
    wallet = payload.get("wallet", [])
    incoming = payload.get("slots", {}) or {}
    history = payload.get("history", [])  # conversation history from frontend

    print("📩 USER:", text)
    print("📦 INCOMING SLOTS:", incoming)

    # Start with a clean, normalized copy of whatever the frontend already knows
    state = {}
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

    # ── Greeting ─────────────────────────────────────────────────────────────
    if text.lower().strip() in ["start", "hi", "hello", "hey"]:
        return {
            "type": "answer",
            "message": "Hey! Good to see you ✈️ Ready to plan your next trip?",
            "params": state,
        }

    # ── Question handler ──────────────────────────────────────────────────────
    if is_question(text):
        result = await handle_question(text, wallet)
        result["params"] = state  # always return current state
        return result

    # ── RAG context ───────────────────────────────────────────────────────────
    context = await retrieve_context(text)

    # ── LLM extraction ────────────────────────────────────────────────────────
    history_str = format_history_for_prompt(history)

    extract_prompt = f"""You are extracting travel details from a conversation.

CONVERSATION SO FAR:
{history_str}

LATEST USER MESSAGE:
{text}

CURRENT KNOWN TRIP DETAILS:
{json.dumps(state)}

Extract ONLY NEW information the user just provided. Return a JSON object with these keys:
origin, destination, date, return_date, tripType, cabin, travelers, emotion

Rules:
- If a field is already known (shown above), return null for it — do NOT repeat or change it
- If not mentioned in the latest message, return null
- tripType: "oneway" or "roundtrip" or null
- cabin: "economy", "business", or "first" or null
- travelers: integer or null
- dates: ISO format YYYY-MM-DD if possible, otherwise natural language

Return ONLY valid JSON, no explanation."""

    raw = await generate_text(extract_prompt)

    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start == -1 or end == 0:
            raise ValueError("No JSON found")
        data = json.loads(raw[start:end])
    except Exception as e:
        print("❌ JSON PARSE ERROR:", str(e), "\nRAW:", raw)
        data = {}

    # ── Date range detection ("June 5 to June 10") ────────────────────────────
    # Only split on "to" if the text actually looks like dates, not a route
    if " to " in text.lower() and looks_like_date_range(text):
        parts = re.split(r"\s+to\s+", text, maxsplit=1, flags=re.IGNORECASE)
        if len(parts) == 2:
            # Make sure neither part looks like an airport code
            p0, p1 = parts[0].strip(), parts[1].strip()
            if not (len(p0) <= 4 and p0.isalpha() and len(p1) <= 4 and p1.isalpha()):
                if not state.get("date"):
                    state["date"] = p0
                if not state.get("return_date"):
                    state["return_date"] = p1
                if not state.get("tripType"):
                    state["tripType"] = "roundtrip"

    # ── Merge extracted fields — NEVER overwrite already-known slots ──────────
    for k, v in data.items():
        if not v:
            continue
        # Skip if we already have this value — state is king
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

    # ── Soft defaults: only infer tripType, never fake travelers/cabin ──────────
    if not state.get("tripType") and state.get("return_date"):
        state["tripType"] = "roundtrip"

    print("🧠 STATE AFTER MERGE:", state)

    # ── Normalize types ───────────────────────────────────────────────────────
    if isinstance(state.get("travelers"), str):
        try:
            state["travelers"] = int(state["travelers"])
        except ValueError:
            state["travelers"] = 1

    # ── Date normalization ────────────────────────────────────────────────────
    for date_key in ["date", "return_date"]:
        val = state.get(date_key)
        if val and isinstance(val, str):
            parsed = parse_date_string(val)
            if parsed:
                state[date_key] = str(parsed)  # keep as ISO string

    # ── Check if all required slots are filled → trigger search ───────────────
    def is_ready_for_search(s: dict) -> bool:
        # Core fields the decision engine always needs
        if not all(s.get(k) for k in ["origin", "destination", "date", "travelers", "cabin"]):
            return False
        # tripType must be explicit
        if not s.get("tripType"):
            return False
        # roundtrip also needs a return date
        if s.get("tripType") == "roundtrip" and not s.get("return_date"):
            return False
        return True

    is_ready = is_ready_for_search(state)
    print("✅ IS READY:", is_ready, "| STATE:", state)

    if is_ready:
        try:
            import asyncio
            from app.services.seats_service import search_award_availability
            from app.services.pricing_service import get_cash_price
            from app.utils.math_utils import calculate_cpp

            origin      = state["origin"]
            destination = state["destination"]
            dep_date    = state["date"]
            ret_date    = state.get("return_date")
            cabin       = state.get("cabin", "economy")
            travelers   = int(state.get("travelers", 1))
            is_roundtrip = bool(ret_date)

            # ── Parallel award + price fetch (no auth needed — internal services) ──
            async def outbound():
                raw = await search_award_availability(origin, destination, dep_date, cabin)
                return [a for a in raw if a.get("remaining_seats", 0) >= travelers]

            async def ret():
                if not ret_date:
                    return []
                raw = await search_award_availability(destination, origin, ret_date, cabin)
                return [a for a in raw if a.get("remaining_seats", 0) >= travelers]

            outbound_awards, cash_data, return_awards = await asyncio.gather(
                outbound(), get_cash_price(origin, destination, dep_date, cabin, travelers, ret_date), ret()
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

            user_programs = [
                (card.get("program") or card.get("name"))
                for card in wallet if (card.get("program") or card.get("name"))
            ]

            # Guard: if cash_price is None, verdict_service will crash on format strings
            # Pass 0.0 as a sentinel so verdict logic still runs (shows "no price data")
            safe_cash_price = cash_price if cash_price is not None else 0.0

            verdict = await generate_verdict(
                origin=origin, destination=destination, date=dep_date,
                cabin=cabin, travelers=travelers,
                is_roundtrip=is_roundtrip, return_date=ret_date,
                cash_price=safe_cash_price,
                award_options=award_options,
                return_award_options=return_award_options,
                user_programs=user_programs or None,
            )

            # ── Build a structured, hallucination-proof explanation prompt ──────
            pay_cash   = verdict.get("pay_cash", False)
            winner     = verdict.get("winner") or {}
            verdict_txt = verdict.get("verdict", "")
            booking_note = verdict.get("booking_note", "")
            confidence = verdict.get("confidence", "")
            w_program  = winner.get("program", "")
            w_points   = winner.get("points", 0)
            w_taxes    = winner.get("taxes", 0)
            w_cpp      = winner.get("cpp", 0)

            if pay_cash:
                decision_line = f"DECISION: PAY CASH — do NOT mention using points as the recommended action."
            else:
                decision_line = (
                    f"DECISION: USE POINTS — winner is {w_program} at {w_points:,} pts "
                    f"+ ${w_taxes:.2f} fees (CPP: {w_cpp:.2f}). "
                    f"Do NOT say the user should pay cash."
                )

            explanation = await generate_text(f"""You are Zoe, a friendly travel assistant summarising a flight search result.

ROUTE: {origin} → {destination} | {dep_date} | {cabin} | {travelers} traveler(s)
CASH PRICE: {f'${safe_cash_price:.0f}' if safe_cash_price else 'not available'}
{decision_line}
CONFIDENCE: {confidence}
VERDICT TEXT (use this, do not contradict it): "{verdict_txt}"
BOOKING NOTE: {booking_note}

Instructions:
- Open with 1 sentence acknowledging the route
- State the verdict clearly — if USE POINTS name the program and points cost; if PAY CASH say so
- Mention the cash price if available
- Close with the booking note in 1 sentence
- Keep it to 3-4 sentences total, warm and direct
- NEVER say $0 unless cash_price is literally 0
- NEVER contradict the DECISION above""")

            return {
                "type": "search_result",
                "message": explanation or verdict_txt or "Here's what I found for you!",
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

    # ── Determine next missing slot (in natural conversation order) ─────────────
    # Ask tripType AFTER date so we know if it's one-way or roundtrip
    missing_order = ["origin", "destination", "date", "tripType", "travelers", "cabin"]
    missing = next((k for k in missing_order if not state.get(k)), None)

    # If tripType=roundtrip but no return_date yet, that's the next missing thing
    if not missing and state.get("tripType") == "roundtrip" and not state.get("return_date"):
        missing = "return_date"

    # ── Generate human-like follow-up ─────────────────────────────────────────
    known_summary = ", ".join(
        f"{k}={v}" for k, v in state.items() if v is not None and v != ""
    )

    response_prompt = f"""You are Zoe, a friendly and emotionally intelligent travel assistant.

CONVERSATION:
{history_str}

CURRENT TRIP DETAILS (already collected):
{known_summary or "nothing yet"}

MISSING:
{missing or "nothing — all details collected!"}

Instructions:
- Acknowledge what the user just said naturally
- DO NOT ask for information already collected
- Ask ONLY for the one missing detail: {missing}
- Keep it short, warm, and human (1-2 sentences max)"""

    msg = await generate_text(response_prompt)

    return {
        "type": "followup",
        "message": msg,
        "params": state,  # ← always return current state so frontend stays in sync
    }