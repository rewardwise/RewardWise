"""
zoe/handlers/small_talk.py
───────────────────────────
Handles casual greetings and small talk for Zoe.

This keeps greeting / vibe logic out of zoe_service.py so the main service
can stay focused on routing the real Zoe pipeline.

Important:
- Small talk should NOT intercept trip-search messages like:
  "hey I want to go to Vancouver"
  "yo find me flights to Miami"
  "hi can you search Newark to LA"
- Small talk should catch normal conversational openers like:
  "hey Zoe"
  "hey queen"
  "how are you"
  "I'm good how are you today?"
"""

from __future__ import annotations

import re
from typing import Any

from app.services.zoe.llm_caller import call_llm_with_history


_GREETING_RE = re.compile(
    r"^\s*(?:"
    r"(?:hi|hey|hello|yo|sup|howdy)\b.*|"
    r"what'?s\s+up\b.*|"
    r"good\s+(?:morning|afternoon|evening|day)\b.*|"
    r"start\s*$"
    r")",
    re.IGNORECASE,
)

_SMALL_TALK_RE = re.compile(
    r"\b("
    r"how\s+(?:are|r)\s+(?:you|u)|"
    r"how'?s\s+it\s+going|"
    r"how\s+you\s+doing|"
    r"how\s+are\s+things|"
    r"what'?s\s+good|"
    r"what'?s\s+up|"
    r"i'?m\s+(?:good|great|fine|okay|ok|chilling|alright|tired|excited|stressed)|"
    r"i\s+am\s+(?:good|great|fine|okay|ok|chilling|alright|tired|excited|stressed)|"
    r"doing\s+(?:good|great|fine|okay|ok|alright)|"
    r"thanks\s+for\s+asking|"
    r"thank\s+you\s+for\s+asking"
    r")\b",
    re.IGNORECASE,
)

_TRIP_REQUEST_RE = re.compile(
    r"\b("
    r"want|wanna|need|looking|search|find|book|plan|"
    r"flight|flights|fly|flying|airport|trip|travel|"
    r"go\s+to|going\s+to|headed\s+to|from\s+[a-zA-Z]{2,}|"
    r"one\s*way|round\s*trip|round-trip|return|"
    r"points\s+or\s+cash|cash\s+or\s+points|verdict|use\s+points"
    r")\b",
    re.IGNORECASE,
)


def is_small_talk(text: str) -> bool:
    """
    True for greetings / small talk only.

    Examples:
      "hey queen" → True
      "how are you" → True
      "im good how are you today" → True
      "hey I want to go to Vancouver" → False
      "yo find me flights to Miami" → False
    """
    if not text or not text.strip():
        return False

    t = text.strip()

    # Do not intercept actual trip/search/verdict requests.
    if _TRIP_REQUEST_RE.search(t):
        return False

    return bool(_GREETING_RE.match(t) or _SMALL_TALK_RE.search(t))


async def handle(
    message: str,
    history: list[dict],
    *,
    is_voice: bool = False,
) -> dict[str, Any]:
    """
    Generate a natural greeting/small-talk response.

    Returns:
      {
        "message": str
      }
    """
    system = """You are Zoe, the MyTravelWallet travel assistant.

The user is casually greeting you or making small talk before planning a trip.
Reply warmly and naturally, matching their energy, but do not overdo slang.

Rules:
- Sound like a real friendly travel assistant, not a script
- Respond to what the user said directly
- If they ask how you are, answer naturally
- Lightly steer toward trip planning, points-vs-cash, or travel questions
- Ask at most one casual follow-up question
- Keep it under 45 words
- Do not say the message is outside your lane
- Do not mention internal tools, forms, slots, state, or search logic
- Do not pretend you already know trip details that were not provided
"""

    reply = await call_llm_with_history(
        system,
        history,
        message,
        temperature=0.65,
        max_tokens=70 if is_voice else 90,
        max_history_turns=4,
    )

    return {
        "message": reply or "I’m doing good — ready to help you plan something fun. What trip are we thinking about?"
    }