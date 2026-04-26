from app.services.price_intelligence.price_context import build_price_context


def test_price_context_contains_cash_label():
    context = build_price_context(
        origin="EWR",
        destination="MIA",
        departure_date="2026-04-20",
        cabin="economy",
        trip_type="roundtrip",
        current_cash_price=420,
    )
    assert context["route_key"] == "EWR-MIA"
    assert "cash_price_label" in context
    assert "has_baseline" in context
