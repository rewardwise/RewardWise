"""
agents/scheduler.py
────────────────────
Scheduling for the KB monitor agent.
Runs twice daily (9am + 9pm UTC) via GitHub Actions.

Cadence tiers:
  weekly    → transfer partners, lounge news — checks Mon + Thu
  monthly   → award charts, card benefits  — checks 1st + 15th
  quarterly → airline fees, elite status   — checks 1st of Jan/Apr/Jul/Oct

Groq usage per full run (all 30 sources):
  30 LLM calls × 2 runs/day = 60 calls/day
  Free limit: 14,400/day. We use 0.4% of the limit. Plenty of headroom.

Run time per full run: ~10-12 minutes
  Phase 1 scraping: ~60s (30 sources × 2s delay)
  Phase 2 LLM diff: ~90s (30 sources × 3s delay)
  Total: ~2.5 min. Well within the 10-15 min target.

DEPLOYMENT:
  Copy the GITHUB_ACTIONS_WORKFLOW below into:
  .github/workflows/kb_monitor.yml

  Add these to GitHub Secrets:
    GROQ_API_KEY
    SUPABASE_URL
    SUPABASE_KEY
"""

from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv()

# ── Local scheduler ───────────────────────────────────────────────────────────

async def run_scheduled(cadence: str, dry_run: bool = False) -> None:
    from app.agents.monitor_agent import run_cadence, run_all
    now = datetime.now(timezone.utc)
    print(f"⏰ Scheduler: {cadence} | {now.strftime('%Y-%m-%d %H:%M UTC')}")
    if cadence == "all":
        await run_all(dry_run=dry_run)
    else:
        await run_cadence(cadence, dry_run=dry_run)


def _auto_cadence() -> str:
    """Determine cadence from current date."""
    now   = datetime.now(timezone.utc)
    day   = now.day
    month = now.month
    dow   = now.weekday()  # 0=Mon, 3=Thu

    if day == 1 and month in (1, 4, 7, 10):
        return "quarterly"
    elif day in (1, 15):
        return "monthly"
    elif dow in (0, 3):
        return "weekly"
    else:
        return "skip"


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    run_arg = next((a.split("=")[1] for a in sys.argv if a.startswith("--run=")), None)

    cadence = run_arg or _auto_cadence()

    if cadence == "skip":
        print("⏭️  No cadence matches today — nothing to run")
        sys.exit(0)

    asyncio.run(run_scheduled(cadence, dry_run=dry_run))
