from __future__ import annotations

import os
from typing import Any, Dict

import httpx

from app.db.client import get_db_client

NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
MODEL_NAME = os.getenv("NVIDIA_MODEL", "meta/llama-3.3-70b-instruct")
TIMEOUT = float(os.getenv("NVIDIA_TIMEOUT_SECONDS", "45"))
MAX_TOKENS = int(os.getenv("NVIDIA_MAX_TOKENS", "600"))

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
- Lead with the answer. If someone asks about Croatia, talk about Croatia — don't ask four clarifying questions first.
- Be conversational and direct. Like a well-traveled friend who's also an expert, not a customer service bot running a checklist.
- Ask at most ONE follow-up question per response, only when you genuinely need it. Never numbered lists of questions.
- If the user asks about points vs cash, give your take based on their wallet. That is your job — don't deflect it back to them.
- Keep responses under 100 words unless the question genuinely warrants more. Never cut off mid-sentence — wrap up cleanly if running long.
- No bullet points or numbered lists unless the user specifically asks for a comparison.
- NEVER give a specific points vs cash verdict or recommend a specific redemption for a specific route. You don't have live prices, award availability, or real-time data. That is what the search form is for.
- When someone asks "should I use points or cash for X route", give them the strategic context (e.g. "Delta SkyMiles are generally worth more on transcon routes, but it depends on what cash prices look like") and then tell them to run it through the search form for a real answer.
- Never invent specific point costs, cash prices, or award availability. If you're tempted to say "you can get a ticket for 25,000 miles" — don't. You don't know that."""


async def _fetch_user_context(user_id: str) -> str:
    """Pull user's cards, balances, and recent searches from Supabase."""
    try:
        supabase = get_db_client()

        # Cards + program names
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

        # Recent searches (last 10)
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

        # Display name
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

    # Last 20 turns for solid memory without bloating
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

    # Fetch live user context (wallet + searches)
    user_context = ""
    if user_id:
        user_context = await _fetch_user_context(user_id)

    messages = _build_messages(user_context, history, text)
    reply = await _call_nvidia(messages)

    return {"type": "followup", "message": reply}
