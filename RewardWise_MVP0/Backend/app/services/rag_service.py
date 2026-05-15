"""
app/services/rag_service.py
────────────────────────────
Single entry point for all RAG retrieval in the Zoe pipeline.

Previously a stub. Now wired to the 3-layer retriever.

Called by zoe_service.py before every handler dispatch.
All intents retrieve — trip_search included.

Returns a typed RAGResult dict for handler injection.
"""

from __future__ import annotations

from app.services.zoe.rag.retriever import retrieve, should_retrieve


# ── Result type ───────────────────────────────────────────────────────────────

class RAGResult:
    """
    Wrapper around retriever output.
    Handlers receive this already unpacked in zoe_service.
    """
    def __init__(self, raw: dict):
        self.kb_chunks:   list[dict] = raw.get("kb_chunks", [])
        self.examples:    list[dict] = raw.get("examples", [])
        self.corrections: list[dict] = raw.get("corrections", [])

    @property
    def has_content(self) -> bool:
        return bool(self.kb_chunks or self.examples or self.corrections)

    def __repr__(self) -> str:
        return (
            f"RAGResult(kb={len(self.kb_chunks)}, "
            f"examples={len(self.examples)}, "
            f"corrections={len(self.corrections)})"
        )


EMPTY_RAG = RAGResult({"kb_chunks": [], "examples": [], "corrections": []})


# ── Main retrieve function ────────────────────────────────────────────────────

async def retrieve_for_intent(
    intent: str,
    query: str,
    *,
    top_k: int = 4,
) -> RAGResult:
    """
    Run the full 3-layer RAG pipeline for a given intent and query.

    Args:
        intent: Zoe intent string (trip_search, verdict_strategy, etc.)
        query:  The user's message (used for embedding + search)
        top_k:  Max KB articles to retrieve per call (default 4)

    Returns:
        RAGResult with kb_chunks, examples, corrections populated.
        Returns EMPTY_RAG if intent doesn't retrieve or on failure.
    """
    if not should_retrieve(intent):
        return EMPTY_RAG

    try:
        raw = await retrieve(intent, query, top_k=top_k)
        result = RAGResult(raw)
        print(
            f"📚 RAG [{intent}]: "
            f"kb={len(result.kb_chunks)} "
            f"examples={len(result.examples)} "
            f"corrections={len(result.corrections)}"
        )
        return result
    except Exception as exc:
        print(f"⚠️ rag_service error for intent={intent}: {exc}")
        return EMPTY_RAG
