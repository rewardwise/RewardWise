from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any

from app.services.price_intelligence.baseline_repository import BaselineMatch


@dataclass(frozen=True)
class TrendScore:
    label: str
    percent_vs_median: float | None
    summary: str | None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def score_cash_price(current_cash_price: float | int | None, baseline: BaselineMatch) -> TrendScore:
    if current_cash_price is None:
        return TrendScore(label="unknown", percent_vs_median=None, summary=None)
    if not baseline.has_baseline or baseline.median_cash_price is None:
        return TrendScore(label="unknown", percent_vs_median=None, summary=None)

    current = float(current_cash_price)
    median = float(baseline.median_cash_price)
    p25 = baseline.p25_cash_price
    p75 = baseline.p75_cash_price
    p90 = baseline.p90_cash_price

    if median > 0:
        percent_vs_median = round(((current - median) / median) * 100, 1)
    else:
        percent_vs_median = None

    if p25 is not None and current <= float(p25):
        label = "cheap"
    elif p75 is not None and current <= float(p75):
        label = "normal"
    elif p90 is not None and current <= float(p90):
        label = "high"
    else:
        label = "unusually_high"

    readable = {
        "cheap": "below the usual range",
        "normal": "within the usual range",
        "high": "above the usual range",
        "unusually_high": "well above the usual range",
    }[label]
    summary = f"Cash is {readable} for this route context."
    return TrendScore(label=label, percent_vs_median=percent_vs_median, summary=summary)
