"""Tests for V1 loyalty data tables (co-brand / flexible / hotel transfer matrices).

Data lives in app/data/loyalty/*.json and is consumed by the wallet-aware verdict
engine. Tests assert schema integrity, audit-specific accuracy facts, and
referential consistency across the three files.
"""

import json
import re
from pathlib import Path

import pytest

DATA_DIR = Path(__file__).resolve().parents[2] / "app" / "data" / "loyalty"

SNAKE = re.compile(r"^[a-z0-9_]+$")


@pytest.fixture(scope="module")
def co_brand():
    with open(DATA_DIR / "co_brand_cards.json") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def flexible():
    with open(DATA_DIR / "flexible_transfers.json") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def hotels():
    with open(DATA_DIR / "hotel_transfers.json") as f:
        return json.load(f)


def test_loyalty_files_load_and_have_required_top_level_fields(co_brand, flexible, hotels):
    """All three loyalty data files load as JSON and carry their top-level keys."""
    for tbl in (co_brand, flexible, hotels):
        assert "as_of" in tbl
        assert "version" in tbl
    assert "cards" in co_brand
    assert "currencies" in flexible
    assert "programs" in hotels


def test_co_brand_cards_schema_and_counts(co_brand):
    """co_brand_cards.json has 55 cards, all snake_case ids, all required fields, valid status."""
    cards = co_brand["cards"]
    assert len(cards) == 55
    assert sum(1 for c in cards if c["status"] == "active") == 51
    assert sum(1 for c in cards if c["status"] == "discontinued") == 4

    required = {
        "card_id", "issuer", "card_name", "earns_into",
        "earns_into_display", "status", "notes", "source",
    }
    for c in cards:
        assert required <= set(c.keys()), f"card {c.get('card_id')} missing fields"
        assert SNAKE.fullmatch(c["card_id"]), f"non-snake_case card_id: {c['card_id']}"
        assert SNAKE.fullmatch(c["earns_into"]), f"non-snake_case earns_into: {c['earns_into']}"
        assert c["status"] in {"active", "discontinued"}
        assert c["source"], f"card {c['card_id']} missing source citation"

    ids = [c["card_id"] for c in cards]
    assert len(ids) == len(set(ids)), "duplicate card_ids detected"


def test_flexible_transfers_currencies_and_partner_schema(flexible):
    """flexible_transfers.json has 7 currencies, every partner row has required fields, all snake_case."""
    currencies = flexible["currencies"]
    assert len(currencies) == 7
    expected_currency_ids = {
        "chase_ultimate_rewards", "amex_membership_rewards", "citi_thankyou",
        "capital_one_miles", "bilt_rewards", "wells_fargo_rewards",
        "bank_of_america_premium_rewards",
    }
    assert {c["currency_id"] for c in currencies} == expected_currency_ids

    required_partner = {
        "partner_id", "partner_display", "ratio_from", "ratio_to",
        "min_transfer", "speed", "type", "status", "notes", "source",
    }
    for cur in currencies:
        assert SNAKE.fullmatch(cur["currency_id"])
        assert isinstance(cur["card_tier_dependent"], bool)
        partner_ids_in_currency = set()
        for p in cur["partners"]:
            assert required_partner <= set(p.keys()), f"{cur['currency_id']}/{p.get('partner_id')} missing fields"
            assert SNAKE.fullmatch(p["partner_id"]), f"non-snake partner_id: {p['partner_id']}"
            assert p["type"] in {"airline", "hotel"}
            assert p["ratio_from"] > 0 and p["ratio_to"] > 0
            assert p["source"], f"{cur['currency_id']}/{p['partner_id']} missing source"
            assert p["partner_id"] not in partner_ids_in_currency, \
                f"duplicate partner {p['partner_id']} within {cur['currency_id']}"
            partner_ids_in_currency.add(p["partner_id"])


def test_marriott_united_bonus_correct(hotels):
    """Audit Section 2 correction: Marriott -> United bonus is 10,000 per 60,000, not 5,000."""
    marriott = next(p for p in hotels["programs"] if p["program_id"] == "marriott_bonvoy")
    united = next(p for p in marriott["partners"] if p["partner_id"] == "united_mileageplus")
    assert united["bonus"] is not None
    assert "10,000" in united["bonus"] or "10000" in united["bonus"], \
        f"Marriott->United bonus must reference 10k; got {united['bonus']!r}"
    assert united["ratio_from"] == 3 and united["ratio_to"] == 1


def test_amex_emirates_ratio_correct(flexible):
    """Audit Section 2: Amex MR -> Emirates is 5:4 (devaluation from 1:1), not 1:1."""
    amex = next(c for c in flexible["currencies"] if c["currency_id"] == "amex_membership_rewards")
    emirates = next(p for p in amex["partners"] if p["partner_id"] == "emirates_skywards")
    assert emirates["ratio_from"] == 5 and emirates["ratio_to"] == 4, \
        f"Amex MR->Emirates must be 5:4; got {emirates['ratio_from']}:{emirates['ratio_to']}"


def test_bofa_premium_rewards_has_no_partners(flexible):
    """Audit Section 1: BofA Premium Rewards is NOT a flex transfer currency; partners array is empty."""
    bofa = next(c for c in flexible["currencies"] if c["currency_id"] == "bank_of_america_premium_rewards")
    assert bofa["partners"] == [], "BofA Premium Rewards must have zero partners (cash-redemption only)"


def test_hyatt_and_ihg_are_effectively_unusable(hotels):
    """World of Hyatt and IHG One Rewards both carry value_assessment='effectively_unusable'."""
    for program_id in ("world_of_hyatt", "ihg_one_rewards"):
        prog = next(p for p in hotels["programs"] if p["program_id"] == program_id)
        assert prog["value_assessment"] == "effectively_unusable", \
            f"{program_id} must be value_assessment='effectively_unusable'; got {prog['value_assessment']!r}"


def test_referential_integrity_across_files(co_brand, flexible, hotels):
    """Cross-file ID consistency: co-brand earns_into targets and Marriott airline partners
    use the same snake_case IDs as flexible_transfers partner_ids where they overlap."""
    cb_ids = {c["earns_into"] for c in co_brand["cards"]}
    fl_currency_ids = {c["currency_id"] for c in flexible["currencies"]}
    fl_partner_ids = {p["partner_id"] for c in flexible["currencies"] for p in c["partners"]}
    fl_pool = fl_currency_ids | fl_partner_ids
    hot_program_ids = {p["program_id"] for p in hotels["programs"]}
    hot_partner_ids = {p["partner_id"] for prog in hotels["programs"] for p in prog["partners"]}
    hot_pool = hot_program_ids | hot_partner_ids

    # Co-brand cards earning Hilton/Marriott/IHG points must point at the hotel program ids
    hotel_earn_targets = {"marriott_bonvoy", "hilton_honors", "ihg_one_rewards"}
    cb_hotel_targets = cb_ids & hotel_earn_targets
    assert cb_hotel_targets <= hot_program_ids, \
        f"co-brand hotel earn targets {cb_hotel_targets} missing from hotel programs"

    # Anchor programs that should resolve across all 3 files
    expected_in_all_three = {
        "aa_aadvantage", "delta_skymiles", "united_mileageplus",
        "british_airways_avios", "flying_blue", "jetblue_trueblue",
        "virgin_atlantic_flying_club",
    }
    actual_in_all_three = cb_ids & fl_pool & hot_pool
    missing = expected_in_all_three - actual_in_all_three
    assert not missing, f"expected programs missing from 3-way join surface: {missing}"
