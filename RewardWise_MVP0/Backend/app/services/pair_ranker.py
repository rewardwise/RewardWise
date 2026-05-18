"""Pure pair-ranking over (outbound, return) award options.

Given outbound + return award lists, pick the (outbound, return) pair with the
lowest total points where return.date > outbound.date. Tiebreaker: earliest
outbound iso date wins. Empty inputs or no valid pair => (None, None).
"""

from __future__ import annotations

from datetime import date
from typing import Any


def rank_pairs(
    outbound_options: list[dict[str, Any]],
    return_options: list[dict[str, Any]],
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if not outbound_options or not return_options:
        return None, None

    best_key: tuple[int, str] | None = None
    best_pair: tuple[dict[str, Any], dict[str, Any]] | None = None

    for o in outbound_options:
        o_date_str = o.get("date") or ""
        if not o_date_str:
            continue
        try:
            o_date = date.fromisoformat(o_date_str)
        except ValueError:
            continue
        o_points = int(o.get("points") or 0)
        for r in return_options:
            r_date_str = r.get("date") or ""
            if not r_date_str:
                continue
            try:
                r_date = date.fromisoformat(r_date_str)
            except ValueError:
                continue
            if r_date <= o_date:
                continue
            total = o_points + int(r.get("points") or 0)
            key = (total, o_date_str)
            if best_key is None or key < best_key:
                best_key = key
                best_pair = (o, r)

    if best_pair is None:
        return None, None
    return best_pair
