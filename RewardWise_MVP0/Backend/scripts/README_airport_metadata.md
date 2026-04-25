# Airport metadata generation

Zoe should not rely on hand-written airport metadata. This script generates
`app/data/airport_metadata.json` from the public OurAirports CSV dumps and the
same `VALID_AIRPORT_CODES` set used by the backend validator.

## Generate metadata

From `RewardWise_MVP0/Backend`:

```bash
python scripts/build_airport_metadata.py
```

The script downloads:

- `airports.csv`
- `countries.csv`
- `regions.csv`

from OurAirports and writes:

```text
app/data/airport_metadata.json
```

## Offline/local CSV mode

If downloading is blocked, download the CSV files manually and run:

```bash
python scripts/build_airport_metadata.py \
  --airports-csv ./airports.csv \
  --countries-csv ./countries.csv \
  --regions-csv ./regions.csv
```

## Validation

The script fails if the generated JSON does not exactly match the unique code
count from:

```text
app/validators/airport_codes.py
```

It prints:

```text
Validator unique codes
Generated metadata rows
Missing from JSON
Duplicate JSON rows
Extra JSON rows
Fallback rows
```

`fallback_code_only` rows mean the code exists in `VALID_AIRPORT_CODES`, but the
OurAirports dump did not provide matching name/city metadata for that code. The
resolver can still accept the code, but Zoe will not pretend to know a city or
airport name for that fallback row.
