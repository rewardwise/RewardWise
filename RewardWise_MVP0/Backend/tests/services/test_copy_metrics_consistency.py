"""Copy-vs-metrics guard: the points figure INSIDE the explanation string must
equal metrics.points_cost. The identity guard covers metrics internally; a
wrong narrative number would bypass it (2026-07-28 investigation: prod turned
out consistent — the '320k vs 310k' was two different verdicts after a Delta
reprice — but nothing STRUCTURALLY prevented a split; this guard does).

Fails-pre demonstration: distorting the display-totals path (the copy's
source) while metrics stays honest trips the guard (see the sabotage test).
"""
import re

import pytest

import app.services.verdict_service as vs


def _explanation_points(text: str) -> list[int]:
    return [int(x.replace(",", "")) for x in re.findall(r"([\d,]{4,}) points", text)]


AWARDS = [
    {"program": "delta", "points": 190000, "taxes": 5.6, "cpp": 1.18, "date": "2027-03-15", "remaining_seats": 4},
    {"program": "alaska", "points": 130000, "taxes": 41.0, "cpp": 1.69, "date": "2027-03-15", "remaining_seats": 7},
]
RETURNS = [
    {"program": "alaska", "points": 130000, "taxes": 91.23, "cpp": 1.44, "date": "2027-03-31", "remaining_seats": 1},
]


async def _verdict(cash=3669.0):
    return await vs.generate_verdict(
        origin="SEA", destination="NRT,HND", date="2027-03-15", cabin="business",
        travelers=1, is_roundtrip=True, return_date="2027-03-31",
        cash_price=cash, award_options=AWARDS, return_award_options=RETURNS,
        user_programs=["delta", "alaska"],
    )


@pytest.mark.asyncio
async def test_copy_points_equal_metrics_points_cost():
    v = await _verdict()
    pts = _explanation_points(v.get("explanation") or "")
    assert pts, "explanation must state a points figure"
    m = v["metrics"]
    for p in pts:
        assert p == m["points_cost"], f"copy says {p:,}, metrics say {m['points_cost']:,}"


@pytest.mark.asyncio
async def test_guard_trips_on_a_sabotaged_display_path(monkeypatch):
    """Fails-pre bar: recreate the feared divergence (copy source drifting
    from metrics source) and prove this guard catches what the identity
    check cannot — the identity only sees metrics."""
    real = vs._display_award_totals

    def skewed(*a, **k):
        pts, taxes = real(*a, **k)
        return pts + 10000, taxes  # the hypothetical 320k-vs-310k split

    monkeypatch.setattr(vs, "_display_award_totals", skewed)
    v = await _verdict()
    pts = _explanation_points(v.get("explanation") or "")
    m = v["metrics"]
    # identity guard would still PASS on metrics alone; the copy guard fails:
    assert any(p != m["points_cost"] for p in pts), "sabotage must be visible to this guard"


def test_ingestion_drops_junk_taxes_and_dupes():
    """Observed provider junk (SEA-NRT business 2026-07-28): a $14,300-taxes
    delta row and byte-identical emirates duplicates. Both are removed at
    ingestion now — the engine no longer relies on cpp scoring to neutralize
    garbage, and users never see a -7.25cpp 'option'."""
    from app.api.search import _make_award_cleaner

    clean = _make_award_cleaner(travelers=1)
    raw = [
        {"program": "delta", "points": 170000, "taxes": 1430000, "date": "2027-03-31", "remaining_seats": 1},   # $14,300 junk
        {"program": "emirates", "points": 201000, "taxes": 125400, "date": "2027-03-15", "remaining_seats": 7}, # $1,254 legit
        {"program": "emirates", "points": 201000, "taxes": 125400, "date": "2027-03-15", "remaining_seats": 7}, # exact dup
        {"program": "alaska", "points": 130000, "taxes": 9123, "date": "2027-03-31", "remaining_seats": 1},
        {"program": "united", "points": 80000, "taxes": 500, "date": "2027-03-15", "remaining_seats": 0},       # no seats
    ]
    out = clean(raw)
    programs = [(a["program"], a["points"]) for a in out]
    assert ("delta", 170000) not in programs, "junk-tax row must drop"
    assert programs.count(("emirates", 201000)) == 1, "dupes collapse to one"
    assert ("alaska", 130000) in programs
    assert ("united", 80000) not in programs, "zero-seat rows still drop"
