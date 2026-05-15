"""
rag/kb/seeder.py — Updated with all 13 KB files
"""
from __future__ import annotations
from dotenv import load_dotenv
load_dotenv()
import asyncio, sys

from app.rag.kb.airline_policies import AIRLINE_POLICIES_KB
from app.rag.kb.program_rules import PROGRAM_RULES_KB
from app.rag.kb.route_intelligence import ROUTE_INTELLIGENCE_KB
from app.rag.kb.historical_patterns import HISTORICAL_PATTERNS_KB
from app.rag.kb.credit_cards import CREDIT_CARDS_KB
from app.rag.kb.airport_lounges import AIRPORT_LOUNGES_KB
from app.rag.kb.elite_status import ELITE_STATUS_KB
from app.rag.kb.cabin_products import CABIN_PRODUCTS_KB
from app.rag.kb.travel_protections import TRAVEL_PROTECTIONS_KB
from app.rag.kb.award_tools import AWARD_TOOLS_KB
from app.rag.kb.destinations import DESTINATIONS_KB
from app.rag.kb.sweet_spots import SWEET_SPOTS_KB
from app.rag.kb.points_strategy import POINTS_STRATEGY_KB

ALL_KB_ARTICLES = [
    *AIRLINE_POLICIES_KB, *PROGRAM_RULES_KB, *ROUTE_INTELLIGENCE_KB,
    *HISTORICAL_PATTERNS_KB, *CREDIT_CARDS_KB, *AIRPORT_LOUNGES_KB,
    *ELITE_STATUS_KB, *CABIN_PRODUCTS_KB, *TRAVEL_PROTECTIONS_KB,
    *AWARD_TOOLS_KB, *DESTINATIONS_KB, *SWEET_SPOTS_KB, *POINTS_STRATEGY_KB,
]

async def seed_all(publish=True, dry_run=False):
    from app.services.zoe.rag.kb_manager import create_article, update_article, list_articles
    print(f"🌱 KB Seeder — {len(ALL_KB_ARTICLES)} articles\n")
    existing = await list_articles(limit=1000)
    existing_ids = {a["id"] for a in existing}
    skipped = created = updated = errored = 0
    for article in ALL_KB_ARTICLES:
        aid = article.get("id"); title = article.get("title","Untitled")
        content = (article.get("content") or "").strip()
        if not content:
            print(f"  ⏭  SKIP: {title}"); skipped += 1; continue
        if dry_run:
            print(f"  🔍 [{'UPDATE' if aid in existing_ids else 'CREATE'}] {title}"); continue
        try:
            if aid in existing_ids:
                await update_article(aid, title=title, content=content, tags=article.get("tags",[]), publish=publish)
                print(f"  ✅ UPDATED: {title}"); updated += 1
            else:
                await create_article(title=title, category=article.get("category",""), content=content, tags=article.get("tags",[]), publish=publish)
                print(f"  ✅ CREATED: {title}"); created += 1
        except Exception as e:
            print(f"  ❌ ERROR: {title} — {e}"); errored += 1
    print(f"\n🏁 {created} created | {updated} updated | {skipped} skipped | {errored} errors")

async def seed_category(category, publish=True):
    filtered = [a for a in ALL_KB_ARTICLES if a.get("category") == category]
    print(f"🌱 Seeding {len(filtered)} articles for: {category}")
    from app.services.zoe.rag.kb_manager import create_article, update_article, list_articles
    existing = await list_articles(limit=1000)
    existing_ids = {a["id"] for a in existing}
    for article in filtered:
        content = (article.get("content") or "").strip()
        if not content: print(f"  ⏭  SKIP: {article.get('title')}"); continue
        try:
            if article.get("id") in existing_ids:
                await update_article(article["id"], title=article["title"], content=content, tags=article.get("tags",[]), publish=publish)
                print(f"  ✅ UPDATED: {article['title']}")
            else:
                await create_article(title=article["title"], category=article["category"], content=content, tags=article.get("tags",[]), publish=publish)
                print(f"  ✅ CREATED: {article['title']}")
        except Exception as e:
            print(f"  ❌ {article['title']}: {e}")

if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    category = next((a.split("=")[1] for a in sys.argv if a.startswith("--category=")), None)
    asyncio.run(seed_category(category) if category else seed_all(publish=True, dry_run=dry_run))
