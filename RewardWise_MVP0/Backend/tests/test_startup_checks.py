"""Fail-fast boot assertions: a broken flexible_transfers.json must abort
boot with an explicit error — never start serving reachability-blind
verdicts (the ownership._flex_data soft-fail blast radius)."""
import json

import pytest

from app.startup_checks import (
    REQUIRED_FLEX_CURRENCIES,
    StartupCheckError,
    run_startup_checks,
    validate_flexible_transfers,
)


def _valid_payload():
    return {
        "currencies": [
            {"currency_id": cid, "currency_display": cid, "partners": [{"partner_id": "x"}]}
            for cid in REQUIRED_FLEX_CURRENCIES
        ]
    }


def _write(tmp_path, payload):
    p = tmp_path / "flex.json"
    p.write_text(payload if isinstance(payload, str) else json.dumps(payload))
    return str(p)


def test_real_repo_file_passes_the_boot_check():
    # The committed file must always boot — this is the every-environment
    # guarantee (local/CI/Render all ship the same artifact).
    run_startup_checks()


def test_missing_file_aborts_boot():
    with pytest.raises(StartupCheckError, match="MISSING"):
        validate_flexible_transfers("/nonexistent/flex.json")


def test_malformed_json_aborts_boot(tmp_path):
    with pytest.raises(StartupCheckError, match="UNREADABLE|INVALID"):
        validate_flexible_transfers(_write(tmp_path, "{not json"))


def test_empty_currency_table_aborts_boot(tmp_path):
    with pytest.raises(StartupCheckError, match="NO currencies"):
        validate_flexible_transfers(_write(tmp_path, {"currencies": []}))


def test_missing_required_currency_aborts_boot(tmp_path):
    payload = _valid_payload()
    payload["currencies"] = [c for c in payload["currencies"] if c["currency_id"] != "amex_membership_rewards"]
    with pytest.raises(StartupCheckError, match="amex_membership_rewards"):
        validate_flexible_transfers(_write(tmp_path, payload))


def test_empty_partner_list_aborts_boot(tmp_path):
    payload = _valid_payload()
    payload["currencies"][0]["partners"] = []
    with pytest.raises(StartupCheckError, match="EMPTY partner lists"):
        validate_flexible_transfers(_write(tmp_path, payload))


def test_valid_payload_boots(tmp_path):
    validate_flexible_transfers(_write(tmp_path, _valid_payload()))
