"""CI parity guard (#2 step b): the committed PROGRAM_ALIASES must equal what
the generator derives from flexible_transfers.json — the two transfer-truth
datasets can never diverge again (Amex->Virgin Atlantic / Amex->Delta were
missing from the hand-maintained file, splitting engine reachability from the
card's How-to-book reachability). Blocks merges alongside the metrics
identity check."""
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND / "scripts"))

from build_program_aliases import SOURCE, build_aliases  # noqa: E402
from app.program_aliases import PROGRAM_ALIASES  # noqa: E402


def test_program_aliases_match_flexible_transfers():
    generated = build_aliases(json.loads(SOURCE.read_text()))
    assert set(PROGRAM_ALIASES) == set(generated), (
        "slug sets diverged — regenerate: python3 scripts/build_program_aliases.py"
    )
    diverged = {
        slug: {"committed": sorted(PROGRAM_ALIASES[slug]), "generated": sorted(generated[slug])}
        for slug in generated
        if sorted(PROGRAM_ALIASES[slug]) != sorted(generated[slug])
    }
    assert not diverged, (
        "PROGRAM_ALIASES drifted from flexible_transfers.json — regenerate: "
        f"python3 scripts/build_program_aliases.py — diverged: {diverged}"
    )
