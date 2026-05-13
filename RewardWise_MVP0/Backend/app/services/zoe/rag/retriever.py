"""
zoe/rag/retriever.py
─────────────────────
Three-layer RAG retrieval pipeline. Full production implementation.

Layer priority:
  Layer 3 (PM corrections) — highest. Injected as negative examples in system prompt.
  Layer 1 (KB articles)    — ground truth factual knowledge.
  Layer 2 (interaction corpus) — implicit few-shot examples of good responses.

Retrieval fires only for: destination, verdict_strategy, wallet_support, exploring.
Trip collection turns skip retrieval entirely (no KB needed to ask for an airport name).

All retrieval uses pgvector cosine similarity via Supabase execute_sql.
"""

from __future__ import annotations

import json
from typing import Optional

from app.db.client import get_db_client
from app.services.zoe.rag import embedder


# ── Intent → KB category mapping ─────────────────────────────────────────────

_INTENT_CATEGORIES: dict[str, list[str]] = {
    "destination":      ["destinations"],
    "verdict_strategy": ["airline_programs", "credit_cards", "booking_strategies", "transfers"],
    "wallet_support":   ["credit_cards", "transfers"],
    "exploring":        ["destinations", "booking_strategies"],
}

_RAG_INTENTS = set(_INTENT_CATEGORIES.keys())


def should_retrieve(intent: str) -> bool:
    """Return True if RAG retrieval should fire for this intent."""
    return intent in _RAG_INTENTS


async def retrieve(
    intent: str,
    query: str,
    *,
    top_k: int = 3,
) -> dict:
    """
    Full three-layer retrieval for a given intent + query.

    Returns:
    {
      "kb_chunks":   [{ id, title, category, content, score }],  # Layer 1
      "examples":    [{ user_message, zoe_response, score }],    # Layer 2
      "corrections": [{ original_response, corrected_response, failure_type }],  # Layer 3
    }
    """
    if not should_retrieve(intent):
        return {"kb_chunks": [], "examples": [], "corrections": []}

    # Generate query embedding once, reuse for all layers
    query_embedding = await embedder.embed(query)

    if not query_embedding:
        # Embedding failed — fall back to empty (grounding rule handles gracefully)
        print(f"⚠️ RAG: embedding failed for intent={intent}, query={query[:50]}")
        return {"kb_chunks": [], "examples": [], "corrections": []}

    # Run all three layers concurrently (sequential is fine here — DB is fast)
    kb_chunks = await _search_kb_articles(query_embedding, intent, top_k)
    examples = await _search_corpus(query_embedding, intent, top_k=2)
    corrections = await _search_evals(query_embedding, intent, top_k=2)

    return {
        "kb_chunks": kb_chunks,
        "examples": examples,
        "corrections": corrections,
    }


# ── Layer 1: KB articles ──────────────────────────────────────────────────────

async def _search_kb_articles(
    embedding: list[float],
    intent: str,
    top_k: int,
) -> list[dict]:
    """Search kb_articles by cosine similarity, filtered by intent category."""
    categories = _INTENT_CATEGORIES.get(intent, [])
    if not categories:
        return []

    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
    categories_sql = ", ".join(f"'{c}'" for c in categories)

    try:
        db = get_db_client()
        # pgvector cosine similarity: 1 - (embedding <=> query) = similarity
        result = db.rpc(
            "search_kb_articles",
            {
                "query_embedding": embedding_str,
                "categories": categories,
                "match_count": top_k,
                "min_similarity": 0.70,
            },
        ).execute()

        rows = result.data or []
        return [
            {
                "id": r["id"],
                "title": r["title"],
                "category": r["category"],
                "content": r["content"],
                "score": round(float(r.get("similarity", 0)), 3),
            }
            for r in rows
        ]
    except Exception as exc:
        print(f"⚠️ RAG Layer 1 error: {exc}")
        # Fallback: keyword search without embeddings
        return await _kb_keyword_fallback(intent, top_k)


async def _kb_keyword_fallback(intent: str, top_k: int) -> list[dict]:
    """Fallback: fetch recent published articles by category when vector search fails."""
    categories = _INTENT_CATEGORIES.get(intent, [])
    if not categories:
        return []
    try:
        db = get_db_client()
        result = (
            db.table("kb_articles")
            .select("id, title, category, content")
            .in_("category", categories)
            .not_.is_("published_at", "null")
            .order("published_at", desc=True)
            .limit(top_k)
            .execute()
        )
        return [
            {
                "id": r["id"],
                "title": r["title"],
                "category": r["category"],
                "content": r["content"],
                "score": 0.0,
            }
            for r in (result.data or [])
        ]
    except Exception as exc:
        print(f"⚠️ RAG Layer 1 keyword fallback error: {exc}")
        return []


# ── Layer 2: Interaction corpus ───────────────────────────────────────────────

async def _search_corpus(
    embedding: list[float],
    intent: str,
    top_k: int,
) -> list[dict]:
    """Search kb_interactions_corpus for high-signal response examples."""
    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

    try:
        db = get_db_client()
        result = db.rpc(
            "search_interaction_corpus",
            {
                "query_embedding": embedding_str,
                "intent_filter": intent,
                "match_count": top_k,
                "min_similarity": 0.75,
            },
        ).execute()

        rows = result.data or []
        return [
            {
                "user_message": r["user_message"],
                "zoe_response": r["zoe_response"],
                "score": round(float(r.get("similarity", 0)), 3),
            }
            for r in rows
        ]
    except Exception as exc:
        print(f"⚠️ RAG Layer 2 error: {exc}")
        return []


# ── Layer 3: PM eval corrections ─────────────────────────────────────────────

async def _search_evals(
    embedding: list[float],
    intent: str,
    top_k: int,
) -> list[dict]:
    """
    Search zoe_evals for corrections relevant to this query.
    These are returned as negative examples — things Zoe must NOT do.
    """
    try:
        db = get_db_client()
        # Join evals with interactions to get the intent filter
        result = (
            db.table("zoe_evals")
            .select("original_response, corrected_response, failure_type, pm_notes, zoe_interactions(intent)")
            .not_.is_("corrected_response", "null")
            .eq("zoe_interactions.intent", intent)
            .order("created_at", desc=True)
            .limit(top_k)
            .execute()
        )
        rows = result.data or []
        return [
            {
                "original_response": r["original_response"],
                "corrected_response": r["corrected_response"],
                "failure_type": r.get("failure_type"),
                "notes": r.get("pm_notes"),
            }
            for r in rows
            if r.get("corrected_response")
        ]
    except Exception as exc:
        print(f"⚠️ RAG Layer 3 error: {exc}")
        return []
