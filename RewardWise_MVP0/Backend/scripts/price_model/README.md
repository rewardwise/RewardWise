# Zoe Price Baseline Model scripts

This is the offline, no-Supabase training pipeline for Zoe's first price intelligence model.

## v1 goal

Generate a compact SQLite artifact that stores historical cash fare ranges by route/tier/season/cabin. The backend can read this file during live searches and give Zoe a historical price context.

## Quick start with mock data

```bash
cd Backend
python scripts/price_model/05_train_price_baselines.py --input training/raw/mock_historical_fares.csv
python scripts/price_model/06_validate_price_baselines.py
```

## Real data flow

1. Download or place raw data in `training/raw/`.
2. Profile the dataset.
3. Clean it into the common schema.
4. Train/generate `app/data/price_model/route_price_baselines.sqlite`.
5. Validate the artifact.

## Common cleaned schema

```csv
source,origin,destination,fare,departure_date,search_date,cabin,trip_type,distance
```

Required columns are `origin`, `destination`, and `fare`.
