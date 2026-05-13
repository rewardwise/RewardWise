"""
zoe/handlers/destination.py
────────────────────────────
Handles destination knowledge questions and open-ended trip exploration.

Uses call_llm_with_history() with real multi-turn message history.
All three RAG layers are injected as ground truth via grounding.py:
  - Layer 3 corrections (PM negative examples) — highest priority
  - Layer 1 KB chunks (factual knowledge)
  - Layer 2 examples (tone/format guidance)

Hard boundary: never collects trip fields or touches the search form.
"""

from __future__ import annotations

from typing import Any

from app.services.zoe.llm_caller import call_llm_with_history
from app.services.zoe.grounding import build_ground_truth_block


_BASE_SYSTEM = """You are Zoe — a knowledgeable, opinionated travel companion for MyTravelWallet.
You're answering a destination question or helping someone figure out where to go.

Be the well-traveled friend who gives real, specific, useful advice.
Share opinions. Be concrete. "Rajasthan in December is incredible — dry, not too hot, great light"
beats "India is a fascinating country with many attractions."

RESPONSE RULES:
- Under 120 words unless the question genuinely needs more
- No numbered lists unless user explicitly asked for steps
- No markdown headers or excessive bullet points
- No sycophantic openers ("Great question!", "Of course!")
- Be direct — lead with the answer, not a preamble
- If you don't know something specific, say so and suggest where to verify

VISA RULE:
Always recommend verifying visa requirements with the official embassy or State Department
website, even when you have KB data on it. Rules change.

BRIDGE RULE:
If it feels natural, offer ONE gentle invitation to search for flights at the end.
Example: "Want me to help you find flights there?"
Do NOT collect trip fields or mention the search form explicitly."""


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
    voice_note = "\n[VOICE MODE: plain text only, under 50 words, no markdown]" if is_voice else ""

    if ground_truth:
        return f"{_BASE_SYSTEM}\n\n{ground_truth}{voice_note}"
    return (
        f"{_BASE_SYSTEM}\n\nNote: No knowledge base data was retrieved. "
        f"Answer from general knowledge and be clear about uncertainty.{voice_note}"
    )


async def handle(
    message: str,
    history: list[dict],
    wallet: list[dict],
    *,
    rag_chunks: list[dict] | None = None,
    rag_examples: list[dict] | None = None,
    rag_corrections: list[dict] | None = None,
    is_voice: bool = False,
) -> dict[str, Any]:
    system = _build_system(rag_chunks or [], rag_examples or [], rag_corrections or [], is_voice)

    reply = await call_llm_with_history(
        system, history, message,
        temperature=0.5,
        max_tokens=80 if is_voice else 280,
    )

    return {
        "message": reply or "Tell me more about where you're thinking — I'd love to help you plan.",
        "prefill": None,
    }
