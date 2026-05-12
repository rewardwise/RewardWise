"""
zoe/handlers/verdict_strategy.py
─────────────────────────────────
Handles the merged verdict_strategy intent which covers:
  - Verdict interpretation ("is this a good deal?", "what does this verdict mean?")
  - Points & wallet strategy ("should I use my Chase points?", "what's the best card?")
  - Transfer & redemption ("can I transfer Amex to Air France?", "transfer partners for Chase UR?")
  - CPP threshold analysis
  - Award vs revenue comparisons

These are merged into one handler because they share the same context:
wallet data + active verdict + points knowledge. The LLM figures out
which sub-question is being asked.

Ticket coverage:
  ✅ "Is this a good deal?" / "should I book this or wait?"
  ✅ "Why is Zoe recommending points over cash?"
  ✅ "Can I do better with my United miles?"
  ✅ CPP / award vs revenue explanation
  ✅ Transfer partner routing ("Can I transfer Amex to Air France?")
  ✅ "I need 80k miles for JAL — how do I get there?"
  ✅ "What's the best card to use for this trip?"
  ✅ Voice mode: speakable, concise
"""

from __future__ import annotations

from typing import Any

from app.services.zoe.llm_caller import call_llm, build_messages

# ── System prompt ─────────────────────────────────────────────────────────────

_SYSTEM = """You are Zoe, a sharp travel rewards expert for MyTravelWallet.
You help users understand their verdicts, decide whether to use points or cash, and navigate award travel strategy.

You know deeply:
- CPP (cents per point) and what thresholds matter (e.g. >1.5cpp is generally good for most programs)
- Airline alliances and which programs transfer to which
- Transfer partners and ratios:
    Chase UR → United 1:1, Hyatt 1:1, BA 1:1, Air France 1:1, Southwest 1:1, Singapore 1:1
    Amex MR → Air France 1:1, BA 1:1, ANA 1:1, Singapore 1:1, Delta 1:1, Hilton 1:2, Marriott 1:1
    Capital One → Air France 1:1, Turkish 2:1.5, Avianca 1:1, BA 1:1
    Citi ThankYou → Turkish 1:1, Air France 1:1, Avianca 1:1, Singapore 1:1
    Bilt → United 1:1, Hyatt 1:1, AA 1:1, Air France 1:1
- Award sweet spots (e.g. ANA round-the-world, AA on Cathay, Flying Blue promo awards)
- When paying cash beats using points (low CPP, no availability, etc.)
- Opportunity cost of using points vs banking them

RULES:
- Reference the user's actual wallet balances when answering. Be specific: "You have 45,000 Chase UR points..."
- If a verdict is provided, anchor your answer to it. Don't make up numbers.
- Be direct. Lead with the answer, not a preamble.
- Keep replies under 120 words unless a comparison genuinely needs more.
- Never use numbered lists unless explicitly asked for a comparison.
- One follow-up question max, only if truly needed.
- Voice mode: under 50 words, plain text, no markdown.

When asked about transfers specifically:
- State the ratio, any transfer minimums, and processing time if notable
- Mention if a transfer is one-way / irreversible
- Suggest whether the transfer makes sense given their balance and the goal
"""


async def handle(
    message: str,
    history: list[dict],
    wallet: list[dict],
    verdict_context: str | None = None,
    *,
    is_voice: bool = False,
) -> dict[str, Any]:
    """
    Returns:
      {
        "message": str,
        "prefill": None,   (this handler never fills the search form)
      }
    """
    system = _SYSTEM
    if is_voice:
        system += "\n\n[VOICE MODE: max 50 words, plain text, no markdown, no lists]"

    # Build the user prompt with all available context
    sections: list[str] = []

    if wallet:
        wallet_lines = [
            f"  - {w.get('program', 'Unknown')}: {w.get('points', 0):,} pts"
            for w in wallet
        ]
        sections.append("USER WALLET:\n" + "\n".join(wallet_lines))

    if verdict_context:
        sections.append(f"CURRENT VERDICT CONTEXT:\n{verdict_context}")

    history_lines = []
    for turn in history[-8:]:
        role = "Zoe" if turn.get("role") == "assistant" else "User"
        content = str(turn.get("content", "")).strip()[:400]
        if content:
            history_lines.append(f"{role}: {content}")
    if history_lines:
        sections.append("RECENT CONVERSATION:\n" + "\n".join(history_lines))

    sections.append(f"USER: {message}")

    user_prompt = "\n\n".join(sections)

    reply = await call_llm(system, user_prompt, temperature=0.5, max_tokens=300 if is_voice else 600)

    return {
        "message": reply or "I wasn't able to analyse that — try rephrasing and I'll take another look.",
        "prefill": None,
    }
