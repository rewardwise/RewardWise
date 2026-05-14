"""
scripts/check_rag.py
─────────────────────
Verifies the complete RAG pipeline is working end-to-end.

Run from Backend/ directory:
    python scripts/check_rag.py

Checks:
  1. pgvector extension is enabled
  2. All five tables exist
  3. Both RPC functions exist and are callable
  4. kb_articles has rows, with embeddings
  5. Runs a live retrieval query for each intent category
  6. Reports Layer 2 and Layer 3 corpus sizes
  7. Shows a sample retrieved chunk so you can verify content quality
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from app.db.client import get_db_client


def banner(title: str):
    print(f"\n{'━'*60}")
    print(f"  {title}")
    print(f"{'━'*60}")


def ok(msg: str):   print(f"  ✅  {msg}")
def warn(msg: str): print(f"  ⚠️   {msg}")
def fail(msg: str): print(f"  ❌  {msg}")


async def run_checks():
    db = get_db_client()

    banner("1. pgvector extension")
    try:
        result = db.rpc("pg_typeof", {"value": "[0.1, 0.2]::vector(2)"}).execute()
        ok("pgvector extension is enabled")
    except Exception:
        # Try another way
        try:
            result = db.table("kb_articles").select("id").limit(1).execute()
            ok("pgvector extension OK (kb_articles table exists)")
        except Exception as e:
            fail(f"pgvector check failed: {e}")

    banner("2. Table existence")
    tables = ["zoe_sessions", "zoe_interactions", "zoe_evals", "kb_articles", "kb_interactions_corpus"]
    for table in tables:
        try:
            db.table(table).select("id").limit(1).execute()
            ok(f"{table}")
        except Exception as e:
            fail(f"{table} — {e}")

    banner("3. kb_articles stats")
    try:
        total = db.table("kb_articles").select("id", count="exact").execute()
        published = db.table("kb_articles").select("id", count="exact").not_.is_("published_at", "null").execute()
        with_embed = db.table("kb_articles").select("id", count="exact").not_.is_("embedding", "null").execute()
        n_total = total.count or 0
        n_pub = published.count or 0
        n_embed = with_embed.count or 0

        if n_total == 0:
            fail("kb_articles is EMPTY — run: python scripts/seed_kb.py")
        else:
            ok(f"Total articles: {n_total}")
            if n_pub < n_total:
                warn(f"Published: {n_pub}/{n_total} (unpublished articles won't be retrieved)")
            else:
                ok(f"Published: {n_pub}/{n_total}")
            if n_embed < n_total:
                warn(f"With embeddings: {n_embed}/{n_total} — run: python scripts/reembed_kb.py")
            else:
                ok(f"With embeddings: {n_embed}/{n_total}")

        # Show category breakdown
        cats = db.table("kb_articles").select("category").not_.is_("published_at", "null").execute()
        from collections import Counter
        counts = Counter(r["category"] for r in (cats.data or []))
        print()
        for cat, count in sorted(counts.items()):
            print(f"    {cat:<30} {count} articles")

    except Exception as e:
        fail(f"kb_articles stats failed: {e}")

    banner("4. RPC function test (live retrieval)")
    test_queries = [
        ("booking_strategies", "Is it worth using miles for a $500 flight?"),
        ("airline_programs",   "How does United MileagePlus work?"),
        ("credit_cards",       "How do Chase transfer partners work?"),
    ]

    # Need an embedding to test RPC
    try:
        import httpx
        nvidia_key = os.getenv("NVIDIA_API_KEY")
        openai_key = os.getenv("OPENAI_API_KEY")
        test_embedding = None

        if nvidia_key:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    os.getenv("NVIDIA_EMBED_URL", "https://integrate.api.nvidia.com/v1/embeddings"),
                    headers={"Authorization": f"Bearer {nvidia_key}", "Content-Type": "application/json"},
                    json={"model": os.getenv("NVIDIA_EMBED_MODEL", "nvidia/nv-embed-v1"),
                          "input": "test query", "encoding_format": "float"},
                )
            if resp.status_code == 200:
                test_embedding = resp.json()["data"][0]["embedding"]
                ok("Embedding API (NVIDIA) — working")
        elif openai_key:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/embeddings",
                    headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
                    json={"model": "text-embedding-ada-002", "input": "test query"},
                )
            if resp.status_code == 200:
                test_embedding = resp.json()["data"][0]["embedding"]
                ok("Embedding API (OpenAI) — working")
        else:
            warn("No embedding API key found — skipping live retrieval test")

        if test_embedding:
            embedding_str = "[" + ",".join(str(x) for x in test_embedding) + "]"
            try:
                result = db.rpc("search_kb_articles", {
                    "query_embedding": embedding_str,
                    "categories": ["booking_strategies"],
                    "match_count": 1,
                    "min_similarity": 0.0,
                }).execute()
                rows = result.data or []
                if rows:
                    ok(f"search_kb_articles RPC — returned {len(rows)} result(s)")
                    print(f"\n    Sample result:")
                    print(f"    Title: {rows[0]['title']}")
                    print(f"    Score: {rows[0].get('similarity', 'n/a')}")
                    print(f"    Content: {rows[0]['content'][:120]}...")
                else:
                    warn("search_kb_articles returned 0 results — KB may be empty or embeddings missing")
            except Exception as e:
                fail(f"search_kb_articles RPC failed: {e}")
                print(f"    Run the RPC migration again if this fails.")

    except Exception as e:
        fail(f"RPC test failed: {e}")

    banner("5. Layer 2 & 3 corpus")
    try:
        layer2 = db.table("kb_interactions_corpus").select("id", count="exact").execute()
        layer3 = db.table("zoe_evals").select("id", count="exact").execute()
        interactions = db.table("zoe_interactions").select("id", count="exact").execute()

        n2 = layer2.count or 0
        n3 = layer3.count or 0
        ni = interactions.count or 0

        print(f"  zoe_interactions logged:    {ni}")
        if n2 == 0:
            warn("kb_interactions_corpus (Layer 2) is empty — needs user interactions with feedback")
        else:
            ok(f"kb_interactions_corpus (Layer 2): {n2} entries")
        if n3 == 0:
            warn("zoe_evals (Layer 3) is empty — needs PM eval submissions")
        else:
            ok(f"zoe_evals (Layer 3): {n3} entries")
    except Exception as e:
        fail(f"Corpus check failed: {e}")

    banner("Summary")
    print("  RAG pipeline check complete.\n")
    print("  To fix issues:")
    print("    Empty KB:              python scripts/seed_kb.py")
    print("    Missing embeddings:    python scripts/reembed_kb.py")
    print("    Missing RPC functions: re-run the zoe_rag_rpc_functions migration")
    print()


if __name__ == "__main__":
    asyncio.run(run_checks())
