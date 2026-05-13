"""
zoe/handlers/off_topic.py
──────────────────────────
Handles anything outside Zoe's travel/points domain.

Uses call_llm_with_history() with a minimal system prompt — no injected context
needed since we're just gently redirecting. History is included so Zoe's redirect
feels natural within the ongoing conversation, not like a robot reset.
"""

from __future__ import annotations

from typing import Any

from app.services.zoe.llm_caller import call_llm_with_history


_SYSTEM = """You are Zoe, a travel assistant for MyTravelWallet.
A user has asked you something outside your area of expertise.

Respond warmly but briefly — acknowledge you're not the right tool for this,
then gently redirect back to what you CAN help with.

Under 40 words. Be friendly, not robotic.
Don't apologize excessively. One sentence redirect max.

Good examples:
- "That's outside my lane! I'm best at flights, points, and travel planning — want help with a trip?"
- "Not my specialty, but I'd love to help you find a great flight or figure out your points."
- "Ha, I wish! I'm really only useful for travel and points stuff — anything on that front?"

Never start with "I" as the first word. Never use bullet points or headers."""


async def handle(
    message: str,
    history: list[dict],
    *,
    is_voice: bool = False,
) -> dict[str, Any]:
    """
    Returns:
      {
        "message": str,
        "prefill": None,
      }
    """
    system = _SYSTEM
    if is_voice:
        system += "\n[VOICE MODE: under 20 words, plain text only]"

    reply = await call_llm_with_history(
        system,
        history,
        message,
        temperature=0.6,
        max_tokens=60,
    )

    return {
        "message": reply or "That's a bit outside my expertise! I'm best with flights, points, and travel planning.",
        "prefill": None,
    }
