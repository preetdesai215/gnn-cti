"""Download and parse the abuse.ch URLhaus recent malicious URL feed."""
import csv
import io
from datetime import datetime, timezone
from pathlib import Path

import requests

from src.config import DATA_RAW, REQUEST_TIMEOUT, URLHAUS_RECENT_CSV


def download_feed(dest_dir: Path = DATA_RAW) -> Path:
    """Fetch the feed and save it with a UTC timestamp in the filename."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = dest_dir / f"urlhaus_recent_{stamp}.csv"
    resp = requests.get(URLHAUS_RECENT_CSV, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    out.write_bytes(resp.content)
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
    path = download_feed()
    rows = parse_feed(path)
    print(f"Saved {path} with {len(rows)} records")
