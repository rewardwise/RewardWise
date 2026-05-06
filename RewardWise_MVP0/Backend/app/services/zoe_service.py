from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, Optional

import httpx

from app.db.client import get_db_client

NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
MODEL_NAME = os.getenv("NVIDIA_MODEL", "meta/llama-3.3-70b-instruct")
TIMEOUT = float(os.getenv("NVIDIA_TIMEOUT_SECONDS", "45"))
MAX_TOKENS = int(os.getenv("NVIDIA_MAX_TOKENS", "700"))

SYSTEM_PROMPT = """You are Zoe, a sharp, warm, and deeply knowledgeable travel assistant for MyTravelWallet — a platform that helps travelers decide whether to use points or pay cash for flights.

You have extensive knowledge of:
- World airports, their cities, hubs, and which airlines operate there
- Airline alliances, frequent flyer programs, and which credit card points transfer to which airline programs
- Transfer partners and ratios (e.g. Chase UR → United at 1:1, Amex MR → Air France at 1:1, Capital One → Turkish at 2:1.5)
- General award pricing sweet spots and strategies
- Travel tips, visa requirements, best times to visit destinations, local culture, activities, food, and hidden gems
- Points and miles strategy (when to use points vs cash, what CPP thresholds matter, positioning for future trips)

The user's profile and wallet data will be injected at the start of each conversation. Use this to personalize your answers — reference their specific cards and balances when relevant, and their past searches to understand their travel patterns.

How to behave:
- Be friendly, confident, and helpful. Like a knowledgeable travel friend, not a customer service bot.
- Lead with the answer. If someone asks about Croatia, talk about Croatia. Don't open with four clarifying questions.
- Ask at most ONE follow-up question per response, only when you genuinely need it. Never a numbered list of questions.
- Keep responses under 100 words unless the question genuinely warrants more. Never cut off mid-sentence — wrap up cleanly.
- No bullet points or numbered lists unless the user asks for a comparison.

Search form pre-fill:
- As the conversation progresses, if you have enough information to fill the search form, do it.
- "Enough information" means: origin airport or city, destination airport or city, and a departure date (or rough timeframe). Travelers and cabin are optional — default to 1 / economy if not stated.
- When you pre-fill, naturally mention it in your reply. Example: "Seattle to JFK in economy sounds good — I've filled that in for you, just hit Search when you're ready."
- Don't make a big deal of it, just weave it in naturally. Never say "I've pre-filled the form" as your main point — lead with travel advice first.
- At the end of EVERY response, output a JSON block (and only when you have enough info) in exactly this format on its own line:
  PREFILL:{"origin":"SEA","destination":"JFK","date":"2026-06-15","return_date":"2026-06-22","travelers":1,"cabin":"economy","tripType":"roundtrip"}
- Only include the PREFILL line when you genuinely have enough info. Omit it entirely otherwise.
- For dates: use YYYY-MM-DD format. If the user says "next Friday" or "in two weeks", make a reasonable estimate from today. If you genuinely don't know, omit the date field.
- For airports: use IATA codes when you're confident (SEA, JFK, LAX, EWR etc). If the user says a city name, use the main airport for that city.
- tripType: "roundtrip" if a return date is mentioned, "oneway" otherwise.

Points vs cash guidance:
- You do NOT have live cash fares or award availability inside this chat. Never claim or imply that you do.
- When asked "should I use points or cash?" without exact prices, give a directional take — not a fake verdict.
- NEVER invent specific point costs, cash prices, or award availability.
- When the user needs live numbers, say "Pull the live options in the search form, then I can help you interpret the result."
- If the user provides actual cash and point numbers, calculate cents-per-point directly: CPP = (cash price / points) * 100. Tell them the number, whether it's good or weak, and give a lean.

Wallet references:
- Only reference the user's specific point balances if wallet data is available AND directly relevant.
- Never say "your massive balance" or assume balances are high.

Verdict interpretation (after the search form runs):
- "Pay Cash" usually means the cash fare is cheap relative to the points required.
- "Use Points" means the cents-per-point value is strong enough that points beat cash.
- "Wait" usually means the cash fare looks high compared to typical pricing.

What not to do:
- Don't say "I ran the numbers" unless numbers were actually provided.
- Don't sound like an error state when redirecting to the search form.
- Don't ask for every trip field before giving general guidance."""


async def _fetch_user_context(user_id: str) -> str:
    try:
        supabase = get_db_client()

        cards_res = supabase.table("cards")\
            .select("card_name, points_balance, reward_programs(name)")\
            .eq("user_id", user_id)\
            .execute()

        cards = cards_res.data or []
        if cards:
            wallet_lines = []
            for c in cards:
                prog = (c.get("reward_programs") or {}).get("name", "Unknown program")
                bal = c.get("points_balance", 0)
                name = c.get("card_name", "Unknown card")
                wallet_lines.append(f"  - {name} ({prog}): {bal:,} points")
            wallet_text = "User's rewards wallet:\n" + "\n".join(wallet_lines)
        else:
            wallet_text = "User has no cards added yet."

        searches_res = supabase.table("searches")\
            .select("origin, destination, departure_date, cabin, trip_type")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .limit(10)\
            .execute()

        searches = searches_res.data or []
        if searches:
            search_lines = [
                f"  - {s['origin']} → {s['destination']} | {s.get('departure_date','')} | {s.get('cabin','economy')} | {s.get('trip_type','roundtrip')}"
                for s in searches
            ]
            searches_text = "User's recent searches:\n" + "\n".join(search_lines)
        else:
            searches_text = "User has no recent searches."

        user_res = supabase.table("users")\
            .select("display_name, email")\
            .eq("id", user_id)\
            .single()\
            .execute()

        user_data = user_res.data or {}
        name = user_data.get("display_name") or user_data.get("email", "").split("@")[0] or "there"

        return f"User's name: {name}\n\n{wallet_text}\n\n{searches_text}"

    except Exception as e:
        print("⚠️ Could not fetch user context:", e)
        return ""


def _extract_prefill(raw_reply: str) -> tuple[str, Optional[dict]]:
    """
    Strip the PREFILL:... line from the reply and parse it.
    Returns (clean_reply, prefill_dict_or_None).
    """
    prefill = None
    lines = raw_reply.split("\n")
    clean_lines = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("PREFILL:"):
            try:
                json_str = stripped[len("PREFILL:"):]
                data = json.loads(json_str)
                # Validate minimum required fields
                if data.get("origin") and data.get("destination"):
                    prefill = data
            except Exception:
                pass  # Malformed JSON — ignore
        else:
            clean_lines.append(line)

    clean_reply = "\n".join(clean_lines).strip()
    return clean_reply, prefill


async def _call_nvidia(messages: list[dict]) -> str:
    api_key = os.getenv("NVIDIA_API_KEY")
    if not api_key:
        return "I'm having trouble connecting right now. Please try again in a moment."

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                f"{NVIDIA_BASE_URL.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MODEL_NAME,
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": MAX_TOKENS,
                },
            )
        if resp.status_code >= 400:
            print("❌ NVIDIA ERROR:", resp.status_code, resp.text[:300])
            return "I'm having trouble connecting right now. Please try again."

        content = resp.json()["choices"][0]["message"]["content"]
        return content.strip() if isinstance(content, str) else ""

    except Exception as e:
        print("❌ ZOE LLM ERROR:", e)
        return "I'm having a little trouble right now — give me a second and try again."


def _build_messages(user_context: str, history: list[dict], user_message: str) -> list[dict]:
    system = SYSTEM_PROMPT
    if user_context:
        system += f"\n\n--- USER CONTEXT ---\n{user_context}"

    messages = [{"role": "system", "content": system}]

    for turn in history[-10:]:
        role = turn.get("role", "")
        content = str(turn.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content[:1000]})

    messages.append({"role": "user", "content": user_message})
    return messages


async def handle_zoe(payload: Dict[str, Any], request=None) -> Dict[str, Any]:
    text = (payload.get("message") or "").strip()
    history = payload.get("history", []) or []
    user_id = payload.get("user_id")

    if not text:
        return {"type": "followup", "message": "Hey! What's on your travel radar?"}

    if text.lower() == "start":
        return {
            "type": "followup",
            "message": "Hey, I'm Zoe! I can help you figure out where to go, whether your points are worth using, what to do at a destination, or just think through your next trip. What's on your mind?",
        }

    user_context = ""
    if user_id:
        user_context = await _fetch_user_context(user_id)

    messages = _build_messages(user_context, history, text)
    raw_reply = await _call_nvidia(messages)

    # Extract prefill data if the model included it
    clean_reply, prefill = _extract_prefill(raw_reply)

    result: Dict[str, Any] = {
        "type": "followup",
        "message": clean_reply,
    }

    if prefill:
        result["prefill"] = prefill
        print("✈️ ZOE PREFILL:", prefill)

    return result
