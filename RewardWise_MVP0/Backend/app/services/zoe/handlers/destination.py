"""
zoe/handlers/destination.py
────────────────────────────
Handles destination knowledge questions:
  - Things to do, hidden gems, best neighborhoods
  - Best time to visit, weather, seasonality
  - Visa requirements
  - Food scene, culture, safety, local tips
  - Can chain into trip_search: after answering, offer to search flights

Ticket coverage:
  ✅ "What's there to do in Lisbon?"
  ✅ "Best time to visit Japan?"
  ✅ "Do I need a visa for Thailand?"
  ✅ "What's the food scene like in Mexico City?"
  ✅ "Hidden gems in Southeast Asia?"
  ✅ Chains into trip search when wallet is present
  ✅ Voice mode: concise, conversational
"""

from __future__ import annotations

from typing import Any

from app.services.zoe.llm_caller import call_llm

# ── System prompt ─────────────────────────────────────────────────────────────

_SYSTEM = """You are Zoe, a knowledgeable and enthusiastic travel companion for MyTravelWallet.
Right now you're answering destination questions — sharing insider knowledge like a well-traveled friend would.

You know:
- Popular and off-the-beaten-path destinations worldwide
- Best times to visit (weather, crowds, festivals, prices)
- Visa requirements for US passport holders (note: always recommend verifying officially)
- Local culture, food, safety, neighborhoods, day trips
- Practical travel tips (SIM cards, transportation, tipping, etiquette)

RULES:
- Be warm, specific, and opinionated. Don't be a travel brochure.
- Lead with the most useful insight first.
- Keep replies under 120 words unless a comparison genuinely warrants more.
- No bullet points unless asked for a list.
- After answering, if the user has wallet data or it's natural, offer to search flights to that destination.
  Example ending: "Want me to look up flights and see how your points stack up?"
- Voice mode: under 50 words, plain text only, no markdown.
- Never make up visa rules — if uncertain, tell them to check official sources.
"""


async def handle(
    message: str,
    history: list[dict],
    wallet: list[dict],
    *,
    is_voice: bool = False,
) -> dict[str, Any]:
    """
    Returns:
      {
        "message": str,
        "prefill": None,
        "suggest_search": bool,   (hint to frontend that a trip search offer was made)
      }
    """
    system = _SYSTEM
    if is_voice:
        system += "\n\n[VOICE MODE: max 50 words, plain text, no markdown, no lists]"

    sections: list[str] = []

    if wallet:
        programs = [w.get("program", "") for w in wallet if w.get("program")]
        if programs:
            sections.append(f"USER HAS POINTS IN: {', '.join(programs)}")

    history_lines = []
    for turn in history[-6:]:
        role = "Zoe" if turn.get("role") == "assistant" else "User"
        content = str(turn.get("content", "")).strip()[:300]
        if content:
            history_lines.append(f"{role}: {content}")
    if history_lines:
        sections.append("RECENT CONVERSATION:\n" + "\n".join(history_lines))

    sections.append(f"USER: {message}")

    user_prompt = "\n\n".join(sections)

    reply = await call_llm(system, user_prompt, temperature=0.7, max_tokens=250 if is_voice else 500)

    # Detect if the reply ends with a search offer so frontend can track it
    suggest_search = any(
        phrase in (reply or "").lower()
        for phrase in ["want me to look up flights", "want me to search", "shall i search", "should i look up"]
    )

    return {
        "message": reply or "I'd love to help with that destination! Could you tell me a bit more about what you're looking for?",
        "prefill": None,
        "suggest_search": suggest_search,
    }
