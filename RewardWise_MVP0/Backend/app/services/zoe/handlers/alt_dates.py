"""
zoe/handlers/alt_dates.py
──────────────────────────
Returns concrete alternative-date award availability around the user's
verdict — not a generic "try shifting dates" response.

Activation:
  Router classifies "alt_dates" only when verdict_context is present AND
  the user's message contains alt-dates phrasing ("other dates", "cheaper
  days", "fly earlier or later", etc.). Without verdict_context we have no
  origin/destination/date to range-search.

Pipeline:
  1. Parse origin / destination / base date / cabin from verdict_context text
     (frontend assembles this as a fixed-template English sentence in
     VerdictCard.tsx — we reverse-parse it here).
  2. seats.aero range-mode call: ±WINDOW_DAYS around the base date in a
     single request (start_date=base-N, end_date=base+N, take=100).
  3. For each date in the window other than the base date, keep the
     cheapest award; sort ascending; take top N.
  4. Render concrete text — no LLM call. The whole point of this handler
     is to deliver actual numbers, not paraphrase them through an LLM
     that might hallucinate.

Graceful fallback: if verdict_context is missing or unparseable, or the
search returns nothing better, we say so honestly and suggest a re-search.
"""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from typing import Any, Optional

from app.services.seats_service import search_award_availability


WINDOW_DAYS = 7         # ±7-day search window around the base date
TOP_N = 3               # surface top 3 cheaper alternatives
DATE_FMT = "%Y-%m-%d"


# ── verdict_context parsing ───────────────────────────────────────────────────

_ORIGIN_DEST_RE = re.compile(
    r"for\s+([A-Z]{3})\s*(?:→|->|to)\s*([A-Z]{3})",
    re.IGNORECASE,
)
_DATE_RE = re.compile(r"\bon\s+(\d{4}-\d{2}-\d{2})\b", re.IGNORECASE)
_CABIN_RE = re.compile(
    r"\b(business|first|economy)\s+class\b",
    re.IGNORECASE,
)
_BASE_POINTS_RE = re.compile(
    r"Best award:\s*([\d,]+)\s+points",
    re.IGNORECASE,
)


def _parse_verdict_context(text: str) -> Optional[dict[str, Any]]:
    """Extract O/D/date/cabin/base-points from the verdict sentence."""
    if not text:
        return None

    od = _ORIGIN_DEST_RE.search(text)
    dm = _DATE_RE.search(text)
    cm = _CABIN_RE.search(text)
    if not (od and dm and cm):
        return None

    cabin_raw = cm.group(1).lower()
    cabin = "business" if "business" in cabin_raw else (
        "first" if "first" in cabin_raw else "economy"
    )

    base_points: Optional[int] = None
    bp = _BASE_POINTS_RE.search(text)
    if bp:
        try:
            base_points = int(bp.group(1).replace(",", ""))
        except ValueError:
            base_points = None

    return {
        "origin":      od.group(1).upper(),
        "destination": od.group(2).upper(),
        "date":        dm.group(1),
        "cabin":       cabin,
        "base_points": base_points,
    }


# ── Cheapest-per-date reduction ───────────────────────────────────────────────

def _normalize_date(raw: Any) -> Optional[str]:
    """Coerce seats.aero `Date` to plain YYYY-MM-DD.

    seats.aero has historically returned both `"2026-07-04"` and
    `"2026-07-04T00:00:00+00:00"` shapes depending on endpoint. We key,
    pop, and render exclusively off the 10-char prefix so the base-date
    exclusion and the human formatter never fall apart on a `T`-suffix.
    """
    if not isinstance(raw, str) or len(raw) < 10:
        return None
    candidate = raw[:10]
    # Cheap shape check — prevents accidentally accepting garbage.
    if candidate[4] != "-" or candidate[7] != "-":
        return None
    return candidate


def _cheapest_by_date(results: list[dict]) -> dict[str, dict]:
    """For each award date, keep the entry with the lowest points cost.

    Keyed on normalized YYYY-MM-DD so the downstream base-date pop and
    date formatter behave regardless of whether seats.aero returned a
    plain date or a timestamp.
    """
    best: dict[str, dict] = {}
    for r in results:
        d = _normalize_date(r.get("date"))
        pts = r.get("points")
        if not d or pts is None:
            continue
        prev = best.get(d)
        if prev is None or pts < prev["points"]:
            # Stamp the normalized date back on the record so all downstream
            # consumers (sort key, renderer) work off the same shape.
            r = {**r, "date": d}
            best[d] = r
    return best


def _format_date_human(d: str) -> str:
    """2026-07-04 → 'Jul 4'. Avoids the %-d / %#d platform split."""
    try:
        dt = datetime.strptime(d, DATE_FMT)
        return f"{dt.strftime('%b')} {dt.day}"
    except ValueError:
        return d


def _format_points(p: int) -> str:
    return f"{p:,}"


# ── Response rendering ────────────────────────────────────────────────────────

_DISCLAIMER = "Availability changes fast — verify before transferring points."


def _render_alternatives(
    parsed: dict[str, Any],
    alts: list[dict],
) -> str:
    base_date_h = _format_date_human(parsed["date"])
    base_pts = parsed.get("base_points")

    if not alts:
        if base_pts:
            return (
                f"I checked ±{WINDOW_DAYS} days around {base_date_h} for "
                f"{parsed['origin']} → {parsed['destination']} "
                f"({parsed['cabin']}) — nothing cheaper than your "
                f"{_format_points(base_pts)} points showed up. "
                f"Your current date is the best available right now. {_DISCLAIMER}"
            )
        # No base award cost in the verdict — can't claim "best available",
        # just say we didn't find award space worth flagging.
        return (
            f"I checked ±{WINDOW_DAYS} days around {base_date_h} for "
            f"{parsed['origin']} → {parsed['destination']} "
            f"({parsed['cabin']}) — no clearly cheaper award dates surfaced. "
            f"Run the search again if availability changes. {_DISCLAIMER}"
        )

    lines: list[str] = []
    lead = alts[0]
    lead_date = _format_date_human(lead["date"])
    lead_pts = _format_points(lead["points"])
    lead_prog = (lead.get("program") or "an airline partner").replace("_", " ")
    if base_pts:
        lines.append(
            f"{lead_date} has award space at {lead_pts} points via "
            f"{lead_prog} vs {_format_points(base_pts)} on your date "
            f"({base_date_h})."
        )
    else:
        # Cash-only verdict (no points anchor parsed). Don't claim
        # "cheaper than your date" — we have no number to compare against.
        # Just report what's actually available in the window.
        lines.append(
            f"Your verdict didn't include an award cost to compare against, "
            f"but I found award space near {base_date_h}: "
            f"{lead_date} at {lead_pts} points via {lead_prog}."
        )

    for alt in alts[1:]:
        d_h = _format_date_human(alt["date"])
        pts_h = _format_points(alt["points"])
        prog = (alt.get("program") or "partner").replace("_", " ")
        if base_pts:
            # Lead anchored "cheaper than" claim — followups can keep the
            # "drops further" framing.
            lines.append(f"{d_h} drops further to {pts_h} via {prog}.")
        else:
            # No baseline — neutral framing for each alt.
            lines.append(f"{d_h} shows {pts_h} via {prog}.")

    lines.append(_DISCLAIMER)
    return " ".join(lines)


def _fallback(message: str) -> dict[str, Any]:
    return {"message": message, "prefill": None}


# ── Public entry point ────────────────────────────────────────────────────────

async def handle(
    message: str,
    history: list[dict],
    wallet: list[dict],
    *,
    verdict_context: str | None = None,
    rag_chunks: list[dict] | None = None,
    rag_examples: list[dict] | None = None,
    rag_corrections: list[dict] | None = None,
    is_voice: bool = False,
) -> dict[str, Any]:
    # Signature mirrors the other handlers so zoe_service.py can dispatch
    # uniformly; this handler intentionally bypasses LLM + RAG + wallet.
    del message, history, wallet, rag_chunks, rag_examples, rag_corrections, is_voice

    parsed = _parse_verdict_context(verdict_context or "")
    if not parsed:
        return _fallback(
            "I'd love to scan nearby dates, but I can't see the trip "
            "details from your current search. Try running the search "
            "again and clicking 'Ask Zoe' on a result."
        )

    base_date_obj: date
    try:
        base_date_obj = datetime.strptime(parsed["date"], DATE_FMT).date()
    except ValueError:
        return _fallback(
            "The date on your verdict didn't parse cleanly — re-run the "
            "search and I'll take another look."
        )

    start = (base_date_obj - timedelta(days=WINDOW_DAYS)).strftime(DATE_FMT)
    end   = (base_date_obj + timedelta(days=WINDOW_DAYS)).strftime(DATE_FMT)

    try:
        results = await search_award_availability(
            parsed["origin"],
            parsed["destination"],
            start,
            parsed["cabin"],
            end_date=end,
            take=200,
        )
    except Exception as exc:
        print("⚠️ alt_dates seats.aero error:", exc)
        return _fallback(
            "Couldn't reach the award-availability source just now. "
            "Try again in a minute and I'll check nearby dates."
        )

    by_date = _cheapest_by_date(results or [])
    by_date.pop(parsed["date"], None)        # exclude the user's own date

    base_pts = parsed.get("base_points")
    candidates = list(by_date.values())
    if base_pts:
        candidates = [c for c in candidates if c["points"] < base_pts]

    candidates.sort(key=lambda r: (r["points"], r["date"]))
    alts = candidates[:TOP_N]

    return _fallback(_render_alternatives(parsed, alts))
