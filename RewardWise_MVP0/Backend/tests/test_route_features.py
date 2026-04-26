from app.services.price_intelligence.route_features import build_route_features


def test_build_route_features_hub_to_hub():
    features = build_route_features("ewr", "mia", "2026-04-20", "economy", "roundtrip")
    assert features.route_key == "EWR-MIA"
    assert features.reverse_route_key == "MIA-EWR"
    assert features.route_tier == "hub_to_hub"
    assert features.season == "spring"
    assert features.cabin == "economy"
    assert features.trip_type == "roundtrip"
