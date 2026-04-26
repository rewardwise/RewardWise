#!/usr/bin/env python3
"""Download helper for public airfare training data.

This script intentionally does not hard-code paid or brittle URLs. It supports:

1. Direct public URLs, such as BTS ZIP/CSV exports you choose from the BTS UI.
2. A small JSON manifest of direct URLs.
3. Kaggle datasets through the official Kaggle CLI when credentials are installed.

Examples:
    python scripts/price_model/00_download_public_data.py \
      --url https://example.com/file.zip --out training/raw/bts/file.zip

    python scripts/price_model/00_download_public_data.py \
      --manifest training/raw/download_manifest.example.json

    python scripts/price_model/00_download_public_data.py \
      --kaggle-dataset dilwong/flightprices --out-dir training/raw/kaggle/flightprices --unzip
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path


def download_url(url: str, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {url}\n  -> {out}")
    with urllib.request.urlopen(url, timeout=120) as response, out.open("wb") as handle:
        shutil.copyfileobj(response, handle)


def run_kaggle_download(dataset: str, out_dir: Path, unzip: bool) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    cmd = ["kaggle", "datasets", "download", "-d", dataset, "-p", str(out_dir)]
    if unzip:
        cmd.append("--unzip")
    print("Running:", " ".join(cmd))
    try:
        subprocess.run(cmd, check=True)
    except FileNotFoundError as exc:
        raise SystemExit(
            "Kaggle CLI is not installed. Install it and add kaggle.json credentials, "
            "or download the dataset manually into training/raw/."
        ) from exc


def run_manifest(path: Path) -> None:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    for item in manifest.get("downloads", []):
        download_url(item["url"], Path(item["out"]))
    for item in manifest.get("kaggle", []):
        run_kaggle_download(item["dataset"], Path(item["out_dir"]), bool(item.get("unzip", True)))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", help="Direct public URL to download")
    parser.add_argument("--out", help="Output file path for --url")
    parser.add_argument("--manifest", help="JSON manifest with downloads/kaggle lists")
    parser.add_argument("--kaggle-dataset", help="Kaggle dataset slug, e.g. dilwong/flightprices")
    parser.add_argument("--out-dir", default="training/raw/kaggle", help="Output directory for Kaggle downloads")
    parser.add_argument("--unzip", action="store_true", help="Unzip Kaggle download")
    args = parser.parse_args()

    if args.manifest:
        run_manifest(Path(args.manifest))
    if args.url:
        if not args.out:
            raise SystemExit("--out is required with --url")
        download_url(args.url, Path(args.out))
    if args.kaggle_dataset:
        run_kaggle_download(args.kaggle_dataset, Path(args.out_dir), args.unzip)
    if not any([args.manifest, args.url, args.kaggle_dataset]):
        parser.print_help(sys.stderr)
        raise SystemExit(2)


if __name__ == "__main__":
    main()
