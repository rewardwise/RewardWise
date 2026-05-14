"""
scripts/reembed_kb.py
──────────────────────
Finds kb_articles rows with NULL embeddings and generates them.

Run from Backend/ directory:
    python scripts/reembed_kb.py

Use cases:
  - Embedding API was down during initial seed
  - Articles were added manually via Supabase UI without embeddings
  - Embedding model changed and you want to re-embed everything
    (pass --all flag to re-embed even rows that already have embeddings)

Usage:
    python scripts/reembed_kb.py          # only null embeddings
    python scripts/reembed_kb.py --all    # re-embed everything
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

import httpx
from app.db.client import get_db_client


async def _embed(text: str) -> list[float] | None:
    text = text.strip()[:8000]

    nvidia_key = os.getenv("NVIDIA_API_KEY")
    nvidia_url = os.getenv("NVIDIA_EMBED_URL", "https://integrate.api.nvidia.com/v1/embeddings")
    nvidia_model = os.getenv("NVIDIA_EMBED_MODEL", "nvidia/nv-embed-v1")

    if nvidia_key:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    nvidia_url,
                    headers={"Authorization": f"Bearer {nvidia_key}", "Content-Type": "application/json"},
                    json={"model": nvidia_model, "input": text, "encoding_format": "float"},
                )
            if resp.status_code == 200:
                return resp.json()["data"][0]["embedding"]
        except Exception as e:
            print(f"  ⚠️  NVIDIA: {e}")

    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/embeddings",
                    headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
                    json={"model": "text-embedding-ada-002", "input": text},
                )
            if resp.status_code == 200:
                return resp.json()["data"][0]["embedding"]
        except Exception as e:
            print(f"  ⚠️  OpenAI: {e}")

    return None


async def reembed(all_articles: bool = False):
    db = get_db_client()

    query = db.table("kb_articles").select("id, title, content")
    if not all_articles:
        query = query.is_("embedding", "null")

    result = query.execute()
    articles = result.data or []

    print(f"\n{'━'*55}")
    print(f"  Re-embed KB articles")
    print(f"  Found {len(articles)} articles {'(all)' if all_articles else '(null embeddings only)'}")
    print(f"{'━'*55}\n")

    if not articles:
        print("  Nothing to do.")
        return

    success = 0
    failed = 0

    for i, row in enumerate(articles, 1):
        title = row["title"]
        content = row["content"] or ""
        print(f"  [{i:02d}/{len(articles):02d}] {title[:50]:<50}", end="", flush=True)

        embedding = await _embed(f"{title}\n\n{content}")

        if not embedding:
            print(" ✗ embed failed")
            failed += 1
            continue

        try:
            db.table("kb_articles").update({"embedding": embedding}).eq("id", row["id"]).execute()
            success += 1
            print(f" ✓ ({len(embedding)}d)")
        except Exception as e:
            print(f" ✗ update failed: {e}")
            failed += 1

        await asyncio.sleep(0.3)

    print(f"\n  Done. Success: {success}  Failed: {failed}\n")


if __name__ == "__main__":
    all_flag = "--all" in sys.argv
    asyncio.run(reembed(all_articles=all_flag))
