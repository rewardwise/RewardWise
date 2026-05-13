"""
scripts/seed_kb.py
───────────────────
One-shot script that seeds kb_articles from the existing flights_kb.py.

Run from the Backend/ directory:
    python scripts/seed_kb.py

Embedding model: nvidia/nv-embed-v1 → 4096 dimensions
Database column: vector(4096) — fixed migration already applied
"""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from app.rag.flights_kb import FLIGHTS_KB
from app.db.client import get_db_client

CATEGORY_MAP = {
    "points_vs_cash":     "booking_strategies",
    "airline_programs":   "airline_programs",
    "credit_cards":       "credit_cards",
    "booking_strategies": "booking_strategies",
    "destinations":       "destinations",
    "transfers":          "transfers",
}


async def _embed(text: str) -> list[float] | None:
    import httpx
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
            print(f"\n  ⚠️  NVIDIA {resp.status_code}: {resp.text[:150]}")
        except Exception as e:
            print(f"\n  ⚠️  NVIDIA error: {e}")

    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/embeddings",
                    headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
                    json={"model": "text-embedding-3-large", "input": text},
                )
            if resp.status_code == 200:
                return resp.json()["data"][0]["embedding"]
        except Exception as e:
            print(f"\n  ⚠️  OpenAI error: {e}")
    return None


async def seed():
    db = get_db_client()
    now = datetime.now(timezone.utc).isoformat()

    print(f"\n{'━'*60}")
    print(f"  Zoe KB Seeder  ({len(FLIGHTS_KB)} documents)")
    print(f"{'━'*60}\n")

    existing = db.table("kb_articles").select("title").execute()
    existing_titles = {r["title"] for r in (existing.data or [])}
    print(f"  {len(existing_titles)} already in DB (will skip)\n")

    # Probe dimensions first
    probe = await _embed("test")
    if probe is None:
        print("  ❌ Embedding API not reachable. Check NVIDIA_API_KEY in .env.")
        return
    print(f"  Embedding: {len(probe)} dimensions — OK\n")

    inserted = skipped = failed = 0

    for i, doc in enumerate(FLIGHTS_KB, 1):
        title = doc.get("title", f"doc-{i}")
        category = CATEGORY_MAP.get(doc.get("category", ""), "booking_strategies")
        content = doc.get("content", "")
        summary = doc.get("summary", "")
        tags = doc.get("tags", [])
        full_content = f"{summary}\n\n{content}".strip() if summary else content

        print(f"  [{i:02d}/{len(FLIGHTS_KB):02d}] {title[:55]:<55}", end="", flush=True)

        if title in existing_titles:
            print(" SKIP"); skipped += 1; continue

        embedding = await _embed(f"{title}\n\n{full_content}")
        if not embedding:
            print(" WARN (no embed)", end="")

        try:
            db.table("kb_articles").insert({
                "title": title,
                "category": category,
                "tags": tags,
                "content": full_content,
                "embedding": embedding,
                "published_at": now,
            }).execute()
            inserted += 1
            print(f" ✓")
        except Exception as e:
            print(f" ✗ {e}"); failed += 1

        await asyncio.sleep(0.3)

    print(f"\n{'━'*60}")
    print(f"  Inserted:{inserted}  Skipped:{skipped}  Failed:{failed}")
    print(f"{'━'*60}\n")
    if inserted > 0:
        print("  ✅ KB seeded. Run check_rag.py to verify.")

if __name__ == "__main__":
    asyncio.run(seed())
