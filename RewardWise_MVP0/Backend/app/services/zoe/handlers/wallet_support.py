"""
zoe/handlers/wallet_support.py
───────────────────────────────
Handles wallet management, product FAQ, and booking logistics:
  - Balance lookups ("how many points do I have?")
  - Card / program questions ("which cards do I have connected?")
  - Product FAQ ("what does MyTravelWallet do?", "how is this different from Google Flights?")
  - Booking logistics ("how do I actually book this award?", "should I book direct or through a portal?")
  - Onboarding help ("how do I add a card?")

Ticket coverage:
  ✅ "How many points do I have?"
  ✅ "Which cards do I have connected?"
  ✅ "My Chase balance is wrong"
  ✅ "What does MyTravelWallet actually do?"
  ✅ "How is this different from Google Flights?"
  ✅ "Can I search for hotels too?"
  ✅ "How do I actually book this award flight?"
  ✅ "Should I book direct or through a portal?"
  ✅ "What fees will I pay on this?"
  ✅ Voice mode: concise
"""

from __future__ import annotations

from typing import Any

from app.services.zoe.llm_caller import call_llm

# ── Product knowledge injected into every wallet/support call ─────────────────

_PRODUCT_KNOWLEDGE = """
MyTravelWallet (MTW) product facts:
- MTW helps travelers decide whether to use loyalty points or pay cash for flights.
- Users connect their credit card loyalty programs (Chase UR, Amex MR, Delta SkyMiles, etc.)
- MTW calculates the CPP (cents per point) and gives a verdict: "Use Points" or "Pay Cash"
- MTW currently supports flight search only — no hotels yet
- MTW is NOT a booking platform. It helps you decide, then hands off to the airline or OTA.
- MTW is different from Google Flights: Google shows prices; MTW tells you whether your points are worth using.
- To add a card/program: go to Wallet Setup and search for your loyalty program, then enter your balance.
- To update a balance: go to Wallet Setup and edit the program's point count.
- If a balance looks wrong: manually update it in Wallet Setup — MTW doesn't auto-sync balances yet.
- Booking after a verdict: MTW links you to the airline's or partner's site with the search pre-filled.
- Award fees: depend on the airline program. MTW shows the cash equivalent but fees are charged by the airline.
- Book direct (airline website) vs. portal: direct is usually better for award seats; portals for cash fares.
- Cancel/change policies: award tickets are set by the airline program, not MTW.
"""

# ── System prompt ─────────────────────────────────────────────────────────────

_SYSTEM = f"""You are Zoe, a friendly and knowledgeable assistant for MyTravelWallet.
Right now you're answering questions about the user's wallet, the product, or booking logistics.

{_PRODUCT_KNOWLEDGE}

RULES:
- Always reference the user's actual wallet data when answering balance questions.
  Example: "You've got 45,000 Chase UR and 22,000 Delta SkyMiles connected."
- Be direct and specific. Don't make up features MTW doesn't have.
- If the user's question is about something MTW doesn't support (e.g. hotels), say so honestly and helpfully.
- Keep replies under 100 words.
- No bullet points unless listing programs or steps explicitly requested.
- Voice mode: under 40 words, plain text only.
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
      }
    """
    system = _SYSTEM
    if is_voice:
        system += "\n\n[VOICE MODE: max 40 words, plain text, no markdown]"

    sections: list[str] = []

    if wallet:
        wallet_lines = [
            f"  - {w.get('program', 'Unknown')}: {w.get('points', 0):,} pts"
            for w in wallet
        ]
        sections.append("USER WALLET:\n" + "\n".join(wallet_lines))
    else:
        sections.append("USER WALLET: (no programs connected yet)")

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

    reply = await call_llm(system, user_prompt, temperature=0.4, max_tokens=200 if is_voice else 400)

    return {
        "message": reply or "I'm not sure about that one — could you rephrase and I'll try again?",
        "prefill": None,
    }
