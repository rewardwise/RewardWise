"""
zoe/grounding.py
─────────────────
Assembles all ground truth data injected into every respond call.

ARCHITECTURE CHANGE (v2):
  - valid_as_of citation added to every KB chunk
  - Zoe must surface the date when citing policies, fees, or program rules
  - Grounding rule updated: staleness disclaimer required for time-sensitive data

Sources:
  - Wallet data (from DB)
  - Verdict object (from active search result — injected on "Ask Zoe" click)
  - KB chunks — Layer 1 (published articles, with staleness date)
  - Interaction examples — Layer 2 (high-signal response pairs)
  - PM corrections — Layer 3 (negative examples, highest priority)

The grounding rule (enforced in every system prompt):
  "Every factual claim must come from one of the injected sources.
   If a fact is not here, say so. Never guess.
   Always surface valid_as_of when citing policies or fees."
"""

from __future__ import annotations


# ── Section formatters ────────────────────────────────────────────────────────

def format_wallet(wallet: list[dict]) -> str:
    if not wallet:
        return "WALLET: (no programs connected — do not invent balances)"
    lines = ["WALLET (cite these exact balances — do not invent or estimate):"]
    for w in wallet:
        program = w.get("program") or w.get("program_name") or "Unknown Program"
        points  = w.get("points") or w.get("points_balance") or 0
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
    """
    Layer 1: Format KB chunks with staleness citation.

    Each chunk surfaces its valid_as_of date so Zoe can cite it:
      "Per United's award chart as of Q1 2025 — verify before booking."

    This is non-negotiable for:
      - Airline fees and policies
      - Program award charts
      - Transfer ratios and partner lists
      - Close-in booking fee rules
    """
    if not chunks:
        return ""

    lines = ["KNOWLEDGE BASE (ground truth — cite valid_as_of for all policy/fee data):"]
    for i, chunk in enumerate(chunks, 1):
        title       = chunk.get("title", f"Source {i}")
        content     = (chunk.get("content") or "").strip()[:900]
        valid_as_of = chunk.get("valid_as_of")
        category    = chunk.get("category", "")

        if not content:
            continue

        # Build citation line
        citation = f"[{i}] {title}"
        if valid_as_of:
            citation += f" (valid as of: {valid_as_of})"
        if category:
            citation += f" [{category}]"

        lines.append(f"\n{citation}")
        lines.append(content)

    return "\n".join(lines)


def format_examples(examples: list[dict]) -> str:
    """
    Layer 2: Interaction examples as implicit few-shot guidance.
    Shows Zoe what good responses look like for similar questions.
    """
    if not examples:
        return ""
    lines = ["EXAMPLE RESPONSES (reference tone and structure — do not copy verbatim):"]
    for ex in examples[:2]:
        user_msg  = (ex.get("user_message") or "").strip()[:200]
        zoe_resp  = (ex.get("zoe_response") or "").strip()[:400]
        if user_msg and zoe_resp:
            lines.append(f"\nExample — User: {user_msg}")
            lines.append(f"Example — Zoe: {zoe_resp}")
    return "\n".join(lines)


def format_corrections(corrections: list[dict]) -> str:
    """
    Layer 3: PM corrections as explicit negative examples.
    Injected with highest priority — Zoe must not repeat these patterns.
    """
    if not corrections:
        return ""
    lines = ["⚠️ KNOWN FAILURE PATTERNS — DO NOT REPEAT THESE:"]
    for c in corrections:
        failure_type = c.get("failure_type", "quality issue")
        original     = (c.get("original_response") or "").strip()[:300]
        corrected    = (c.get("corrected_response") or "").strip()[:300]
        notes        = c.get("notes", "")
        if original and corrected:
            lines.append(f"\n[Failure: {failure_type}]")
            lines.append(f"BAD (do not do this): {original}")
            lines.append(f"GOOD (do this instead): {corrected}")
            if notes:
                lines.append(f"Why: {notes}")
    return "\n".join(lines)


# ── The grounding rule ────────────────────────────────────────────────────────

GROUNDING_RULE = """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GROUNDING RULE — NON-NEGOTIABLE:
Every factual claim you make must come from the injected sources above.
If a fact is NOT in those sources, say so — never guess.

CITATION RULE — REQUIRED for policies, fees, and program rules:
  Always surface the valid_as_of date when citing:
    - Airline fees (baggage, change, close-in booking fees)
    - Award chart costs (partner miles, saver rates)
    - Transfer ratios and processing times
    - Program partner lists
  Format: "Per [source], as of [valid_as_of] — verify before booking."
  If valid_as_of is not provided, say "verify current rates — policies change."

NEVER infer, estimate, or guess:
  - Point values or CPP figures not in the verdict
  - Award availability or seat counts
  - Transfer partner lists or ratios not in KB
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
) -> str:
    """
    Assemble all ground truth sections into a single block
    for injection into the respond-call system prompt.

    Priority order:
      1. Corrections (Layer 3) — highest, injected first as negative examples
      2. KB chunks (Layer 1) — factual ground truth with staleness dates
      3. Wallet — user-specific data
      4. Verdict — search result data (injected on "Ask Zoe" click)
      5. Examples (Layer 2) — tone/format guidance
    """
    sections: list[str] = []

    # Layer 3 corrections first — highest priority
    if rag_corrections:
        c = format_corrections(rag_corrections)
        if c:
            sections.append(c)

    # KB ground truth with citations
    if rag_chunks:
        k = format_kb_chunks(rag_chunks)
        if k:
            sections.append(k)

    # User wallet data
    if wallet is not None:
        sections.append(format_wallet(wallet))

    # Verdict (Ask Zoe flow)
    if verdict_context:
        v = format_verdict(verdict_context)
        if v:
            sections.append(v)

    # Layer 2 examples (tone guidance)
    if rag_examples:
        e = format_examples(rag_examples)
        if e:
            sections.append(e)

    if not sections:
        return ""

    return "\n\n".join(sections) + "\n" + GROUNDING_RULE
