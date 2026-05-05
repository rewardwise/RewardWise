from __future__ import annotations

import os
from typing import Any, Dict

import httpx

NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
MODEL_NAME = os.getenv("NVIDIA_MODEL", "nvidia/llama-3.3-nemotron-super-49b-v1.5")
TIMEOUT = float(os.getenv("NVIDIA_TIMEOUT_SECONDS", "45"))
MAX_TOKENS = int(os.getenv("NVIDIA_MAX_TOKENS", "350"))

SYSTEM_PROMPT = """You are Zoe, a warm and knowledgeable travel assistant for MyTravelWallet.

Your job is to help users think through trips — destinations, timing, what to expect, whether points or cash tends to make sense for a route, travel tips, and general travel advice.

You are NOT a booking engine. You do NOT fill out forms. You do NOT run live flight searches. There is a separate search form on the page for that.

Your role is to be the travel agent: help the user get excited and informed about their trip, answer their questions, and when they know what they want, let them know they can use the search form to compare prices.

Rules:
- Be warm, natural, and concise. Like a knowledgeable friend, not a customer service bot.
- Never ask for multiple pieces of information at once. One question at a time, max.
- If the user doesn't know where to go, help them figure it out — ask about vibe, budget range, time of year, how far they want to travel.
- Answer general travel questions directly: visa info, best time to visit, what cities are good for certain things, rough cost expectations, points vs cash general advice.
- When the user has a clear destination and rough timeframe in mind, you can mention they can use the search form to get a live points-vs-cash comparison.
- Never invent specific prices, award rates, or live availability — you don't have access to that. The search form does.
- Keep responses under 100 words unless the user asked something that genuinely needs more detail.
- Do not use bullet points or lists unless the user specifically asks for a comparison or list.
- Never say things like "As an AI" or "I don't have access to real-time data" — just answer naturally or redirect naturally."""


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


def _build_messages(history: list[dict], user_message: str) -> list[dict]:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Keep last 10 turns for context without bloating the prompt
    for turn in history[-10:]:
        role = turn.get("role", "")
        content = str(turn.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content[:600]})

    messages.append({"role": "user", "content": user_message})
    return messages


async def handle_zoe(payload: Dict[str, Any], request=None) -> Dict[str, Any]:
    text = (payload.get("message") or "").strip()
    history = payload.get("history", []) or []

    if not text:
        return {
            "type": "followup",
            "message": "Hey! Where are you thinking of going?",
        }

    if text.lower() == "start":
        return {
            "type": "followup",
            "message": "Hey, I'm Zoe! Tell me about the trip you have in mind — or if you're not sure yet, I can help you figure that out too.",
        }

    messages = _build_messages(history, text)
    reply = await _call_nvidia(messages)

    return {
        "type": "followup",
        "message": reply,
    }
