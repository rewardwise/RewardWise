"""
rag/kb/seeder.py
─────────────────
One-time script to seed all KB articles into Supabase.
Run this after filling in content in each KB file.

Also run after adding new articles or updating existing ones —
articles are upserted by ID, so safe to re-run.

Usage:
  cd Backend
  python -m app.rag.kb.seeder

Supabase table required:
  kb_articles (id, title, category, tags, content, valid_as_of, embedding, published_at)

The `valid_as_of` column must be added if not already present:
  ALTER TABLE kb_articles ADD COLUMN valid_as_of text;
"""

from __future__ import annotations
from dotenv import load_dotenv
load_dotenv()

import asyncio
import sys
from datetime import datetime, timezone

from app.rag.kb.airline_policies import AIRLINE_POLICIES_KB
from app.rag.kb.program_rules import PROGRAM_RULES_KB
from app.rag.kb.route_intelligence import ROUTE_INTELLIGENCE_KB
from app.rag.kb.historical_patterns import HISTORICAL_PATTERNS_KB

# Also import existing KB if migrating
# from app.rag.flights_kb import FLIGHTS_KB


ALL_KB_ARTICLES = [
    *AIRLINE_POLICIES_KB,
    *PROGRAM_RULES_KB,
    *ROUTE_INTELLIGENCE_KB,
    *HISTORICAL_PATTERNS_KB,
    # *FLIGHTS_KB,  # uncomment to include existing KB
]


async def seed_all(publish: bool = True, dry_run: bool = False) -> None:
    """
    Seed all KB articles into Supabase.

    Args:
        publish:  If True, mark all articles as published immediately.
        dry_run:  If True, print what would be seeded without writing to DB.
    """
    from app.services.zoe.rag.kb_manager import create_article, update_article, list_articles

    print(f"🌱 KB Seeder — {len(ALL_KB_ARTICLES)} articles to process")
    print(f"   publish={publish} | dry_run={dry_run}")
    print()

    # Get existing article IDs to decide create vs update
    existing = await list_articles(limit=500)
    existing_ids = {a["id"] for a in existing}

    skipped  = 0
    created  = 0
    updated  = 0
    errored  = 0

    for article in ALL_KB_ARTICLES:
        article_id = article.get("id")
        title      = article.get("title", "Untitled")
        content    = (article.get("content") or "").strip()
        category   = article.get("category", "")
        tags       = article.get("tags", [])
        valid_as_of = article.get("valid_as_of")

        # Skip articles with no content — they're stubs waiting to be filled
        if not content:
            print(f"  ⏭  SKIP (no content): {title}")
            skipped += 1
            continue

        if dry_run:
            action = "UPDATE" if article_id in existing_ids else "CREATE"
            print(f"  🔍 DRY RUN [{action}]: {title} ({category})")
            continue

        try:
            # Inject valid_as_of into content if not already there
            # (the column stores it separately, but we note it in content too for retrieval)
            full_content = content
            if valid_as_of and "valid as of" not in content.lower():
                full_content = f"{content}\n\n[Policy valid as of: {valid_as_of}]"

            if article_id in existing_ids:
                await update_article(
                    article_id,
                    title=title,
                    content=full_content,
                    tags=tags,
                    publish=publish,
                )
                print(f"  ✅ UPDATED: {title}")
                updated += 1
            else:
                await create_article(
                    title=title,
                    category=category,
                    content=full_content,
                    tags=tags,
                    publish=publish,
                )
                print(f"  ✅ CREATED: {title}")
                created += 1

        except Exception as exc:
            print(f"  ❌ ERROR: {title} — {exc}")
            errored += 1

    print()
    print("─" * 50)
    print(f"🏁 Done: {created} created | {updated} updated | {skipped} skipped (no content) | {errored} errors")


async def seed_category(category: str, publish: bool = True) -> None:
    """Seed only articles matching a specific category."""
    filtered = [a for a in ALL_KB_ARTICLES if a.get("category") == category]
    print(f"🌱 Seeding {len(filtered)} articles for category: {category}")

    from app.services.zoe.rag.kb_manager import create_article
    for article in filtered:
        content = (article.get("content") or "").strip()
        if not content:
            print(f"  ⏭  SKIP (no content): {article.get('title')}")
            continue
        try:
            await create_article(
                title=article["title"],
                category=article["category"],
                content=content,
                tags=article.get("tags", []),
                publish=publish,
            )
            print(f"  ✅ {article['title']}")
        except Exception as exc:
            print(f"  ❌ {article['title']}: {exc}")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    category = next((a.split("=")[1] for a in sys.argv if a.startswith("--category=")), None)

    if category:
        asyncio.run(seed_category(category))
    else:
        asyncio.run(seed_all(publish=True, dry_run=dry_run))
