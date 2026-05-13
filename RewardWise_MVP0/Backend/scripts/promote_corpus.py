"""
scripts/promote_corpus.py
──────────────────────────
Manually promotes high-signal interactions from zoe_interactions
into the kb_interactions_corpus (RAG Layer 2).

Normally this happens automatically when:
  - A user gives thumbs up
  - A search is triggered from a Zoe conversation
  - A PM submits an eval with score >= 4

Use this script to backfill the corpus from existing interactions
before the automatic pipeline has run long enough to build up examples.

Run from Backend/ directory:
    python scripts/promote_corpus.py

Options:
    --min-score 4        Only promote interactions with feedback_score >= N
    --intent trip        Only promote a specific intent
    --limit 100          Max interactions to process
    --dry-run            Show what would be promoted without inserting
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from app.db.client import get_db_client


async def promote(
    min_score: int = 4,
    intent_filter: str | None = None,
    limit: int = 100,
    dry_run: bool = False,
):
    db = get_db_client()

    print(f"\n{'━'*60}")
    print(f"  Promote interactions → Layer 2 corpus")
    print(f"  min_score={min_score}  intent={intent_filter or 'all'}  limit={limit}  dry_run={dry_run}")
    print(f"{'━'*60}\n")

    # Fetch already-promoted interaction IDs to avoid duplicates
    existing = db.table("kb_interactions_corpus").select("interaction_id").execute()
    already_promoted = {r["interaction_id"] for r in (existing.data or [])}
    print(f"  Already in corpus: {len(already_promoted)} interactions\n")

    # Fetch candidate interactions
    query = (
        db.table("zoe_interactions")
        .select("id, intent, user_message, zoe_response, feedback_signal, feedback_score")
        .not_.is_("feedback_signal", "null")
        .order("created_at", desc=True)
        .limit(limit * 3)  # fetch more to filter
    )
    if intent_filter:
        query = query.eq("intent", intent_filter)

    result = query.execute()
    candidates = result.data or []

    # Filter: not already promoted, meets score threshold
    to_promote = [
        r for r in candidates
        if r["id"] not in already_promoted
        and (r.get("feedback_score") is None or r.get("feedback_score", 0) >= min_score)
    ][:limit]

    print(f"  Found {len(candidates)} interactions with feedback signals")
    print(f"  Eligible to promote: {len(to_promote)}\n")

    if not to_promote:
        print("  Nothing to promote.")
        return

    if dry_run:
        print("  DRY RUN — would promote:")
        for r in to_promote[:10]:
            print(f"    [{r['intent']:<20}] {r['user_message'][:60]}")
        if len(to_promote) > 10:
            print(f"    ... and {len(to_promote) - 10} more")
        return

    from app.services.zoe.rag.kb_manager import ingest_interaction

    success = 0
    failed = 0

    for i, row in enumerate(to_promote, 1):
        print(f"  [{i:03d}/{len(to_promote):03d}] {row['intent']:<20} {row['user_message'][:45]:<45}", end="", flush=True)

        try:
            ok = await ingest_interaction(
                interaction_id=row["id"],
                intent=row["intent"],
                user_message=row["user_message"],
                zoe_response=row["zoe_response"],
                approval_source=row.get("feedback_signal", "thumbs_up"),
                rating=row.get("feedback_score"),
            )
            if ok:
                success += 1
                print(" ✓")
            else:
                failed += 1
                print(" ✗")
        except Exception as e:
            failed += 1
            print(f" ✗ {e}")

        await asyncio.sleep(0.3)  # rate limit embed calls

    print(f"\n  Done. Promoted: {success}  Failed: {failed}")
    print(f"  Layer 2 corpus now has {len(already_promoted) + success} entries.\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Promote interactions to Layer 2 RAG corpus")
    parser.add_argument("--min-score", type=int, default=4)
    parser.add_argument("--intent", default=None)
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    asyncio.run(promote(
        min_score=args.min_score,
        intent_filter=args.intent,
        limit=args.limit,
        dry_run=args.dry_run,
    ))
