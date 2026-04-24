from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional
import json
import re

from fastapi import HTTPException

from app.api.search import run_search
from app.api.validators import SearchParams
from app.rag.flights_retriever import retrieve
from app.services.llm import generate_text

PROGRAM_ALIASES: dict[str, list[str]] = {
    "united": ["United MileagePlus"],
    "delta": ["Delta SkyMiles"],
    "american": ["Citi ThankYou Points", "Chase Ultimate Rewards"],
    "aeroplan": ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    "virginatlantic": ["Chase Ultimate Rewards", "Capital One Miles"],
    "flyingblue": ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    "british": ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    "singapore": ["Chase Ultimate Rewards", "Amex Membership Rewards"],
    "cathay": ["Chase Ultimate Rewards", "Amex Membership Rewards"],
    "emirates": ["Chase Ultimate Rewards", "Amex Membership Rewards"],
    "turkish": ["Chase Ultimate Rewards"],
    "qantas": ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    "avianca": ["Capital One Miles"],
    "lifemiles": ["Capital One Miles"],
    "etihad": ["Amex Membership Rewards"],
    "qatar": ["Amex Membership Rewards"],
    "ana": ["Amex Membership Rewards"],
    "air_france": ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    "hyatt": ["World of Hyatt"],
    "marriott": ["Marriott Bonvoy"],
}

CITY_TO_AIRPORT = {
    "new york": "JFK", "nyc": "JFK", "jfk": "JFK",
    "los angeles": "LAX", "la": "LAX", "lax": "LAX",
    "san francisco": "SFO", "sf": "SFO", "sfo": "SFO",
    "seattle": "SEA", "sea": "SEA",
    "chicago": "ORD", "ord": "ORD",
    "houston": "IAH", "iah": "IAH",
    "dallas": "DFW", "dfw": "DFW",
    "miami": "MIA", "mia": "MIA",
    "atlanta": "ATL", "atl": "ATL",
    "boston": "BOS", "bos": "BOS",
    "washington dc": "IAD", "dc": "IAD", "iad": "IAD",
    "denver": "DEN", "den": "DEN",
    "las vegas": "LAS", "vegas": "LAS", "las": "LAS",
    "orlando": "MCO", "mco": "MCO",
    "phoenix": "PHX", "phx": "PHX",
    "san diego": "SAN", "san": "SAN",
    "minneapolis": "MSP", "msp": "MSP",
    "detroit": "DTW", "dtw": "DTW",
    "philadelphia": "PHL", "phl": "PHL",
    "charlotte": "CLT", "clt": "CLT",
    "tampa": "TPA", "tpa": "TPA",
    "austin": "AUS", "aus": "AUS",
    "nashville": "BNA", "bna": "BNA",
    "salt lake city": "SLC", "slc": "SLC",
    "portland": "PDX", "pdx": "PDX",
    "oakland": "OAK", "oak": "OAK",
    "san jose": "SJC", "sjc": "SJC",
    "london": "LHR", "lhr": "LHR",
    "paris": "CDG", "cdg": "CDG",
    "amsterdam": "AMS", "ams": "AMS",
    "frankfurt": "FRA", "fra": "FRA",
    "munich": "MUC", "muc": "MUC",
    "zurich": "ZRH", "zrh": "ZRH",
    "vienna": "VIE", "vie": "VIE",
    "madrid": "MAD", "mad": "MAD",
    "barcelona": "BCN", "bcn": "BCN",
    "rome": "FCO", "fco": "FCO",
    "milan": "MXP", "mxp": "MXP",
    "dublin": "DUB", "dub": "DUB",
    "lisbon": "LIS", "lis": "LIS",
    "copenhagen": "CPH", "cph": "CPH",
    "stockholm": "ARN", "arn": "ARN",
    "oslo": "OSL", "osl": "OSL",
    "helsinki": "HEL", "hel": "HEL",
    "istanbul": "IST", "ist": "IST",
    "tokyo": "NRT", "nrt": "NRT",
    "osaka": "KIX", "kix": "KIX",
    "seoul": "ICN", "icn": "ICN",
    "beijing": "PEK", "pek": "PEK",
    "shanghai": "PVG", "pvg": "PVG",
    "hong kong": "HKG", "hkg": "HKG",
    "singapore": "SIN", "sin": "SIN",
    "bangkok": "BKK", "bkk": "BKK",
    "kuala lumpur": "KUL", "kul": "KUL",
    "jakarta": "CGK", "cgk": "CGK",
    "manila": "MNL", "mnl": "MNL",
    "delhi": "DEL", "del": "DEL",
    "mumbai": "BOM", "bom": "BOM",
    "bangalore": "BLR", "blr": "BLR",
    "hyderabad": "HYD", "hyd": "HYD",
    "chennai": "MAA", "maa": "MAA",
    "kolkata": "CCU", "ccu": "CCU",
    "doha": "DOH", "doh": "DOH",
    "dubai": "DXB", "dxb": "DXB",
    "abu dhabi": "AUH", "auh": "AUH",
    "sydney": "SYD", "syd": "SYD",
    "melbourne": "MEL", "mel": "MEL",
    "brisbane": "BNE", "bne": "BNE",
    "perth": "PER", "per": "PER",
    "auckland": "AKL", "akl": "AKL",
    "toronto": "YYZ", "yyz": "YYZ",
    "vancouver": "YVR", "yvr": "YVR",
    "montreal": "YUL", "yul": "YUL",
    "calgary": "YYC", "yyc": "YYC",
    "mexico city": "MEX", "mex": "MEX",
    "cancun": "CUN", "cun": "CUN",
    "sao paulo": "GRU", "gru": "GRU",
    "rio": "GIG", "gig": "GIG",
    "buenos aires": "EZE", "eze": "EZE",
    "lima": "LIM", "lim": "LIM",
    "bogota": "BOG", "bog": "BOG",
    "santiago": "SCL", "scl": "SCL",
}

MONTHS = {
    "january": 1, "jan": 1,
    "february": 2, "feb": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}

MISSING_ORDER = ["origin", "destination", "date", "tripType", "travelers", "cabin"]


def normalize_location(value: str) -> str:
    if not value:
        return value
    v = value.lower().strip()
    if v in CITY_TO_AIRPORT:
        return CITY_TO_AIRPORT[v]
    for city, code in CITY_TO_AIRPORT.items():
        if city in v:
            return code
    if len(v) == 3 and v.isalpha():
        return v.upper()
    return value.upper() if len(value) <= 4 else value


def format_wallet_context(wallet: list) -> str:
    if not wallet:
        return "User has no wallet data."
    lines = []
    for card in wallet:
        program = card.get("program") or card.get("name")
        points = int(card.get("points") or card.get("balance") or 0)
        if program and points:
            lines.append(f"{program}: {points} points")
    return "\n".join(lines) if lines else "User has no points yet."


def is_trip_message(text: str) -> bool:
    t = text.lower().strip()
    keywords = [
        "flight", "fly", "from", "to", "cash", "points", "miles", "award",
        "one way", "round trip", "roundtrip", "business", "economy", "first",
        "week earlier", "week later", "traveler", "travellers", "passenger",
    ]
    if any(k in t for k in keywords):
        return True
    if re.search(r"\b[A-Z]{3}\b", text):
        return True
    return False


def is_generic_question(text: str) -> bool:
    t = text.lower().strip()
    starters = ["how ", "what ", "why ", "when ", "where ", "which ", "can i", "should i"]
    if any(t.startswith(s) for s in starters) and not is_trip_message(text):
        return True
    return False


def format_history_for_prompt(history: List[Dict]) -> str:
    if not history:
        return ""
    lines = []
    for msg in history[-10:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


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
    prompt = f"""You are Zoe, a practical travel rewards assistant.
USER WALLET:\n{wallet_context}\nKNOWLEDGE:\n{context}\nRULES:\n- Be concise and grounded
- Do not invent live prices or award data
- If the user asks a non-trip question, answer directly
USER QUESTION:\n{text}"""
    try:
        answer = await generate_text(prompt)
    except Exception:
        answer = None
    return {"type": "answer", "message": answer or "I couldn't answer that. Try asking differently."}


def _normalize_trip_type(value: str | None) -> Optional[str]:
    if not value:
        return None
    v = value.lower().strip()
    if "one" in v:
        return "oneway"
    if "round" in v:
        return "roundtrip"
    return None


def _normalize_cabin(value: str | None) -> Optional[str]:
    if not value:
        return None
    v = value.lower().strip()
    if "premium" in v:
        return "premium_economy"
    if "business" in v:
        return "business"
    if "first" in v:
        return "first"
    if "economy" in v or "coach" in v:
        return "economy"
    return None


def _extract_route(text: str) -> dict:
    extracted: dict[str, str] = {}
    patterns = [
        r"\bfrom\s+([A-Za-z]{3}|[A-Za-z][A-Za-z .'-]{1,30}?)\s+to\s+([A-Za-z]{3}|[A-Za-z][A-Za-z .'-]{1,30}?)(?=\s+(?:on|in|for|with|using|one way|round trip|roundtrip|business|economy|first|next|this|a week|$))",
        r"\b([A-Za-z]{3}|[A-Za-z][A-Za-z .'-]{1,30}?)\s+to\s+([A-Za-z]{3}|[A-Za-z][A-Za-z .'-]{1,30}?)(?=\s+(?:on|in|for|with|using|one way|round trip|roundtrip|business|economy|first|next|this|a week|$))",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if not match:
            continue
        origin = normalize_location(match.group(1).strip())
        destination = normalize_location(match.group(2).strip())
        if origin and destination and origin != destination:
            extracted["origin"] = origin
            extracted["destination"] = destination
            return extracted
    return extracted


def _next_future_month_day(month: int, day: int) -> str:
    today = date.today()
    year = today.year
    while True:
        try:
            candidate = date(year, month, day)
        except ValueError:
            return ""
        if candidate >= today:
            return candidate.isoformat()
        year += 1


def _extract_date_details(text: str) -> dict:
    t = text.strip().lower()
    result: dict[str, str] = {}

    # Explicit ISO date.
    iso = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", t)
    if iso:
        result["date"] = iso.group(1)
        return result

    # Numeric month/day without year.
    md = re.search(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b", t)
    if md:
        month = int(md.group(1))
        day = int(md.group(2))
        year = md.group(3)
        if year:
            year_int = int(year)
            if year_int < 100:
                year_int += 2000
            try:
                result["date"] = date(year_int, month, day).isoformat()
            except ValueError:
                return result
        else:
            resolved = _next_future_month_day(month, day)
            if resolved:
                result["date"] = resolved
        return result

    # Month + day.
    month_names = "|".join(sorted(MONTHS.keys(), key=len, reverse=True))
    month_day = re.search(rf"\b({month_names})\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:,?\s+(\d{{4}}))?\b", t)
    if month_day:
        month = MONTHS[month_day.group(1)]
        day = int(month_day.group(2))
        explicit_year = month_day.group(3)
        if explicit_year:
            try:
                result["date"] = date(int(explicit_year), month, day).isoformat()
            except ValueError:
                return result
        else:
            resolved = _next_future_month_day(month, day)
            if resolved:
                result["date"] = resolved
        return result

    # Month only should never become a concrete date.
    month_only = re.search(rf"\b({month_names})\b", t)
    if month_only:
        result["month_hint"] = month_only.group(1).title()
        return result

    return result


def _extract_travelers(text: str) -> Optional[int]:
    match = re.search(r"\b(\d+)\b", text.strip())
    if match and any(k in text.lower() for k in ["traveler", "travellers", "passenger"]) :
        return int(match.group(1))
    if text.strip().isdigit():
        return int(text.strip())
    return None


def _extract_program_hints(text: str) -> list[str]:
    t = text.lower()
    hints = []
    for phrase in [
        "chase", "amex", "capital one", "citi", "hyatt", "marriott",
        "united", "delta", "american", "flying blue", "aeroplan",
    ]:
        if phrase in t:
            hints.append(phrase)
    return hints


def _extract_new_slots(text: str, current: Dict[str, Any]) -> Dict[str, Any]:
    slots: Dict[str, Any] = {}
    slots.update(_extract_route(text))

    date_info = _extract_date_details(text)
    if date_info.get("date") and not current.get("date"):
        slots["date"] = date_info["date"]
    if date_info.get("month_hint") and not current.get("month_hint") and not current.get("date"):
        slots["month_hint"] = date_info["month_hint"]

    trip_type = _normalize_trip_type(text)
    if trip_type and not current.get("tripType"):
        slots["tripType"] = trip_type
        if trip_type == "oneway":
            slots["return_date"] = None

    cabin = _normalize_cabin(text)
    if cabin and not current.get("cabin"):
        slots["cabin"] = cabin

    travelers = _extract_travelers(text)
    if travelers and not current.get("travelers"):
        slots["travelers"] = travelers

    program_hints = _extract_program_hints(text)
    if program_hints:
        slots["program_hints"] = program_hints

    return slots


def _apply_refinements(text: str, state: Dict[str, Any]) -> Dict[str, Any]:
    updates: Dict[str, Any] = {}
    t = text.lower()

    route_updates = _extract_route(text)
    updates.update(route_updates)

    if state.get("date"):
        try:
            current_date = datetime.strptime(state["date"], "%Y-%m-%d").date()
        except ValueError:
            current_date = None
        if current_date:
            if "week earlier" in t or "a week earlier" in t:
                updates["date"] = (current_date - timedelta(days=7)).isoformat()
            elif "week later" in t or "a week later" in t:
                updates["date"] = (current_date + timedelta(days=7)).isoformat()
            elif "day earlier" in t:
                updates["date"] = (current_date - timedelta(days=1)).isoformat()
            elif "day later" in t:
                updates["date"] = (current_date + timedelta(days=1)).isoformat()

    date_info = _extract_date_details(text)
    if date_info.get("date"):
        updates["date"] = date_info["date"]
    elif date_info.get("month_hint") and not state.get("date"):
        updates["month_hint"] = date_info["month_hint"]

    trip_type = _normalize_trip_type(text)
    if trip_type:
        updates["tripType"] = trip_type
        if trip_type == "oneway":
            updates["return_date"] = None

    cabin = _normalize_cabin(text)
    if cabin:
        updates["cabin"] = cabin

    travelers = _extract_travelers(text)
    if travelers:
        updates["travelers"] = travelers

    if state.get("tripType") == "roundtrip" and not updates.get("return_date"):
        iso_dates = re.findall(r"\b\d{4}-\d{2}-\d{2}\b", text)
        if len(iso_dates) >= 2:
            updates["date"] = iso_dates[0]
            updates["return_date"] = iso_dates[1]

    if updates.get("date") and state.get("return_date") and state.get("tripType") == "roundtrip":
        try:
            dep = datetime.strptime(updates["date"], "%Y-%m-%d").date()
            ret = datetime.strptime(state["return_date"], "%Y-%m-%d").date()
            if dep >= ret:
                updates.pop("date", None)
        except Exception:
            pass

    return updates


def _friendly_validation_message(exc: Exception, state: Dict[str, Any]) -> str:
    detail = str(exc)
    if "Date cannot be in the past" in detail:
        return "That date resolved to the past. Please send the departure date as YYYY-MM-DD, for example 2026-10-15."
    if "Date must be in YYYY-MM-DD format" in detail:
        return "Please send the date as YYYY-MM-DD, for example 2026-10-15."
    if "return_date must be after departure date" in detail:
        return "Your return date needs to be after the departure date. Please send a later return date."
    if state.get("month_hint") and not state.get("date"):
        return f"I still need the exact departure date in {state['month_hint']}. Please send it as October 15 or YYYY-MM-DD."
    return "I need one more detail before I can run the trip search. Please send the missing field in a concrete format."


def _summarize_trip(state: Dict[str, Any]) -> str:
    bits = []
    if state.get("origin") and state.get("destination"):
        bits.append(f"{state['origin']} to {state['destination']}")
    if state.get("date"):
        bits.append(state["date"])
    elif state.get("month_hint"):
        bits.append(f"sometime in {state['month_hint']}")
    if state.get("tripType"):
        bits.append("round trip" if state["tripType"] == "roundtrip" else "one way")
    if state.get("travelers"):
        bits.append(f"{state['travelers']} traveler{'s' if state['travelers'] != 1 else ''}")
    if state.get("cabin"):
        bits.append(state["cabin"].replace("_", " "))
    return ", ".join(bits)


def _missing_slot(state: Dict[str, Any]) -> Optional[str]:
    for key in MISSING_ORDER:
        if not state.get(key):
            return key
    if state.get("tripType") == "roundtrip" and not state.get("return_date"):
        return "return_date"
    return None


def _prompt_for_missing(missing: str, state: Dict[str, Any]) -> str:
    if missing == "origin":
        return "Where are you flying from?"
    if missing == "destination":
        return "Where do you want to fly to?"
    if missing == "date":
        if state.get("month_hint"):
            return f"What departure date in {state['month_hint']} should I check? Please send the exact date like October 15 or YYYY-MM-DD."
        return "What departure date should I check? Please send it as YYYY-MM-DD or a date like October 15."
    if missing == "tripType":
        return "Is this one way or round trip?"
    if missing == "return_date":
        return "What return date should I check? Please send it as YYYY-MM-DD."
    if missing == "travelers":
        return "How many travelers should I price?"
    if missing == "cabin":
        return "Which cabin should I price: economy, business, premium economy, or first?"
    return "Tell me one more trip detail so I can finish this search."


def _apply_state_updates(state: Dict[str, Any], updates: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(state)
    for key, value in updates.items():
        if value is None and key != "return_date":
            continue
        if key in ["origin", "destination"]:
            merged[key] = normalize_location(str(value))
        elif key == "travelers":
            merged[key] = int(value)
        elif key == "cabin":
            merged[key] = str(value).lower()
        elif key == "tripType":
            merged[key] = _normalize_trip_type(str(value)) or merged.get("tripType")
            if merged.get("tripType") == "oneway":
                merged["return_date"] = None
        elif key == "program_hints":
            existing = set(merged.get("program_hints") or [])
            merged["program_hints"] = sorted(existing.union(set(value)))
        else:
            merged[key] = value
    return merged


def _validate_ready_state(state: Dict[str, Any]) -> SearchParams:
    return SearchParams(
        origin=state["origin"],
        destination=state["destination"],
        date=state["date"],
        cabin=state.get("cabin", "economy"),
        travelers=int(state.get("travelers", 1)),
        return_date=state.get("return_date"),
    )


def _strip_redundant_verdict_lead(explanation: str, recommendation: str) -> str:
    if not explanation:
        return explanation
    normalized = explanation.strip()
    patterns = [
        rf"^{re.escape(recommendation)}[:.!\-\s]+",
        rf"^{re.escape(recommendation.lower())}[:.!\-\s]+",
        rf"^{re.escape(recommendation.title())}[:.!\-\s]+",
    ]
    for pattern in patterns:
        cleaned = re.sub(pattern, "", normalized, flags=re.IGNORECASE).strip()
        if cleaned != normalized:
            return cleaned[:1].upper() + cleaned[1:] if cleaned else cleaned
    return normalized


def _build_zoe_message(search_data: Dict[str, Any]) -> str:
    verdict = search_data.get("verdict") or {}
    recommendation = verdict.get("verdict_label") or ("Pay Cash" if verdict.get("pay_cash") else "Use Points")
    confidence = (verdict.get("confidence") or "medium").title()
    confidence_reason = verdict.get("confidence_reason") or ""
    explanation = _strip_redundant_verdict_lead(
        verdict.get("explanation") or verdict.get("verdict") or "",
        recommendation,
    )
    metrics = verdict.get("metrics") or {}
    data_quality = verdict.get("data_quality") or "full"
    next_step = verdict.get("next_step") or {}

    summary_bits = [
        f"I checked {search_data.get('origin')} to {search_data.get('destination')}",
        f"for {search_data.get('travelers', 1)} traveler{'s' if search_data.get('travelers', 1) != 1 else ''}",
        search_data.get("cabin", "economy").replace("_", " "),
        "round trip" if search_data.get("is_roundtrip") else "one way",
        f"on {search_data.get('date')}",
    ]

    lines = [
        " ".join(summary_bits) + ".",
        "",
        f"**Verdict: {recommendation}**",
    ]

    if explanation:
        lines.append(explanation)

    lines.append(f"**Confidence:** {confidence}")

    if confidence_reason:
        lines.append(confidence_reason)

    cash_price = metrics.get("cash_price")
    points_cost = metrics.get("points_cost")
    taxes = metrics.get("taxes")
    cpp = metrics.get("cpp")
    savings = metrics.get("estimated_savings")

    metric_bits = []
    if cash_price is not None:
        metric_bits.append(f"Cash ${cash_price:.0f}")
    if points_cost:
        metric_bits.append(f"Points {int(points_cost):,}")
    if taxes:
        metric_bits.append(f"Taxes ${float(taxes):.0f}")
    if cpp:
        metric_bits.append(f"CPP {float(cpp):.2f}")
    if savings:
        metric_bits.append(f"Savings about ${float(savings):.0f}")
    if metric_bits:
        lines.extend(["", "**Numbers:** " + " · ".join(metric_bits)])

    if data_quality != "full":
        missing = verdict.get("missing_sources") or []
        pretty_missing = ", ".join(m.replace("_", " ") for m in missing) if missing else "some live data"
        lines.extend(["", f"**Heads up:** this answer used partial data. Missing: {pretty_missing}."])

    if next_step.get("label"):
        lines.extend(["", f"**Next step:** {next_step['label']}"])

    return "\n".join(lines)


def _build_suggestions(state: Dict[str, Any], verdict: Optional[Dict[str, Any]] = None, stage: str = "post_verdict") -> list[dict]:
    if stage != "post_verdict":
        return []

    suggestions: list[dict] = []
    next_step = (verdict or {}).get("next_step") or {}
    if next_step.get("label") and next_step.get("prompt"):
        suggestions.append({"emoji": "✨", "label": next_step["label"], "query": next_step["prompt"]})

    if state.get("date"):
        origin = state.get("origin", "this route")
        destination = state.get("destination", "")
        route_text = f"{origin} to {destination}".strip()
        suggestions.append({
            "emoji": "🗓️",
            "label": "Check a week earlier",
            "query": f"What about {route_text} a week earlier?",
        })
    if state.get("cabin") != "business":
        suggestions.append({"emoji": "💺", "label": "Check business", "query": "What if I do business instead?"})
    if state.get("tripType") != "roundtrip":
        suggestions.append({"emoji": "🔁", "label": "Make it round trip", "query": "What if I make this round trip?"})

    deduped = []
    seen = set()
    for item in suggestions:
        q = item.get("query")
        if q and q not in seen:
            seen.add(q)
            deduped.append(item)
    return deduped[:3]


async def handle_zoe(payload: Dict[str, Any], request=None) -> Dict[str, Any]:
    text = (payload.get("message") or "").strip()
    wallet = payload.get("wallet", [])
    incoming = payload.get("slots", {}) or {}
    history = payload.get("history", []) or []
    slot = payload.get("slot")

    print("📩 USER:", text)
    print("📦 INCOMING SLOTS:", incoming)

    state: Dict[str, Any] = {}
    for key, value in incoming.items():
        if value is None or value == "":
            continue
        if key in ["origin", "destination"]:
            state[key] = normalize_location(str(value))
        elif key == "travelers":
            try:
                state[key] = int(value)
            except (TypeError, ValueError):
                continue
        elif key == "tripType":
            normalized = _normalize_trip_type(str(value))
            if normalized:
                state[key] = normalized
        elif key == "cabin":
            normalized = _normalize_cabin(str(value))
            if normalized:
                state[key] = normalized
        else:
            state[key] = value

    if text.lower() == "start":
        return {
            "type": "followup",
            "message": "Tell me the trip you have in mind and I’ll turn it into a clear points-vs-cash verdict. Start with the route, then I’ll ask only for what’s still missing.",
            "params": state,
            "suggestions": [
                {"emoji": "✈️", "label": "JFK to Paris", "query": "Can I use points from JFK to Paris in October?"},
                {"emoji": "🏝️", "label": "LAX to Tokyo", "query": "Should I use points for LAX to Tokyo in business?"},
            ],
        }

    if slot:
        updates = {slot: text}
        state = _apply_state_updates(state, updates)
    else:
        state = _apply_state_updates(state, _extract_new_slots(text, state))

    # Refinement routing should win over generic assistant fallback when a trip exists.
    if state and ("earlier" in text.lower() or "later" in text.lower() or "instead" in text.lower() or "same trip" in text.lower() or re.search(r"\bwhat about\b", text.lower())):
        state = _apply_state_updates(state, _apply_refinements(text, state))

    # Keep month hints only as hints. Never fabricate a concrete date from them.
    if state.get("month_hint") and state.get("date"):
        state.pop("month_hint", None)

    print("🧠 STATE AFTER MERGE:", state)

    active_trip = bool(state.get("origin") or state.get("destination") or state.get("date") or state.get("month_hint"))
    if not active_trip and is_generic_question(text):
        result = await handle_question(text, wallet)
        result["params"] = state
        return result

    missing = _missing_slot(state)
    if missing:
        return {
            "type": "followup",
            "message": _prompt_for_missing(missing, state),
            "params": state,
            "suggestions": _build_suggestions(state, stage="collecting"),
        }

    # Final validation and search handoff.
    try:
        params = _validate_ready_state(state)
    except Exception as exc:
        return {
            "type": "followup",
            "message": _friendly_validation_message(exc, state),
            "params": state,
            "suggestions": _build_suggestions(state, stage="collecting"),
        }

    if request is None:
        return {
            "type": "error",
            "message": "I need a live session before I can run a search. Please reload and try again.",
            "params": state,
        }

    try:
        search_data = await run_search(request=request, params=params)
        verdict = search_data.get("verdict") or {}
        message = _build_zoe_message(search_data)
        return {
            "type": "search_result",
            "message": message,
            "data": verdict,
            "search_data": search_data,
            "search_id": search_data.get("search_id"),
            "verdict_id": search_data.get("verdict_id"),
            "params": state,
            "suggestions": _build_suggestions(state, verdict, stage="post_verdict"),
        }
    except HTTPException as exc:
        friendly = str(exc.detail) if getattr(exc, "detail", None) else "I hit a search error."
        if "Missing authorization header" in friendly or "Invalid or expired session" in friendly:
            friendly = "Please log in again so I can run a live search for you."
        elif "Date" in friendly:
            friendly = _friendly_validation_message(Exception(friendly), state)
        else:
            friendly = "Sorry, I ran into an issue fetching live results. Please try again."
        return {
            "type": "error",
            "message": friendly,
            "params": state,
            "suggestions": _build_suggestions(state, stage="collecting"),
        }
    except Exception as exc:
        print("❌ SEARCH ERROR:", repr(exc))
        return {
            "type": "error",
            "message": "Sorry, I ran into an issue fetching live results. Please try again.",
            "params": state,
            "suggestions": _build_suggestions(state, stage="collecting"),
        }
