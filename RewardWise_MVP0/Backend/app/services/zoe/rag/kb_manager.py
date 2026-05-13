"""
zoe/rag/kb_manager.py
──────────────────────
Knowledge base article CRUD and embedding pipeline.

Used by:
  - Admin routes (app/admin/zoe_eval_routes.py) for PM article management
  - The initial KB seeding script (run once)
  - Re-embedding on article updates

Also contains the Supabase RPC function definitions that must be created
alongside the tables — call create_rpc_functions() once after migration.
"""

from __future__ import annotations

import uuid
from typing import Optional

from app.db.client import get_db_client
from app.services.zoe.rag import embedder_fixed

# ── Article CRUD ──────────────────────────────────────────────────────────────

async def create_article(
    title: str,
    category: str,
    content: str,
    tags: list[str] | None = None,
    publish: bool = False,
) -> dict:
    """
    Create a new KB article, generate its embedding, and optionally publish it.

    Args:
        title:    Article title
        category: One of: airline_programs, credit_cards, booking_strategies, destinations, transfers
        content:  Full article text (used for embedding + retrieval)
        tags:     Optional keyword tags for filtering
        publish:  If True, set published_at to NOW()

    Returns:
        The created article record
    """
    db = get_db_client()

    # Generate embedding from title + content (combined gives better retrieval)
    embed_text = f"{title}\n\n{content}"
    embedding = await embedder_fixed.embed(embed_text)

    row = {
        "id": str(uuid.uuid4()),
        "title": title,
        "category": category,
        "tags": tags or [],
        "content": content,
        "embedding": embedding,  # None if embedding failed — article still saved
    }

    if publish:
        from datetime import datetime, timezone
        row["published_at"] = datetime.now(timezone.utc).isoformat()

    result = db.table("kb_articles").insert(row).execute()
    created = (result.data or [{}])[0]
    print(f"✅ KB article created: {title} (published={publish})")
    return created


async def update_article(
    article_id: str,
    *,
    title: str | None = None,
    content: str | None = None,
    tags: list[str] | None = None,
    publish: bool | None = None,
) -> dict:
    """
    Update a KB article. Re-generates embedding if title or content changed.
    """
    db = get_db_client()

    # Fetch current record
    existing = db.table("kb_articles").select("*").eq("id", article_id).single().execute()
    current = existing.data

    updates: dict = {}
    if title is not None:
        updates["title"] = title
    if content is not None:
        updates["content"] = content
    if tags is not None:
        updates["tags"] = tags
    if publish is True:
        from datetime import datetime, timezone
        updates["published_at"] = datetime.now(timezone.utc).isoformat()
    elif publish is False:
        updates["published_at"] = None

    # Re-embed if text changed
    if title is not None or content is not None:
        new_title = title or current["title"]
        new_content = content or current["content"]
        embed_text = f"{new_title}\n\n{new_content}"
        new_embedding = await embedder_fixed.embed(embed_text)
        if new_embedding:
            updates["embedding"] = new_embedding

    result = db.table("kb_articles").update(updates).eq("id", article_id).execute()
    updated = (result.data or [{}])[0]
    print(f"✅ KB article updated: {article_id}")
    return updated


async def delete_article(article_id: str) -> bool:
    """Delete a KB article."""
    db = get_db_client()
    db.table("kb_articles").delete().eq("id", article_id).execute()
    print(f"✅ KB article deleted: {article_id}")
    return True


async def list_articles(
    category: str | None = None,
    published_only: bool = False,
    limit: int = 50,
) -> list[dict]:
    """List KB articles with optional filters."""
    db = get_db_client()
    query = db.table("kb_articles").select("id, title, category, tags, published_at, created_at, updated_at")
    if category:
        query = query.eq("category", category)
    if published_only:
        query = query.not_.is_("published_at", "null")
    result = query.order("updated_at", desc=True).limit(limit).execute()
    return result.data or []


# ── Supabase RPC functions ────────────────────────────────────────────────────
# These SQL functions must exist in Supabase for the retriever to work.
# Call create_rpc_functions() once after running migrations.

RPC_SEARCH_KB_ARTICLES = """
CREATE OR REPLACE FUNCTION search_kb_articles(
    query_embedding vector(1536),
    categories      text[],
    match_count     int DEFAULT 3,
    min_similarity  float DEFAULT 0.70
)
RETURNS TABLE (
    id          uuid,
    title       text,
    category    text,
    content     text,
    similarity  float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        id,
        title,
        category,
        content,
        1 - (embedding <=> query_embedding) AS similarity
    FROM kb_articles
    WHERE published_at IS NOT NULL
      AND category = ANY(categories)
      AND embedding IS NOT NULL
      AND (1 - (embedding <=> query_embedding)) >= min_similarity
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
$$;
"""

RPC_SEARCH_INTERACTION_CORPUS = """
CREATE OR REPLACE FUNCTION search_interaction_corpus(
    query_embedding vector(1536),
    intent_filter   text,
    match_count     int DEFAULT 2,
    min_similarity  float DEFAULT 0.75
)
RETURNS TABLE (
    user_message  text,
    zoe_response  text,
    similarity    float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        user_message,
        zoe_response,
        1 - (embedding <=> query_embedding) AS similarity
    FROM kb_interactions_corpus
    WHERE intent = intent_filter
      AND embedding IS NOT NULL
      AND (1 - (embedding <=> query_embedding)) >= min_similarity
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
$$;
"""


async def create_rpc_functions() -> bool:
    """
    Create the pgvector RPC functions in Supabase.
    Call this once after running migrations, or any time the functions need to be updated.
    """
    from app.db.client import get_db_client
    db = get_db_client()
    try:
        db.rpc("pg_exec", {"sql": RPC_SEARCH_KB_ARTICLES}).execute()
        db.rpc("pg_exec", {"sql": RPC_SEARCH_INTERACTION_CORPUS}).execute()
        print("✅ RPC functions created")
        return True
    except Exception as exc:
        print(f"⚠️ RPC function creation failed: {exc}")
        print("Run the SQL manually in Supabase SQL editor:")
        print(RPC_SEARCH_KB_ARTICLES)
        print(RPC_SEARCH_INTERACTION_CORPUS)
        return False


# ── Corpus ingestion (Phase 5) ────────────────────────────────────────────────

async def ingest_interaction(
    interaction_id: str,
    intent: str,
    user_message: str,
    zoe_response: str,
    approval_source: str,
    rating: int | None = None,
) -> bool:
    """
    Promote a high-signal interaction into the Layer 2 corpus.

    Args:
        interaction_id: UUID of the source zoe_interactions row
        intent:         Classified intent
        user_message:   User's message (PII-stripped)
        zoe_response:   Zoe's response
        approval_source: 'thumbs_up' | 'search_triggered' | 'pm_eval'
        rating:         PM eval score if applicable
    """
    db = get_db_client()

    # Generate embedding for user_message (this is what retrieval queries against)
    embedding = await embedder_fixed.embed(user_message)

    row = {
        "interaction_id": interaction_id,
        "intent": intent,
        "user_message": user_message,
        "zoe_response": zoe_response,
        "embedding": embedding,
        "approval_source": approval_source,
        "rating": rating,
    }

    try:
        db.table("kb_interactions_corpus").insert(row).execute()
        print(f"✅ Interaction ingested into corpus: {interaction_id[:8]}...")
        return True
    except Exception as exc:
        print(f"⚠️ Corpus ingestion failed: {exc}")
        return False
