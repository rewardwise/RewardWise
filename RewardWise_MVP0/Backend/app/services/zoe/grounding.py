"""
zoe/grounding.py
─────────────────
Assembles all ground truth data injected into every respond call.

Sources:
  - Wallet data (from DB / frontend payload)
  - Verdict object (from active search result)
  - KB chunks — Layer 1 (published articles)
  - Interaction examples — Layer 2 (high-signal response pairs)
  - PM corrections — Layer 3 (negative examples, highest priority)

The grounding rule (enforced in every system prompt):
  "Every factual claim must come from one of the injected sources.
   If a fact is not here, say so and offer to search. Never guess."
"""

from __future__ import annotations


# ── Section formatters ────────────────────────────────────────────────────────

def format_wallet(wallet: list[dict]) -> str:
    if not wallet:
        return "WALLET: (no programs connected — do not invent balances)"
    lines = ["WALLET (cite these exact balances — do not invent or estimate):"]
    for w in wallet:
        program = w.get("program") or w.get("program_name") or "Unknown Program"
        points = w.get("points") or w.get("points_balance") or 0
        lines.append(f"  - {program}: {int(points):,} points")
    return "\n".join(lines)


def format_verdict(verdict_context: str | None) -> str:
    if not verdict_context:
        return ""
    return (
        "VERDICT (anchor all analysis to this data — do not invent numbers):\n"
        + verdict_context.strip()
    )


def format_kb_chunks(chunks: list[dict]) -> str:
    if not chunks:
        return ""
    lines = ["KNOWLEDGE BASE (ground truth — only cite facts from here):"]
    for i, chunk in enumerate(chunks, 1):
        title = chunk.get("title", f"Source {i}")
        content = (chunk.get("content") or "").strip()[:900]
        if content:
            lines.append(f"\n[{i}] {title}")
            lines.append(content)
    return "\n".join(lines)


def format_examples(examples: list[dict]) -> str:
    """
    Layer 2: format interaction examples as implicit few-shot guidance.
    These show Zoe what good responses look like for similar questions.
    """
    if not examples:
        return ""
    lines = ["EXAMPLE RESPONSES (reference tone and structure — do not copy verbatim):"]
    for ex in examples[:2]:
        user_msg = (ex.get("user_message") or "").strip()[:200]
        zoe_resp = (ex.get("zoe_response") or "").strip()[:400]
        if user_msg and zoe_resp:
            lines.append(f"\nExample — User: {user_msg}")
            lines.append(f"Example — Zoe: {zoe_resp}")
    return "\n".join(lines)


def format_corrections(corrections: list[dict]) -> str:
    """
    Layer 3: format PM corrections as explicit negative examples.
    Injected with highest priority — Zoe must not repeat these failure patterns.
    """
    if not corrections:
        return ""
    lines = ["⚠️ KNOWN FAILURE PATTERNS — DO NOT REPEAT THESE:"]
    for c in corrections:
        failure_type = c.get("failure_type", "quality issue")
        original = (c.get("original_response") or "").strip()[:300]
        corrected = (c.get("corrected_response") or "").strip()[:300]
        notes = c.get("notes", "")
        if original and corrected:
            lines.append(f"\n[Failure: {failure_type}]")
            lines.append(f"BAD (do not do this): {original}")
            lines.append(f"GOOD (do this instead): {corrected}")
            if notes:
                lines.append(f"Why: {notes}")
    return "\n".join(lines)


def format_resolution_notes(notes: list[str]) -> str:
    if not notes:
        return ""
    return "FIELD RESOLUTIONS:\n" + "\n".join(f"  - {n}" for n in notes)


# ── The grounding rule ────────────────────────────────────────────────────────

GROUNDING_RULE = """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GROUNDING RULE — NON-NEGOTIABLE:
Every factual claim you make must come from one of the injected sources above
(wallet, verdict, knowledge base chunks).
If a fact is NOT in those sources:
  • Say "I don't have that specific number — let me point you to a search" OR
  • Say "I'd want to verify that — run a search and I'll help interpret it"
Never infer, estimate, or guess:
  - Point values or CPP figures
  - Award availability or seat counts
  - Transfer partner lists or ratios
  - Cash prices
  - Wallet balances not in the injected wallet
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"""


# ── Main builder ──────────────────────────────────────────────────────────────

def build_ground_truth_block(
    *,
    wallet: list[dict] | None = None,
    verdict_context: str | None = None,
    rag_chunks: list[dict] | None = None,
    rag_examples: list[dict] | None = None,
    rag_corrections: list[dict] | None = None,
    resolution_notes: list[str] | None = None,
) -> str:
    """
    Assemble all ground truth sections into a single block
    for injection into the respond-call system prompt.

    Priority order in the prompt:
      1. Corrections (Layer 3) — highest, injected first as negative examples
      2. KB chunks (Layer 1) — factual ground truth
      3. Wallet — user-specific data
      4. Verdict — search result data
      5. Examples (Layer 2) — tone/format guidance
      6. Resolution notes — slot machine annotations
    """
    sections: list[str] = []

    # Layer 3 corrections first — highest priority signal
    if rag_corrections:
        c = format_corrections(rag_corrections)
        if c:
            sections.append(c)

    # KB ground truth
    if rag_chunks:
        k = format_kb_chunks(rag_chunks)
        if k:
            sections.append(k)

    # User data
    if wallet is not None:
        sections.append(format_wallet(wallet))

    if verdict_context:
        v = format_verdict(verdict_context)
        if v:
            sections.append(v)

    # Layer 2 examples
    if rag_examples:
        e = format_examples(rag_examples)
        if e:
            sections.append(e)

    # Slot machine notes
    if resolution_notes:
        n = format_resolution_notes(resolution_notes)
        if n:
            sections.append(n)

    if not sections:
        return ""

    return "\n\n".join(sections) + "\n" + GROUNDING_RULE
