"""Per-option point-ownership + buy-the-gap fork for the cash-vs-points verdict.

This is a DETERMINISTIC extension of the verdict engine, NOT new search logic.
It answers, for a `use_points` verdict the engine already produced:

    - Do you actually hold (or can you transfer to) enough points to book this?
    - If you're short, is buying the gap ever rational?

The honest fork the prototype's "b3" state renders — "points win on value but
you're short, so pay cash and keep your points" — lives here so it is:
  * pytest-testable in isolation (pure function of verdict + wallet), and
  * the single source of truth Zoe and the UI both read (no re-derivation).

It must run OUTSIDE the shared verdict cache: the cash/award verdict is the same
for every user on a route, but ownership depends on the caller's live wallet.
`search.py` calls `compute_ownership(verdict, wallet_balances)` per request and
attaches the result to the response only — never to the cached/persisted verdict.

Reuse, do not duplicate:
  * Transfer ratios come from the canonical `data/loyalty/flexible_transfers.json`
    (same source the FE `transferPartners.ts` is generated from).
  * Program→brand routing comes from `PROGRAM_ALIASES`.
  * Recommendation thresholds (1.25 / 1.8) are NOT touched — buying is gated by a
    separate cpp-relative rule (redemption cpp must beat the buy rate).
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Optional

from app.program_aliases import PROGRAM_ALIASES

# ---------------------------------------------------------------------------
# Buy-the-gap model (tunable). Cents-per-point to PURCHASE miles directly from
# the program. Conservative on purpose: a program is "buyable" ONLY if it sells
# miles AND we have a rate for it — otherwise we DO NOT fabricate a cost (we say
# "can't buy, pay cash / earn toward it"). Rates are deliberately high so buying
# rarely clears the cpp-relative bar below. Defaults ~3.0¢; per-program override.
# ---------------------------------------------------------------------------
# Baseline buy rate (cents/point), env-tunable. Used for programs that sell
# miles at roughly the going ~3¢ rate; specific sellers override below.
DEFAULT_BUY_RATE_CPP = float(os.environ.get("BUY_RATE_CPP_DEFAULT", "3.0"))
_D = DEFAULT_BUY_RATE_CPP

# Per-program purchase rate (cents per point). Airlines AND hotels sell points
# directly, so both are buyable — claiming "you can't buy these" for a program
# that does sell points is a false-capability flag. Airlines not listed fall
# back to DEFAULT_BUY_RATE_CPP. Only flexible bank currencies are non-buyable
# (see NON_BUYABLE_SLUGS). Entries set to _D track the env-tunable default; the
# rest are program-specific. For weak redemptions the cpp rule routes to
# pay-cash with a truthful "not worth it" reason — never "can't buy".
BUY_RATE_CPP: dict[str, float] = {
    # ── Airlines ──────────────────────────────────────────────────────
    "united": 3.85,
    "aeroplan": _D,
    "delta": 3.5,
    "american": 3.3,
    "alaska": 2.96,
    "jetblue": 3.5,
    "avianca": 3.3,
    "lifemiles": 3.3,
    "flyingblue": _D,
    "air_france": _D,
    "british": 3.3,
    "virginatlantic": _D,
    "singapore": _D,
    "emirates": _D,
    "qatar": _D,
    "etihad": _D,
    "turkish": _D,
    "qantas": _D,
    "cathay": _D,
    # ── Hotels ────────────────────────────────────────────────────────
    # Conservative direct-purchase rates (Hyatt sells ~2.4¢, Marriott ~1.25¢).
    # Hotel award cpp is typically low, so the cpp rule sends most short hotel
    # cases to pay-cash via short_buy_not_worth_it, not short_cant_buy.
    "hyatt": 2.4,
    "marriott": 1.25,
}

# Margin (USD) the cash savings must clear the buy cost by before buying is
# "worth it" — a secondary guard on top of the primary cpp-relative rule.
BUY_GAP_SAVINGS_MARGIN_USD = float(os.environ.get("BUY_GAP_SAVINGS_MARGIN_USD", "0"))

# seats.aero source slug → flexible_transfers.json partner_display string.
# Mirrors Frontend/scripts/build_transfer_partners.mjs SOURCE_SLUG_TO_PARTNER_DISPLAY
# (the two vocabularies don't match 1:1; keep these in sync if either changes).
SOURCE_SLUG_TO_PARTNER_DISPLAY: dict[str, Optional[str]] = {
    "aeroplan": "Air Canada Aeroplan",
    "united": "United MileagePlus",
    "delta": "Delta SkyMiles",
    "american": "American AAdvantage",
    "alaska": None,
    "jetblue": "JetBlue TrueBlue",
    "flyingblue": "Flying Blue",
    "air_france": "Flying Blue",
    "virginatlantic": "Virgin Atlantic Flying Club",
    "british": "British Airways Executive Club",
    "singapore": "Singapore KrisFlyer",
    "cathay": "Cathay Asia Miles",
    "emirates": "Emirates Skywards",
    "turkish": "Turkish Miles&Smiles",
    "qantas": "Qantas Frequent Flyer",
    "avianca": "Avianca LifeMiles",
    "lifemiles": "Avianca LifeMiles",
    "etihad": "Etihad Guest",
    "qatar": "Qatar Airways Privilege Club",
    "saudia": None,
    "smiles": None,
    "azul": None,
    "korean": None,
    "ana": "ANA Mileage Club",
    "hyatt": "World of Hyatt",
    "marriott": "Marriott Bonvoy",
}

_FLEX_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "data", "loyalty", "flexible_transfers.json"
)


@lru_cache(maxsize=1)
def _flex_data() -> dict:
    """Load + cache the canonical flexible-transfers ratios JSON."""
    try:
        with open(_FLEX_PATH, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {"currencies": []}


@lru_cache(maxsize=1)
def _flex_currency_names() -> frozenset:
    return frozenset(c.get("currency_display", "") for c in _flex_data().get("currencies", []))


def transferable_balance(slug: str, wallet_balances: dict) -> tuple[int, list]:
    """Max points the user can land in `slug`, applying real transfer ratios.

    Sums (a) native miles held directly in the program and (b) the best-ratio
    conversion from each flexible currency the user holds. `wallet_balances` is
    keyed by reward_programs.name brand (e.g. "Chase Ultimate Rewards": 80000).

    Returns (total_destination_points, reachable_partners) where each partner is
    {sourceCard, short, ratio, converted, native}. Conversion floors fractional
    miles (5:4 → 80%), matching how transfers actually post.
    """
    slug = (slug or "").lower()
    flex_names = _flex_currency_names()
    partner_display = SOURCE_SLUG_TO_PARTNER_DISPLAY.get(slug)
    total = 0
    reachable: list[dict] = []

    # (a) Native miles: the airline's own loyalty program held directly. Sources:
    # PROGRAM_ALIASES entries that aren't flexible currencies, PLUS the program's
    # own display name (covers slugs with empty aliases, e.g. JetBlue TrueBlue).
    # A set dedupes the overlap so native miles are never double-counted. 1:1.
    native_brands = {b for b in PROGRAM_ALIASES.get(slug, []) if b not in flex_names}
    if partner_display and partner_display not in flex_names:
        native_brands.add(partner_display)
    for brand in native_brands:
        bal = int(wallet_balances.get(brand, 0) or 0)
        if bal > 0:
            total += bal
            reachable.append(
                {"sourceCard": brand, "short": brand, "ratio": "1:1", "converted": bal, "native": True}
            )

    # (b) Flexible currencies → this program, at the JSON's real ratio.
    if partner_display:
        for currency in _flex_data().get("currencies", []):
            brand = currency.get("currency_display", "")
            bal = int(wallet_balances.get(brand, 0) or 0)
            if bal <= 0:
                continue
            match = next(
                (
                    p
                    for p in currency.get("partners", [])
                    if p.get("partner_display") == partner_display and p.get("status") == "active"
                ),
                None,
            )
            if not match:
                continue
            ratio_from = int(match.get("ratio_from") or 1) or 1
            ratio_to = int(match.get("ratio_to") or 1)
            converted = bal * ratio_to // ratio_from
            if converted <= 0:
                continue
            total += converted
            reachable.append(
                {
                    "sourceCard": brand,
                    "short": brand,
                    "ratio": f"{ratio_from}:{ratio_to}",
                    "converted": converted,
                    "native": False,
                }
            )

    return total, reachable


# Non-buyable: flexible bank currencies ONLY. Airlines and hotels sell points
# directly (buyable above), so "you can't buy these" would be a false statement
# for them. Flexible currencies (Amex MR / Chase UR / Cap One) aren't seats.aero
# award sources so they don't appear as a winner slug, but they're listed for
# correctness if ever surfaced directly — they're the one genuinely-can't-buy
# category, so short_cant_buy only ever fires here.
NON_BUYABLE_SLUGS = {
    "amex_mr", "chase_ur", "capital_one", "citi_typ", "bilt", "wells_fargo",
}


def buy_rate_for(slug: str) -> Optional[float]:
    """Cents-per-point to buy `slug` points, or None for non-buyable programs
    (flexible bank currencies). Airlines + hotels are buyable; unlisted airlines
    default to DEFAULT_BUY_RATE_CPP rather than being mislabeled "can't buy"."""
    slug = (slug or "").lower()
    if slug in NON_BUYABLE_SLUGS:
        return None
    return BUY_RATE_CPP.get(slug, DEFAULT_BUY_RATE_CPP)


def compute_ownership(verdict: dict, wallet_balances: Optional[dict]) -> Optional[dict]:
    """Deterministic ownership fork for a `use_points` verdict.

    Pure function of (verdict, wallet). Returns None when a fork doesn't apply
    (no points winner, or the engine already says pay_cash/wait). Never mutates
    the verdict. The thresholds that decided use_points vs pay_cash are NOT
    revisited here — this only answers "can the caller actually book the points
    option, and if not, is closing the gap rational?"
    """
    if not isinstance(verdict, dict):
        return None
    if verdict.get("recommendation") != "use_points":
        return None
    winner = verdict.get("winner") or {}
    metrics = verdict.get("metrics") or {}
    slug = (winner.get("program") or "").lower()
    points_needed = metrics.get("points_cost")
    if not slug or not points_needed:
        return None

    redemption_cpp = metrics.get("cpp")
    savings = metrics.get("estimated_savings")
    wallet_balances = wallet_balances or {}

    owned_balance, reachable = transferable_balance(slug, wallet_balances)
    shortfall = max(0, int(points_needed) - int(owned_balance))
    can_afford = shortfall == 0

    buy_rate = buy_rate_for(slug)
    buyable = buy_rate is not None
    buy_gap_cost: Optional[float] = None
    if buyable and shortfall > 0:
        buy_gap_cost = round(shortfall * buy_rate / 100.0, 2)

    # cpp-relative rule (primary): buying is only EVER rational when the
    # redemption cpp beats what you pay per point to buy. If cpp < buy rate,
    # buying loses money — recommend cash outright. Secondary guard: the buy
    # cost must still come in under the cash savings (by the margin).
    # Fail closed: unknown savings -> not worth it (conservative bias).
    buy_gap_worth_it = bool(
        not can_afford
        and buyable
        and redemption_cpp is not None
        and redemption_cpp > buy_rate
        and buy_gap_cost is not None
        and savings is not None
        and buy_gap_cost < (float(savings) - BUY_GAP_SAVINGS_MARGIN_USD)
    )

    if can_afford:
        fork_recommendation, fork_reason = "use_points", "owned_sufficient"
    elif buy_gap_worth_it:
        # Rational top-up. Buying stays a DE-EMPHASIZED option in the UI; we keep
        # the points path, but buying is never itself "the recommendation".
        fork_recommendation, fork_reason = "use_points", "short_buy_worth_it"
    elif not buyable:
        fork_recommendation, fork_reason = "pay_cash", "short_cant_buy"
    else:
        fork_recommendation, fork_reason = "pay_cash", "short_buy_not_worth_it"

    return {
        "applicable": True,
        "program": slug,
        "program_label": SOURCE_SLUG_TO_PARTNER_DISPLAY.get(slug) or winner.get("program"),
        "points_needed": int(points_needed),
        "owned_balance": int(owned_balance),
        "shortfall": int(shortfall),
        "can_afford": can_afford,
        "reachable_partners": reachable,
        "buyable": buyable,
        "buy_rate_cpp": buy_rate,
        "redemption_cpp": redemption_cpp,
        "buy_gap_cost": buy_gap_cost,
        "buy_gap_worth_it": buy_gap_worth_it,
        "fork_recommendation": fork_recommendation,
        "fork_reason": fork_reason,
    }
