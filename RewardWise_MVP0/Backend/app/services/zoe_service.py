from typing import Dict, Any
from app.api.search import run_search
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
    "new york": "JFK",
    "nyc": "JFK",
    "los angeles": "LAX",
    "la": "LAX",
    "san francisco": "SFO",
    "sf": "SFO",
    "seattle": "SEA",
    "chicago": "ORD",
    "houston": "IAH",
    "dallas": "DFW",
    "miami": "MIA",
    "atlanta": "ATL",
    "boston": "BOS",
    "washington dc": "IAD",
    "dc": "IAD",
    "denver": "DEN",
    "las vegas": "LAS",
    "vegas": "LAS",
    "orlando": "MCO",
    "phoenix": "PHX",
    "san diego": "SAN",
    "minneapolis": "MSP",
    "detroit": "DTW",
    "philadelphia": "PHL",
    "charlotte": "CLT",
    "tampa": "TPA",
    "austin": "AUS",
    "nashville": "BNA",
    "salt lake city": "SLC",
    "portland": "PDX",
    "oakland": "OAK",
    "san jose": "SJC",

    # 🌍 Europe
    "london": "LHR",
    "paris": "CDG",
    "amsterdam": "AMS",
    "frankfurt": "FRA",
    "munich": "MUC",
    "zurich": "ZRH",
    "vienna": "VIE",
    "madrid": "MAD",
    "barcelona": "BCN",
    "rome": "FCO",
    "milan": "MXP",
    "dublin": "DUB",
    "lisbon": "LIS",
    "copenhagen": "CPH",
    "stockholm": "ARN",
    "oslo": "OSL",
    "helsinki": "HEL",
    "istanbul": "IST",

    # 🌏 Asia
    "tokyo": "NRT",
    "osaka": "KIX",
    "seoul": "ICN",
    "beijing": "PEK",
    "shanghai": "PVG",
    "hong kong": "HKG",
    "singapore": "SIN",
    "bangkok": "BKK",
    "kuala lumpur": "KUL",
    "jakarta": "CGK",
    "manila": "MNL",
    "delhi": "DEL",
    "mumbai": "BOM",
    "bangalore": "BLR",
    "hyderabad": "HYD",
    "chennai": "MAA",
    "kolkata": "CCU",
    "doha": "DOH",
    "dubai": "DXB",
    "abu dhabi": "AUH",

    # 🌏 Australia & NZ
    "sydney": "SYD",
    "melbourne": "MEL",
    "brisbane": "BNE",
    "perth": "PER",
    "auckland": "AKL",

    # 🌎 Canada
    "toronto": "YYZ",
    "vancouver": "YVR",
    "montreal": "YUL",
    "calgary": "YYC",

    # 🌎 Latin America
    "mexico city": "MEX",
    "cancun": "CUN",
    "sao paulo": "GRU",
    "rio": "GIG",
    "buenos aires": "EZE",
    "lima": "LIM",
    "bogota": "BOG",
    "santiago": "SCL",
}

def normalize_location(value: str):
    if not value:
        return value

    v = value.lower().strip()

    # already airport code
    if len(v) == 3:
        return v.upper()

    # partial match 
    for city, code in CITY_TO_AIRPORT.items():
        if city in v:
            return code

    return value

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

    return "\n".join(lines)

# ------------------------------------------------------------
# 1. SIMPLE INTENT DETECTION (NO LLM)
# ------------------------------------------------------------

def is_question(text: str) -> bool:
    text = text.lower()
    keywords = ["how", "what", "why", "when", "where", "points", "miles", "balance"]
    return any(k in text for k in keywords)






# ------------------------------------------------------------
# 3. VALIDATION
# ------------------------------------------------------------

def validate(slots):
    try:
        return SearchParams(**slots)
    except:
        return None


# ------------------------------------------------------------
# 4. RAG 
# ------------------------------------------------------------

async def retrieve_context(query: str):
    results = await retrieve(query, top_k=3)

    if not results:
        return "No relevant knowledge found."

    context = "\n".join([
        f"{r.title}\n{r.snippet}"
        for r in results
    ])

    return context

async def handle_question(text: str, wallet):
    text_lower = text.lower()
    

    # HARD RULE: handle points questions directly
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
            points = card.get("points") or card.get("balance") or 0
            points = int(points) or 0

            if program:
                lines.append(f"{program}: {points:,} points")
                total += points

        return {
            "type": "answer",
            "message": "Here’s your current points balance:\n\n"
                       + "\n".join(lines)
                       + f"\n\nTotal: {total:,} points"
        }

    # --------------------------------------------------------
    # ⬇️ fallback to LLM for everything else
    # --------------------------------------------------------
    context = await retrieve_context(text)
    wallet_context = format_wallet_context(wallet)

    prompt = f"""
    You are Zoe, a smart travel rewards assistant.

    USER WALLET:
    {wallet_context}

    KNOWLEDGE:
    {context}

    RULES:
    - Use wallet data when relevant
    - Use knowledge to explain value
    - Be concise and practical

    USER QUESTION:
    {text}
    """

    try:
        answer = await generate_text(prompt)
    except Exception as e:
        print("LLM ERROR:", str(e))
        answer = None

    return {
        "type": "answer",
        "message": answer or "I couldn't answer that. Try asking differently."
    }

async def handle_zoe(payload: Dict[str, Any]) -> Dict[str, Any]:
    text = payload.get("message", "")
    wallet = payload.get("wallet", [])
    state = payload.get("slots", {}) or {}

    

    if text.lower().strip() in ["start", "hi", "hello", "hey"]:
        return {
            "type": "answer",
            "message": "Hey! Good to see you ✈️ Ready to plan your next trip?"
        }


    if is_question(text):
        return await handle_question(text, wallet)

    #
    context = await retrieve_context(text)


    extract_prompt = f"""
    Understand the user message and extract travel details.

    Return JSON:
    origin, destination, date, return_date, tripType, cabin, travelers, emotion

    If unknown → null

    User:
    {text}
    """


    raw = await generate_text(extract_prompt)

    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1

        if start == -1 or end == -1:
            raise ValueError("No JSON found")

        json_str = raw[start:end]
        data = json.loads(json_str)

    except Exception as e:
        print("❌ JSON PARSE ERROR:", str(e))
        print("RAW LLM OUTPUT:", raw)
        data = {}


    for k, v in data.items():
        if v and not state.get(k):   
            if k in ["origin", "destination"]:
                state[k] = normalize_location(v)
            else:
                state[k] = v

    if data.get("tripType"):
        val = data["tripType"].lower()

        if "one" in val:
            state["tripType"] = "oneway"
            state["return_date"] = None

        elif "round" in val:
            state["tripType"] = "roundtrip"
    # Normalize
    if state.get("cabin") and isinstance(state["cabin"], str):
        state["cabin"] = state["cabin"].lower()


    try:
        required_base = ["origin", "destination", "date", "travelers", "cabin"]

        is_ready = all(state.get(k) for k in required_base)

        # if roundtrip → also need return_date
        if state.get("tripType") == "roundtrip":
            is_ready = is_ready and state.get("return_date")

        if is_ready:
            if not state.get("tripType"):
                state["tripType"] = "oneway"
                # FIX TYPES
            if isinstance(state.get("travelers"), str):
                state["travelers"] = int(state["travelers"])

            # normalize date (basic fix for now)
            if isinstance(state.get("date"), str):
                parsed = None

                try:
                    parsed = datetime.strptime(state["date"], "%B %d %Y")
                except:
                    try:
                        parsed = datetime.strptime(state["date"], "%b %d %Y")
                    except:
                        parsed = None

                if parsed:
                    state["date"] = parsed.date()

            try:
                params = SearchParams(**state)
            except Exception as e:
                print("Validation failed, using raw state:", e)
                params = None

            search_results = await run_search(params if params else state)

            verdict = await generate_verdict(
                origin=params.origin,
                destination=params.destination,
                date=params.date,
                cabin=params.cabin,
                travelers=params.travelers,
                is_roundtrip=params.return_date is not None,
                return_date=params.return_date,
                cash_price=search_results.get("cash_price"),
                award_options=search_results.get("award_options", []),
                return_award_options=search_results.get("return_award_options", []),
                user_programs=[
                    (card.get("program") or card.get("name"))
                    for card in wallet
                    if (card.get("program") or card.get("name"))
                ],
            )

            explanation = await generate_text(f"""
            You are Zoe, a friendly travel assistant.

            Context:
            {context}

            Verdict:
            {verdict}

            Explain this clearly, warmly, and briefly.
            End with a positive tone.
            """)

            return {
                "type": "search_result",
                "message": explanation or "Here’s what I found for you",
                "data": verdict,
                "params": state
            }

    except Exception as e:
        print("SEARCH ERROR:", e)

    # --------------------------------------------------------
    # 7. Ask next useful question (ONLY one)
    # --------------------------------------------------------
    missing_order = ["origin", "destination", "date", "travelers", "cabin"]

    missing = next((k for k in missing_order if not state.get(k)), None)

    # only ask return_date IF roundtrip already chosen
    if not missing and state.get("tripType") == "roundtrip" and not state.get("return_date"):
        missing = "return_date"

    # --------------------------------------------------------
    # 8. Generate human-like response
    # --------------------------------------------------------
    emotion = data.get("emotion")

    response_prompt = f"""
    You are Zoe, a friendly and emotionally intelligent travel assistant.

    User said:
    {text}

    Known trip info exists internally.

    Missing:
    {missing}

    Missing:
    {missing}

    Instructions:
    - If user expressed emotion → acknowledge briefly
    - Guide the user toward booking naturally
    - Ask ONLY for the missing detail
    - Keep it short, warm, and human
    """

    msg = await generate_text(response_prompt)

    return {
        "type": "followup",
        "message": msg,
        "params": state
    }