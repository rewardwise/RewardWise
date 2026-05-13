"""
zoe/handlers/wallet_support.py
───────────────────────────────
Handles wallet management, product FAQ, and booking logistics:
  - Balance lookups ("how many points do I have?")
  - Card / program questions ("which cards do I have connected?")
  - Product FAQ ("what does MyTravelWallet do?", "how is this different from Google Flights?")
  - Booking logistics ("how do I actually book this award?", "should I book direct or through a portal?")
  - Onboarding help ("how do I add a card?")

Architecture:
  - Uses call_llm_with_history() for real conversation context
  - Wallet data injected as ground truth via grounding.py
  - Grounding rule enforced: only cites balances from the wallet payload

Grounding rule for this handler:
  Wallet balances must come from the injected wallet data only.
  Never say "you probably have X points" — only cite what's in the wallet.
"""

from __future__ import annotations

from typing import Any

from app.services.zoe.llm_caller import call_llm_with_history
from app.services.zoe.grounding import build_ground_truth_block


_PRODUCT_KNOWLEDGE = """WHAT MYTRAVELWALLET DOES:
MyTravelWallet (MTW) helps you decide whether to pay cash or use points for a flight,
and identifies the best loyalty program and transfer path to use. It's a deterministic
optimization engine — not a booking tool. You can't book through MTW directly.

KEY FEATURES:
- Connect your loyalty programs (Chase UR, Amex MR, United, Delta, etc.) and see your balances
- Search a flight route and get a clear verdict: "Use Points" / "Pay Cash" / "Wait"
- See the exact cents-per-point (CPP) value of your redemption options
- Understand which programs and transfer paths give you the best value

WHAT MTW DOESN'T DO (be honest about this):
- No hotel search or hotel award optimization (flights only for now)
- No car rental comparison
- No booking — MTW tells you the best option, then you book it on the airline's site
- No real-time fare alerts

HOW TO ADD A PROGRAM:
Go to Wallet → click "Add Program" → select your loyalty program → enter your balance.
MTW doesn't connect to airline accounts directly — you enter balances manually.

HOW TO SEARCH:
Fill in origin, destination, departure date → click Search. Zoe can help you fill the form."""


_BASE_SYSTEM = f"""You are Zoe — a knowledgeable travel assistant for MyTravelWallet.
You're answering a question about the user's wallet, their loyalty programs, or how MTW works.

{_PRODUCT_KNOWLEDGE}

RESPONSE RULES:
- Always cite the user's actual wallet balances when answering balance questions
  Example: "You've got 45,000 Chase UR and 22,000 Delta SkyMiles connected."
- Be direct and specific. If something is in the wallet, reference it. If it's not, say so.
- Never make up features MTW doesn't have
- If the user's question is about something MTW doesn't support (e.g. hotels),
  say so honestly and helpfully — don't pretend
- Under 100 words for most answers
- No bullet points unless listing programs or step-by-step instructions were explicitly requested
- No sycophantic openers"""


def _build_system(is_voice: bool) -> str:
    voice_note = "\n[VOICE MODE: plain text only, under 40 words, no markdown]" if is_voice else ""
    return _BASE_SYSTEM + voice_note


# ── Main handler ──────────────────────────────────────────────────────────────

async def handle(
    message: str,
    history: list[dict],
    wallet: list[dict],
    *,
    is_voice: bool = False,
) -> dict[str, Any]:
    """
    Generate Zoe's response for a wallet / product question.

    Args:
        message:  The user's latest message
        history:  Conversation history from session (real message objects)
        wallet:   User's wallet programs and balances (ground truth)
        is_voice: True for voice interactions

    Returns:
        {
          "message": str,
          "prefill": None,  — wallet handler never fills the search form
        }
    """
    system = _build_system(is_voice)

    # Build ground truth block with wallet data
    ground_truth = build_ground_truth_block(wallet=wallet)

    # Inject ground truth into the system prompt
    full_system = system
    if ground_truth:
        full_system = system + f"\n\n{ground_truth}"

    reply = await call_llm_with_history(
        full_system,
        history,
        message,
        temperature=0.35,
        max_tokens=80 if is_voice else 250,
    )

    return {
        "message": reply or "I'm not sure about that one — could you rephrase and I'll try again?",
        "prefill": None,
    }
