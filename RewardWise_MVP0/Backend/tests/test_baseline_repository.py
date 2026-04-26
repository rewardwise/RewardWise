from pathlib import Path

from app.services.price_intelligence.baseline_repository import BaselineRepository
from app.services.price_intelligence.route_features import build_route_features


def test_repository_finds_generated_mock_artifact():
    db_path = Path("app/data/price_model/route_price_baselines.sqlite")
    assert db_path.exists()
    repo = BaselineRepository(db_path)
    features = build_route_features("EWR", "MIA", "2026-04-20", "economy", "roundtrip")
    match = repo.get_best_baseline(features)
    assert match.has_baseline is True
    assert match.match_level in {"exact_route", "reverse_route", "region_pair", "distance_band"}
    assert match.median_cash_price is not None
