import pytest

from app.services.pricing_service import get_cash_price


@pytest.mark.asyncio
async def test_cash_price_mode_mock_uses_serpapi_fixture_by_default(monkeypatch):
    # SerpAPI is the sole provider post-rip-out — mock mode always serves the
    # serpapi fixture, even if a stale CASH_PRICE_PROVIDER env lingers.
    monkeypatch.setenv("CASH_PRICE_MODE", "mock")
    monkeypatch.setenv("CASH_PRICE_PROVIDER", "flightapi")  # stale env ignored
    monkeypatch.delenv("MOCK_CASH_PRICE_PROVIDER", raising=False)

    result = await get_cash_price("EWR", "LAX", "2026-06-15", "economy", 1)

    assert result["source"] == "serpapi_mock"
    assert result["cash_price"] is not None
    assert result["mock_request"]["provider"] == "serpapi"


@pytest.mark.asyncio
async def test_cash_price_mode_mock_can_use_serpapi_fixture(monkeypatch):
    monkeypatch.setenv("CASH_PRICE_MODE", "mock")
    monkeypatch.setenv("MOCK_CASH_PRICE_PROVIDER", "serpapi")

    result = await get_cash_price("EWR", "LAX", "2026-06-15", "economy", 1)

    assert result["source"] == "serpapi_mock"
    assert result["cash_price"] == 99
    assert result["mock_request"]["provider"] == "serpapi"


@pytest.mark.asyncio
async def test_cash_price_use_mocks_env_overrides_live_provider(monkeypatch):
    monkeypatch.setenv("CASH_PRICE_USE_MOCKS", "true")
    monkeypatch.setenv("CASH_PRICE_PROVIDER", "serpapi")
    monkeypatch.delenv("MOCK_CASH_PRICE_PROVIDER", raising=False)

    result = await get_cash_price("EWR", "LAX", "2026-06-15", "economy", 1, "2026-06-22")

    assert result["source"] == "serpapi_mock"
    assert result["cash_price"] == 198
    assert result["is_roundtrip"] is True
