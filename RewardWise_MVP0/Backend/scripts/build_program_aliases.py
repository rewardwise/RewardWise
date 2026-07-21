#!/usr/bin/env python3
"""Generate app/program_aliases.py from flexible_transfers.json.

Single transfer-truth source (#2 step b): PROGRAM_ALIASES was hand-maintained
and diverged from flexible_transfers.json (Amex -> Virgin Atlantic and
Amex -> Delta were missing, which split the engine's wallet-reachability from
the card's How-to-book reachability). This generator derives the aliases from
the same JSON the card uses; tests/test_alias_parity.py regenerates in CI and
blocks merges when the committed file drifts.

Run: python3 scripts/build_program_aliases.py  (from Backend/)
"""
from __future__ import annotations

import json
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
SOURCE = BACKEND / "app" / "data" / "loyalty" / "flexible_transfers.json"
TARGET = BACKEND / "app" / "program_aliases.py"

# seats.aero source slug -> flexible_transfers partner_display.
# Mirror of Frontend/scripts/build_transfer_partners.mjs SOURCE_SLUG_TO_PARTNER_DISPLAY.
SOURCE_SLUG_TO_PARTNER_DISPLAY: dict[str, str | None] = {
    "aeroplan": "Air Canada Aeroplan",
    "united": "United MileagePlus",
    "delta": "Delta SkyMiles",
    "american": "American AAdvantage",
    "alaska": None,  # no transfers from major flex programs
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

# Native loyalty-program names as they appear in reward_programs.name — a user
# holding the program directly can always book it. Only names known to exist
# in the DB (mirrors the natives the hand-maintained file carried).
NATIVE_NAMES: dict[str, str] = {
    "aeroplan": "Air Canada Aeroplan",
    "united": "United MileagePlus",
    "delta": "Delta SkyMiles",
    "american": "American AAdvantage",
    "alaska": "Alaska Mileage Plan",
    "cathay": "Cathay Asia Miles",
    "ana": "ANA Mileage Club",
    "hyatt": "World of Hyatt",
    "marriott": "Marriott Bonvoy",
}


def build_aliases(data: dict) -> dict[str, list[str]]:
    by_partner_display: dict[str, list[str]] = {}
    for cur in data.get("currencies", []):
        cur_name = cur.get("currency_display")
        for p in cur.get("partners", []):
            if p.get("status") != "active":
                continue
            by_partner_display.setdefault(p.get("partner_display"), []).append(cur_name)

    out: dict[str, list[str]] = {}
    for slug, partner_display in SOURCE_SLUG_TO_PARTNER_DISPLAY.items():
        banks = by_partner_display.get(partner_display, []) if partner_display else []
        native = NATIVE_NAMES.get(slug)
        aliases = list(dict.fromkeys(banks + ([native] if native else [])))
        out[slug] = aliases
    return out


def render(aliases: dict[str, list[str]], as_of: str) -> str:
    lines = [
        "# AUTO-GENERATED — do not edit by hand.",
        "# Source: app/data/loyalty/flexible_transfers.json"
        f" (as_of {as_of})",
        "# Regenerate: python3 scripts/build_program_aliases.py",
        "# CI guard: tests/test_alias_parity.py fails on drift.",
        "#",
        "# Maps seats.aero Source slug -> reward_programs.name values that can",
        "# book it (transferable bank currencies + the native program name).",
        "PROGRAM_ALIASES: dict[str, list[str]] = {",
    ]
    for slug, names in aliases.items():
        if not names:
            lines.append(f'    "{slug}": [],')
        else:
            quoted = ", ".join(f'"{n}"' for n in names)
            lines.append(f'    "{slug}": [{quoted}],')
    lines.append("}")
    return "\n".join(lines) + "\n"


TS_TARGET = BACKEND.parent / "Frontend" / "utils" / "programAliases.ts"


def render_ts(aliases: dict[str, list[str]], as_of: str) -> str:
    lines = [
        "/** @format */",
        "",
        "// AUTO-GENERATED — do not edit by hand.",
        f"// Source: Backend/app/data/loyalty/flexible_transfers.json (as_of {as_of})",
        "// Regenerate: python3 Backend/scripts/build_program_aliases.py",
        "// (emits BOTH this file and Backend/app/program_aliases.py from one source)",
        "export const PROGRAM_ALIASES: Record<string, string[]> = {",
    ]
    for slug, names in aliases.items():
        quoted = ", ".join(f'"{n}"' for n in names)
        lines.append(f"\t{slug}: [{quoted}],")
    lines.append("};")
    return "\n".join(lines) + "\n"


def main() -> None:
    data = json.loads(SOURCE.read_text())
    aliases = build_aliases(data)
    as_of = data.get("as_of", "?")
    TARGET.write_text(render(aliases, as_of))
    TS_TARGET.write_text(render_ts(aliases, as_of))
    print(f"wrote {TARGET} and {TS_TARGET} ({sum(len(v) for v in aliases.values())} alias entries)")


if __name__ == "__main__":
    main()
