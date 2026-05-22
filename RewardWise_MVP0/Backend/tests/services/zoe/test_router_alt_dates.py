"""Router tests for the alt_dates intent (ClickUp 86ba26mhb)."""

import pytest

from app.services.zoe.router import classify


@pytest.mark.parametrize(
    "msg",
    [
        "any cheaper dates around this?",
        "Other dates?",
        "alternative dates",
        "different dates",
        "Are there nearby dates that are cheaper?",
        "can I fly a day earlier",
        "fly a few days later",
        "earlier or later in the week",
        "any other days?",
        "flexible dates",
        "What about shifting my dates",
        "moving my travel dates",
        "save by shifting around my date",
        "around my dates",
    ],
)
def test_alt_dates_routes_when_verdict_present(msg: str):
    r = classify(msg, has_verdict_context=True)
    assert r.intent == "alt_dates", f"{msg!r} → {r.intent}"
    assert r.needs_verdict is True
    assert r.needs_wallet is True


@pytest.mark.parametrize(
    "msg",
    [
        "any cheaper dates around this?",
        "other dates?",
        "fly a day earlier",
    ],
)
def test_alt_dates_does_not_fire_without_verdict_context(msg: str):
    """Without verdict_context we have no O/D/date — fall through, not alt_dates."""
    r = classify(msg, has_verdict_context=False)
    assert r.intent != "alt_dates"


def test_verdict_strategy_still_fires_for_non_alt_phrases_with_verdict():
    r = classify("is this worth it?", has_verdict_context=True)
    assert r.intent == "verdict_strategy"


def test_off_topic_still_wins_over_alt_dates():
    """Off-topic check happens before alt_dates; weird mixed messages shouldn't
    leak into the award-search handler."""
    r = classify("write me a poem about other dates", has_verdict_context=True)
    assert r.intent == "off_topic"
