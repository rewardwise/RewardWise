"""
zoe/handlers/trip_search.py
────────────────────────────
ARCHITECTURE CHANGE (v2): Travel intelligence layer.

Zoe no longer collects form fields. The search form handles that directly.

This handler now answers questions like:
  - "Is JFK to LAX good on points right now?"
  - "Which program is best for flying to Tokyo?"
  - "Does United charge a close-in booking fee?"
  - "When do award seats typically open on this route?"
  - "Is business class worth using points on AA transpacific?"

Knowledge is grounded in the RAG pipeline:
  - route_intelligence: route-specific sweet spots, historical patterns
  - airline_policies: fees, change/cancel rules, close-in fees
  - historical_patterns: booking windows, availability trends
  - booking_strategies: when/how to redeem

VERDICT INTEGRATION:
  If verdict_context is present (user clicked "Ask Zoe" from results),
  Zoe grounds all analysis in that specific result and the supporting KB data.

Zoe never asks for origin/destination/dates — the form does that.
Zoe can invite the user to run a search if they haven't yet.
"""

from __future__ import annotations

from typing import Any

from app.services.zoe.llm_caller import call_llm_with_history
from app.services.zoe.grounding import build_ground_truth_block


_BASE_SYSTEM = """You are Zoe — a sharp, knowledgeable travel rewards advisor for MyTravelWallet.
You have deep expertise in airline programs, award booking, route-level patterns, and points strategy.

YOUR ROLE (v2):
You are a travel intelligence layer — NOT a form assistant.
The search form collects trip details. You answer smart questions about routes, programs, and strategy.

You know things like:
- Which loyalty programs have the best award rates for specific routes
- When airlines typically release award space on popular routes
- Which airlines charge close-in booking fees and how much
- Historical pricing patterns and seasonal availability trends
- Which transfer partners are best for a given route
- Whether a specific redemption is worth it based on CPP

PERSONALITY:
- Direct and analytical — lead with the answer, never with a preamble
- The well-traveled friend who gives real, specific, actionable advice
- Honest about uncertainty — "I'd verify that" is better than inventing a number
- Warm but precise — this is financial territory

RESPONSE RULES:
- Under 120 words for most answers
- No bullet points unless the question explicitly needs a comparison
- No markdown headers
- No sycophantic openers ("Great question!", "Of course!")
- Always surface valid_as_of when citing policies or fees
- If the user hasn't searched yet and it's relevant, invite them: "Want to run a search and I'll help read the results?"
- Never ask for trip fields — you don't collect origin, destination, dates, or cabin

CPP BENCHMARKS (for contextualizing — do not invent CPP values):
  < 1.0 cpp = poor — pay cash
  1.0–1.5 cpp = ok / baseline
  1.5–2.0 cpp = good
  > 2.0 cpp = excellent
  > 3.0 cpp = exceptional (premium cabin sweet spots)

CLOSE-IN BOOKING RULE:
  Always note when a close-in booking fee applies and remind the user to verify
  current fee amounts — these change and vary by program/airline."""


def _build_system(
    wallet: list[dict],
    verdict_context: str | None,
    rag_chunks: list[dict],
    rag_examples: list[dict],
    rag_corrections: list[dict],
    is_voice: bool,
) -> str:
    ground_truth = build_ground_truth_block(
        wallet=wallet,
        verdict_context=verdict_context,
        rag_chunks=rag_chunks,
        rag_examples=rag_examples,
        rag_corrections=rag_corrections,
    )

    voice_note = "\n[VOICE MODE: plain text only, under 60 words, no markdown, no lists]" if is_voice else ""

    if ground_truth:
        return f"{_BASE_SYSTEM}\n\n{ground_truth}{voice_note}"
    return (
        f"{_BASE_SYSTEM}\n\n"
        f"Note: No KB data retrieved for this query. Answer from general knowledge "
        f"and be explicit about what you're less certain of.{voice_note}"
    )


async def handle(
    message: str,
    history: list[dict],
    wallet: list[dict],
    *,
    verdict_context: str | None = None,
    rag_chunks: list[dict] | None = None,
    rag_examples: list[dict] | None = None,
    rag_corrections: list[dict] | None = None,
    is_voice: bool = False,
) -> dict[str, Any]:
    """
    Travel intelligence handler.

    Called for:
      - General flight/route/program questions (trip_search intent)
      - "Ask Zoe" from search results (verdict_context injected)
      - Any question about booking strategy, fees, or award patterns

    Returns:
      { "message": str }
      No prefill — Zoe does not fill the search form.
    """
    system = _build_system(
        wallet=wallet,
        verdict_context=verdict_context,
        rag_chunks=rag_chunks or [],
        rag_examples=rag_examples or [],
        rag_corrections=rag_corrections or [],
        is_voice=is_voice,
    )

    reply = await call_llm_with_history(
        system,
        history,
        message,
        temperature=0.3,
        max_tokens=80 if is_voice else 250,
    )

    return {
        "message": reply or "I couldn't pull an answer on that — try rephrasing and I'll take another look.",
        "prefill": None,
    }
