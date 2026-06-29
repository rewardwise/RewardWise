"""Tests for _get_user_programs wallet shape (ticket 86ba2ze4e part 1).

After PR #2a, `_get_user_programs` returns a UserWallet TypedDict with two
keys:
- `programs`: post-PROGRAM_ALIASES seats.aero source slugs
- `cards`: raw reward_programs.name brand list

The frontend needs both — `programs` for award-source filtering, `cards` for
wallet-reachability checks against TRANSFER_PARTNERS[slug].sourceCard which
is a brand string, not a slug.
"""

from unittest.mock import MagicMock

from app.api.search import _get_user_programs


def _supabase_returning(rows):
    """Build a MagicMock chain that simulates supabase.from_().select().eq().execute()."""
    mock_supabase = MagicMock()
    execute_result = MagicMock()
    execute_result.data = rows
    (
        mock_supabase
        .from_.return_value
        .select.return_value
        .eq.return_value
        .execute.return_value
    ) = execute_result
    return mock_supabase


def test_wallet_returns_both_keys_for_chase_ur():
    """Chase UR holder gets the expected slug list + raw brand list."""
    mock_supabase = _supabase_returning([
        {"reward_programs": {"name": "Chase Ultimate Rewards"}},
    ])

    wallet = _get_user_programs(mock_supabase, "user-123")

    assert "programs" in wallet
    assert "cards" in wallet
    assert wallet["cards"] == ["Chase Ultimate Rewards"]
    # Chase UR transfers to many partners — spot-check a few
    assert "aeroplan" in wallet["programs"]
    assert "virginatlantic" in wallet["programs"]
    assert "flyingblue" in wallet["programs"]
    # ...but not united (no Chase UR alias for united)
    assert "united" not in wallet["programs"]


def test_wallet_sums_points_balance_by_brand():
    """`balances` carries summed points per brand for the ownership fork."""
    mock_supabase = _supabase_returning([
        {"points_balance": 80000, "reward_programs": {"name": "Chase Ultimate Rewards"}},
        {"points_balance": 5000, "reward_programs": {"name": "Chase Ultimate Rewards"}},
        {"points_balance": 45000, "reward_programs": {"name": "Amex Membership Rewards"}},
    ])

    wallet = _get_user_programs(mock_supabase, "user-123")

    assert wallet["balances"] == {
        "Chase Ultimate Rewards": 85000,  # two cards summed
        "Amex Membership Rewards": 45000,
    }


def test_wallet_balance_missing_defaults_to_zero():
    """A card row without points_balance contributes 0, never crashes."""
    mock_supabase = _supabase_returning([
        {"reward_programs": {"name": "United MileagePlus"}},
    ])

    wallet = _get_user_programs(mock_supabase, "user-123")

    assert wallet["balances"] == {"United MileagePlus": 0}


def test_wallet_returns_united_native_holder():
    """United MileagePlus is a direct-loyalty program (no transferable alias)."""
    mock_supabase = _supabase_returning([
        {"reward_programs": {"name": "United MileagePlus"}},
    ])

    wallet = _get_user_programs(mock_supabase, "user-123")

    assert wallet["cards"] == ["United MileagePlus"]
    assert wallet["programs"] == ["united"]


def test_wallet_returns_multiple_cards_dedup_brand_list():
    """Multi-card wallet returns all brand names + union of redeemable slugs."""
    mock_supabase = _supabase_returning([
        {"reward_programs": {"name": "Chase Ultimate Rewards"}},
        {"reward_programs": {"name": "Amex Membership Rewards"}},
        {"reward_programs": {"name": "United MileagePlus"}},
    ])

    wallet = _get_user_programs(mock_supabase, "user-123")

    assert set(wallet["cards"]) == {
        "Chase Ultimate Rewards",
        "Amex Membership Rewards",
        "United MileagePlus",
    }
    # United comes from native, aeroplan from both Chase + Amex, ana from Amex
    assert "united" in wallet["programs"]
    assert "aeroplan" in wallet["programs"]
    assert "ana" in wallet["programs"]


def test_wallet_returns_empty_on_no_cards():
    """User with no cards yet gets an empty wallet (all keys empty)."""
    mock_supabase = _supabase_returning([])

    wallet = _get_user_programs(mock_supabase, "user-123")

    assert wallet == {"programs": [], "cards": [], "balances": {}}


def test_wallet_returns_empty_on_supabase_error():
    """Any exception from supabase short-circuits to empty wallet (no hard-fail)."""
    mock_supabase = MagicMock()
    mock_supabase.from_.side_effect = RuntimeError("supabase boom")

    wallet = _get_user_programs(mock_supabase, "user-123")

    assert wallet == {"programs": [], "cards": [], "balances": {}}


def test_wallet_skips_rows_without_reward_program():
    """A card row with null reward_programs (orphaned FK) should be skipped silently."""
    mock_supabase = _supabase_returning([
        {"reward_programs": {"name": "Chase Ultimate Rewards"}},
        {"reward_programs": None},
        {},
    ])

    wallet = _get_user_programs(mock_supabase, "user-123")

    assert wallet["cards"] == ["Chase Ultimate Rewards"]
    assert "aeroplan" in wallet["programs"]
