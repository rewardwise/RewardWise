# Zoe Price Baseline Model v1 Handoff

## What this adds

This implementation adds a no-Supabase, offline baseline model pipeline for Zoe Price Intelligence.

It generates a compact SQLite artifact:

```txt
Backend/app/data/price_model/route_price_baselines.sqlite
```

The backend can read that artifact during live searches and attach `historical_price_context` to the search response and verdict payload.

## What this is not yet

This is not a black-box ML prediction model and does not predict exact future ticket prices. It is an explainable baseline model that labels live cash prices as:

```txt
cheap
normal
high
unusually_high
unknown
```

based on historical route/tier/season/cabin fare percentiles.

## Files added

```txt
Backend/training/raw/mock_historical_fares.csv
Backend/training/raw/download_manifest.example.json
Backend/training/external/airport_tiers.us.json

Backend/scripts/price_model/00_download_public_data.py
Backend/scripts/price_model/01_profile_dataset.py
Backend/scripts/price_model/02_clean_bts_db1b.py
Backend/scripts/price_model/03_clean_expedia_prices.py
Backend/scripts/price_model/04_build_airport_tiers.py
Backend/scripts/price_model/05_train_price_baselines.py
Backend/scripts/price_model/06_validate_price_baselines.py
Backend/scripts/price_model/_common.py

Backend/app/data/price_model/route_price_baselines.sqlite
Backend/app/data/price_model/route_price_model_metadata.json

Backend/app/services/price_intelligence/route_features.py
Backend/app/services/price_intelligence/baseline_repository.py
Backend/app/services/price_intelligence/trend_scorer.py
Backend/app/services/price_intelligence/price_context.py

Backend/tests/test_route_features.py
Backend/tests/test_trend_scorer.py
Backend/tests/test_baseline_repository.py
Backend/tests/test_price_context.py
```

## Files changed

```txt
Backend/app/api/search.py
Backend/app/services/verdict_service.py
```

## How to run with mock data

```bash
cd Backend
python scripts/price_model/05_train_price_baselines.py --input training/raw/mock_historical_fares.csv --min-sample-size 3
python scripts/price_model/06_validate_price_baselines.py
```

## How to use real data later

1. Put a raw historical fare CSV/ZIP under `training/raw/`.
2. Run `01_profile_dataset.py` to inspect columns.
3. Use a cleaner:
   - `02_clean_bts_db1b.py` for BTS-style exports.
   - `03_clean_expedia_prices.py` for Kaggle Expedia Flight Prices.
4. Train with the cleaned CSV:

```bash
python scripts/price_model/05_train_price_baselines.py --input training/processed/<cleaned_file>.csv --min-sample-size 10
```

Use a higher min sample size for real data. The mock artifact uses 3 only so local smoke tests have enough rows.

## Backend behavior

`/api/search` now attempts to build historical price context after cash pricing is fetched:

```txt
live cash price
→ route features
→ baseline lookup
→ trend score
→ historical_price_context
→ verdict_service
```

If the artifact is missing or no match exists, search safely falls back without historical wording.

## Data sources supported by code

- Direct public URLs through `00_download_public_data.py --url`.
- Manifest-driven direct downloads.
- Kaggle CLI downloads if the developer has Kaggle credentials installed.
- Manual downloads placed in `training/raw/`.

## Next recommended step

Replace the mock CSV with a real BTS or Kaggle U.S. fare file, generate a real baseline artifact, and review the validation output before merging into production.
