"""
zoe/handlers/off_topic.py
──────────────────────────
Handles anything outside Zoe's travel/points domain.
Uses the raw LLM with no injected context — just a gentle personality
wrapper so Zoe stays on-brand while being honest about her scope.

Ticket coverage:
  ✅ "Write me a poem" → polite redirect
  ✅ "What's the weather in Paris?" → redirect
  ✅ "Who won the game last night?" → redirect
  ✅ Generic off-topic → no special context loaded
"""

from __future__ import annotations

from typing import Any

from app.services.zoe.llm_caller import call_llm

_SYSTEM = """You are Zoe, a travel assistant for MyTravelWallet. 
A user has asked you something outside your area of expertise (travel, flights, points, loyalty programs).

Respond warmly but briefly — acknowledge you're not the right tool for this, 
then gently redirect back to what you CAN help with.

Keep the reply under 40 words. Be friendly, not robotic.
Don't apologise excessively. One sentence redirect max.

Examples of good redirects:
- "That's outside my lane! I'm best at flights, points, and travel planning — want help with a trip?"
- "Not my specialty, but I'd love to help you find a great flight or figure out your points."
"""


async def handle(
    message: str,
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
    reply = await call_llm(_SYSTEM, message, temperature=0.6, max_tokens=80)

    return {
        "message": reply or "That's a bit outside my expertise! I'm best with flights, points, and travel planning.",
        "prefill": None,
    }
