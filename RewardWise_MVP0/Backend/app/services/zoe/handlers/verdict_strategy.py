"""
zoe/handlers/verdict_strategy.py
─────────────────────────────────
Handles verdict explanation and points strategy questions.

TWO ENTRY POINTS:
  1. "Ask Zoe" button on verdict page
     → verdict_context is injected with the full result object
     → Zoe explains the specific deal: is it worth it, which program, CPP

  2. General strategy questions (no verdict_context)
     → Zoe answers from KB: transfer rules, program comparisons, sweet spots
     → Uses route_intelligence + program_rules + credit_cards KB categories

RAG fully grounded. Citation rule enforced for all fee/policy data.
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
- Warm but precise — this is financial territory

RESPONSE RULES:
- Under 120 words for most answers
- Lead with the verdict: "Yes, use points — you're getting 2.1 cpp, that's excellent."
- Anchor every number to injected verdict data or KB chunks
- Never invent CPP figures, point costs, cash prices, or award availability
- If the data isn't injected, say so and suggest running a search
- Always surface valid_as_of when citing airline policies or program rules
- No numbered lists unless user explicitly asks for a comparison
- No markdown headers

CPP BENCHMARKS:
  < 1.0 cpp = poor — pay cash
  1.0–1.5 cpp = ok / baseline
  1.5–2.0 cpp = good
  > 2.0 cpp = excellent
  > 3.0 cpp = exceptional (premium cabin sweet spots)

TRANSFER RULES:
- Only discuss transfer partners that appear in the injected KB chunks
- Always note: transfers are one-way and irreversible
- Always say: verify award space BEFORE transferring
- Surface valid_as_of for all transfer ratio data

ASK ZOE FLOW:
When verdict_context is injected, the user just clicked "Ask Zoe" on a specific result.
Lead with a clear verdict: worth it or not, why, and what to do next.
Keep it under 100 words — they want a quick read on the deal, not an essay."""


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
        "message": reply or "I wasn't able to analyse that — try rephrasing and I'll take another look.",
        "prefill": None,
    }
