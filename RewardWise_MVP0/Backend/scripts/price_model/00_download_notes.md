# Download notes

## BTS DB1B / DB1C

BTS files can usually be downloaded without an API key from the BTS TranStats / Origin and Destination Survey pages. For the first production-grade run, download one quarter or one month first, place it under `training/raw/bts/`, and run the profiler.

If you have a direct BTS ZIP/CSV URL, use:

```bash
python scripts/price_model/00_download_public_data.py --url "<BTS_URL>" --out training/raw/bts/<file>.zip
```

## Kaggle

Manual browser download works fine. For code download, install the Kaggle CLI and add credentials from Kaggle account settings.

```bash
pip install kaggle
# put kaggle.json in ~/.kaggle/kaggle.json or set KAGGLE_USERNAME/KAGGLE_KEY
python scripts/price_model/00_download_public_data.py --kaggle-dataset dilwong/flightprices --out-dir training/raw/kaggle/flightprices --unzip
```

The Expedia/Kaggle file is large. Start with smaller or sampled data before using the full file.
