"""
zoe/rag/retriever.py
─────────────────────
Three-layer RAG retrieval pipeline.

ARCHITECTURE CHANGE (v2):
  RAG now fires for ALL intents, including trip_search.
  New knowledge categories: route_intelligence, airline_policies,
  program_rules, historical_patterns.

Similarity thresholds:
  nv-embed-v1 (NVIDIA) produces cosine similarity in the 0.08–0.35 range.
  This is NOT the same scale as OpenAI ada-002 (0.7–0.95).
  Thresholds are set accordingly.
"""

from __future__ import annotations

from app.db.client import get_db_client
from app.services.zoe.rag import embedder_fixed


# ── Intent → KB category mapping ─────────────────────────────────────────────
#
# Each intent retrieves from a specific set of KB categories.
# Categories correspond to kb_articles.category values in Supabase.
#
# trip_search gets route + policy + history so Zoe can give intelligent
# answers about routes, programs, and booking strategies — not collect form fields.

_INTENT_CATEGORIES: dict[str, list[str]] = {
    "trip_search": [
        "route_intelligence",
        "airline_policies",
        "historical_patterns",
        "booking_strategies",
    ],
    "verdict_strategy": [
        "program_rules",
        "credit_cards",
        "booking_strategies",
        "transfers",
        "airline_policies",
        "route_intelligence",
    ],
    "destination": [
        "destinations",
        "route_intelligence",
        "airline_policies",
    ],
    "wallet_support": [
        "credit_cards",
        "transfers",
        "program_rules",
    ],
    "exploring": [
        "destinations",
        "booking_strategies",
        "route_intelligence",
        "historical_patterns",
    ],
}

# ALL intents now retrieve — no exclusions
_RAG_INTENTS = set(_INTENT_CATEGORIES.keys())


def should_retrieve(intent: str) -> bool:
    return intent in _RAG_INTENTS


async def retrieve(
    intent: str,
    query: str,
    *,
    top_k: int = 4,
) -> dict:
    """
    Full three-layer retrieval for a given intent + query.

    Returns:
    {
      "kb_chunks":   [{ id, title, category, content, valid_as_of, score }],
      "examples":    [{ user_message, zoe_response, score }],
      "corrections": [{ original_response, corrected_response, failure_type }],
    }
    """
    if not should_retrieve(intent):
        return {"kb_chunks": [], "examples": [], "corrections": []}

    query_embedding = await embedder_fixed.embed(query)
    if not query_embedding:
        print(f"⚠️ RAG: embedding failed for intent={intent}")
        return {"kb_chunks": [], "examples": [], "corrections": []}

    kb_chunks   = await _search_kb_articles(query_embedding, intent, top_k)
    examples    = await _search_corpus(query_embedding, intent, top_k=2)
    corrections = await _search_evals(intent, top_k=2)

    return {
        "kb_chunks":   kb_chunks,
        "examples":    examples,
        "corrections": corrections,
    }


# ── Layer 1: KB articles ──────────────────────────────────────────────────────

async def _search_kb_articles(
    embedding: list[float],
    intent: str,
    top_k: int,
) -> list[dict]:
    categories = _INTENT_CATEGORIES.get(intent, [])
    if not categories:
        return []

    try:
        db = get_db_client()
        result = db.rpc(
            "search_kb_articles",
            {
                "query_embedding": embedding,
                "categories": categories,
                "match_count": top_k,
                "min_similarity": 0.08,
            },
        ).execute()

        rows = result.data or []
        return [
            {
                "id":          r["id"],
                "title":       r["title"],
                "category":    r["category"],
                "content":     r["content"],
                "valid_as_of": r.get("valid_as_of"),   # staleness citation
                "score":       round(float(r.get("similarity", 0)), 4),
            }
            for r in rows
        ]
    except Exception as exc:
        print(f"⚠️ RAG Layer 1 error: {exc}")
        return await _kb_keyword_fallback(intent, top_k)


async def _kb_keyword_fallback(intent: str, top_k: int) -> list[dict]:
    """Fallback: most recently published articles for this intent's categories."""
    categories = _INTENT_CATEGORIES.get(intent, [])
    if not categories:
        return []
    try:
        db = get_db_client()
        result = (
            db.table("kb_articles")
            .select("id, title, category, content, valid_as_of")
            .in_("category", categories)
            .not_.is_("published_at", "null")
            .order("published_at", desc=True)
            .limit(top_k)
            .execute()
        )
        return [
            {
                "id":          r["id"],
                "title":       r["title"],
                "category":    r["category"],
                "content":     r["content"],
                "valid_as_of": r.get("valid_as_of"),
                "score":       0.0,
            }
            for r in (result.data or [])
        ]
    except Exception as exc:
        print(f"⚠️ RAG Layer 1 fallback error: {exc}")
        return []


# ── Layer 2: Interaction corpus ───────────────────────────────────────────────

async def _search_corpus(
    embedding: list[float],
    intent: str,
    top_k: int,
) -> list[dict]:
    try:
        db = get_db_client()
        result = db.rpc(
            "search_interaction_corpus",
            {
                "query_embedding": embedding,
                "intent_filter":   intent,
                "match_count":     top_k,
                "min_similarity":  0.10,
            },
        ).execute()

        rows = result.data or []
        return [
            {
                "user_message": r["user_message"],
                "zoe_response": r["zoe_response"],
                "score":        round(float(r.get("similarity", 0)), 4),
            }
            for r in rows
        ]
    except Exception as exc:
        print(f"⚠️ RAG Layer 2 error: {exc}")
        return []


# ── Layer 3: PM corrections ───────────────────────────────────────────────────

async def _search_evals(intent: str, top_k: int) -> list[dict]:
    try:
        db = get_db_client()
        result = (
            db.table("zoe_evals")
            .select(
                "original_response, corrected_response, failure_type, pm_notes, "
                "zoe_interactions(intent)"
            )
            .not_.is_("corrected_response", "null")
            .order("created_at", desc=True)
            .limit(top_k * 3)
            .execute()
        )
        rows = result.data or []
        return [
            {
                "original_response":  r["original_response"],
                "corrected_response": r["corrected_response"],
                "failure_type":       r.get("failure_type"),
                "notes":              r.get("pm_notes"),
            }
            for r in rows
            if (r.get("zoe_interactions") or {}).get("intent") == intent
            and r.get("corrected_response")
        ][:top_k]
    except Exception as exc:
        print(f"⚠️ RAG Layer 3 error: {exc}")
        return []
