"""Boot-time assertions for must-load static data.

Why this exists (2026-07-28): `ownership._flex_data` fails SOFT — an
unreadable/empty `flexible_transfers.json` degrades to an empty transfer
table, which silently disables ALL transfer reachability and turns every
ownership "you can book this" into "can't book", with full confidence and
zero signal. Same silent-zero class as the L2 schema-drift bug. A broken
deploy must fail LOUDLY at boot, not serve reachability-blind verdicts.

Scope discipline: only data whose absence produces wrong-but-confident
output belongs here. Optional config (env-driven features, provider keys
with honest degraded states) stays out.
"""

from __future__ import annotations

import json
import os

# Canonical flexible currencies the engine's transfer reachability depends
# on. Matches currency_id values in the file — if one of these vanishes,
# reachability for that ecosystem silently dies.
REQUIRED_FLEX_CURRENCIES = {
    "amex_membership_rewards",
    "chase_ultimate_rewards",
    "capital_one_miles",
    "citi_thankyou",
}

_FLEX_PATH = os.path.join(
    os.path.dirname(__file__), "data", "loyalty", "flexible_transfers.json"
)


class StartupCheckError(RuntimeError):
    """A must-load static asset is missing or invalid — refuse to boot."""


def validate_flexible_transfers(path: str = _FLEX_PATH) -> None:
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except FileNotFoundError as exc:
        raise StartupCheckError(
            f"BOOT ABORTED: {path} is MISSING. Without it, transfer "
            "reachability is silently disabled and every ownership verdict "
            "becomes 'can't book'. Fix the deploy artifact."
        ) from exc
    except (ValueError, OSError) as exc:
        raise StartupCheckError(
            f"BOOT ABORTED: {path} is UNREADABLE/INVALID JSON ({exc}). "
            "Refusing to serve reachability-blind verdicts."
        ) from exc

    currencies = data.get("currencies") or []
    if not currencies:
        raise StartupCheckError(
            f"BOOT ABORTED: {path} parsed but contains NO currencies — the "
            "transfer table is empty. Refusing to serve reachability-blind "
            "verdicts."
        )

    ids = {c.get("currency_id") for c in currencies}
    missing = REQUIRED_FLEX_CURRENCIES - ids
    if missing:
        raise StartupCheckError(
            f"BOOT ABORTED: {path} is missing required flexible currencies: "
            f"{sorted(missing)}. Present: {sorted(i for i in ids if i)}."
        )

    empty_partner_lists = [
        c.get("currency_id")
        for c in currencies
        if c.get("currency_id") in REQUIRED_FLEX_CURRENCIES and not c.get("partners")
    ]
    if empty_partner_lists:
        raise StartupCheckError(
            f"BOOT ABORTED: {path} has EMPTY partner lists for required "
            f"currencies {empty_partner_lists} — transfer reachability for "
            "those ecosystems would silently die."
        )


def run_startup_checks() -> None:
    """All must-load static data checks. Called from app startup; raises
    StartupCheckError (crashing the boot) on any failure."""
    validate_flexible_transfers()
    print("startup_checks: flexible_transfers.json OK "
          f"({len(REQUIRED_FLEX_CURRENCIES)} required currencies present)")
