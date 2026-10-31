"""Download and parse the abuse.ch URLhaus recent malicious URL feed.

Two ways to get data in:
  1. Download automatically:   python -m src.ingest.urlhaus
  2. Use a file you saved yourself (e.g. from your browser):
                               python -m src.ingest.urlhaus path/to/file.csv
"""
import csv
import io
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

from src.config import DATA_RAW, REQUEST_TIMEOUT, URLHAUS_AUTH_KEY, URLHAUS_RECENT_CSV


def download_feed(dest_dir: Path = DATA_RAW) -> Path:
    """Fetch the feed and save it with a UTC timestamp in the filename."""
    if not URLHAUS_RECENT_CSV:
        raise SystemExit(
            "No download URL is set. Set URLHAUS_RECENT_CSV to the current feed link from "
            "https://urlhaus.abuse.ch/api/, or import a saved file: "
            "python -m src.ingest.urlhaus path/to/file.csv"
        )
    dest_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = dest_dir / f"urlhaus_recent_{stamp}.csv"
    headers = {"Auth-Key": URLHAUS_AUTH_KEY} if URLHAUS_AUTH_KEY else {}
    resp = requests.get(URLHAUS_RECENT_CSV, headers=headers, timeout=REQUEST_TIMEOUT)
    if resp.status_code in (401, 403):
        raise SystemExit(
            "URLhaus rejected the request. Create a free account at abuse.ch, copy your "
            "Auth-Key, and set URLHAUS_AUTH_KEY, or save the CSV manually and run: "
            "python -m src.ingest.urlhaus path/to/file.csv"
        )
    if resp.status_code == 410:
        raise SystemExit(
            f"The endpoint {URLHAUS_RECENT_CSV} has been retired (HTTP 410). Find the current "
            "URL at https://urlhaus.abuse.ch/api/ and set URLHAUS_RECENT_CSV, or save the "
            "CSV manually and run: python -m src.ingest.urlhaus path/to/file.csv"
        )
    resp.raise_for_status()
    out.write_bytes(resp.content)
    return out


def import_local_file(path: Path, dest_dir: Path = DATA_RAW) -> Path:
    """Copy a manually downloaded feed into data/raw with the standard name."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = dest_dir / f"urlhaus_recent_{stamp}.csv"
    shutil.copyfile(path, out)
    return out


def parse_feed(path: Path) -> list[dict]:
    """Parse the CSV, skipping comment lines that start with '#'."""
    raw_lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    # URLhaus writes its column header as a comment line: "# id,dateadded,url,..."
    header = next(ln[1:].strip() for ln in raw_lines if ln.startswith("# id,"))
    data = [ln for ln in raw_lines if ln and not ln.startswith("#")]
    reader = csv.DictReader(io.StringIO("\n".join([header] + data)))
    rows = []
    for r in reader:
        rows.append({
            "url": r.get("url", "").strip(),
            "url_status": r.get("url_status", "").strip(),
            "first_seen": r.get("dateadded", "").strip(),
            "threat": r.get("threat", "").strip(),
            "tags": r.get("tags", "").strip(),
        })
    return rows


if __name__ == "__main__":
    if len(sys.argv) > 1:
        path = import_local_file(Path(sys.argv[1]))
    else:
        path = download_feed()
    rows = parse_feed(path)
    print(f"Saved {path} with {len(rows)} records")
