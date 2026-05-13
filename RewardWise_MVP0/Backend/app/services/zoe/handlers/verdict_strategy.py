"""
zoe/handlers/verdict_strategy.py
─────────────────────────────────
Handles verdict interpretation, points strategy, and transfer questions.

Uses call_llm_with_history() with real multi-turn message history.
All three RAG layers injected via grounding.py.
Grounding rule strictly enforced — no invented CPP values or partner lists.
"""

from __future__ import annotations

from typing import Any

from app.services.zoe.llm_caller import call_llm_with_history
from app.services.zoe.grounding import build_ground_truth_block


_BASE_SYSTEM = """You are Zoe — a sharp, trustworthy travel rewards advisor for MyTravelWallet.
You're answering a question about a flight verdict, loyalty strategy, or points redemption.

PERSONALITY:
- Direct and analytical — lead with the answer, not a preamble
- Honest about uncertainty — never invent numbers or availability
- Warm but precise — this is financial territory, be careful

RESPONSE RULES:
- Anchor every number to the injected verdict data or KB chunks
  Example: "Based on the verdict, you're getting 1.8 cpp — that's solid."
- Never invent CPP figures, point costs, cash prices, or award availability
- If the data isn't injected, say so and suggest running a search
- Under 120 words for most answers
- No numbered lists unless user explicitly asks for a comparison
- No markdown headers

CPP BENCHMARKS (for contextualizing verdict data — do not invent CPP values):
  < 1.0 cpp = poor redemption
  1.0–1.5 cpp = ok / baseline
  1.5–2.0 cpp = good
  > 2.0 cpp = excellent
  > 3.0 cpp = exceptional (premium cabin sweet spots)

TRANSFER RULES:
- Only discuss transfer partners that appear in the injected KB chunks
- Always note: transfers are almost always one-way and irreversible
- Never confirm processing time unless it's explicitly in the KB data
- Warn to verify space BEFORE transferring"""


def _build_system(
    rag_chunks: list[dict],
    rag_examples: list[dict],
    rag_corrections: list[dict],
    is_voice: bool,
) -> str:
    ground_truth = build_ground_truth_block(
        rag_chunks=rag_chunks or None,
        rag_examples=rag_examples or None,
        rag_corrections=rag_corrections or None,
    )
    voice_note = "\n[VOICE MODE: plain text only, under 50 words, no markdown, no lists]" if is_voice else ""

    if ground_truth:
        return f"{_BASE_SYSTEM}\n\n{ground_truth}{voice_note}"
    return f"{_BASE_SYSTEM}{voice_note}"


async def handle(
    message: str,
    history: list[dict],
    wallet: list[dict],
    verdict_context: str | None = None,
    *,
    rag_chunks: list[dict] | None = None,
    rag_examples: list[dict] | None = None,
    rag_corrections: list[dict] | None = None,
    is_voice: bool = False,
) -> dict[str, Any]:
    system = _build_system(rag_chunks or [], rag_examples or [], rag_corrections or [], is_voice)

    # Wallet + verdict always injected regardless of RAG
    ground_truth = build_ground_truth_block(
        wallet=wallet,
        verdict_context=verdict_context,
        rag_chunks=rag_chunks or [],
        rag_examples=rag_examples or [],
        rag_corrections=rag_corrections or [],
    )
    full_system = f"{_BASE_SYSTEM}\n\n{ground_truth}" if ground_truth else _BASE_SYSTEM
    if is_voice:
        full_system += "\n[VOICE MODE: plain text only, under 50 words, no markdown, no lists]"

    reply = await call_llm_with_history(
        full_system, history, message,
        temperature=0.3,
        max_tokens=100 if is_voice else 300,
    )

    return {
        "message": reply or "I wasn't able to analyse that — try rephrasing and I'll take another look.",
        "prefill": None,
    }
