"""OpenPhish community phishing feed: download, validate, and accumulate into a history.

The feed is a plain text list with one URL per line. Each run adds only URLs not seen before,
keeping the day they were first collected. The history is kept separately from the URLhaus
history, because the two feeds label different things (phishing pages vs malware distribution).

Terms: the OpenPhish community feed is for non-commercial use only (openphish.com/terms.html).

Run:
  python -m src.ingest.phishing               download PHISH_FEED_URL and add new URLs
  python -m src.ingest.phishing FILE.txt      add a saved copy of the feed instead
"""
import csv
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

from src.config import DATA_PROCESSED, DATA_RAW, PHISH_FEED_URL, REQUEST_TIMEOUT

PHISH_HISTORY_PATH = DATA_PROCESSED / "phish_history.csv"
FIELDS = ["url", "collected_on"]


def parse_lines(text: str) -> list[str]:
    """Return the http(s) URLs in a feed text, one per line, without spaces."""
    urls = []
    for line in text.splitlines():
        candidate = line.strip()
        if candidate.startswith(("http://", "https://")) and " " not in candidate:
            urls.append(candidate)
    return urls


def load_history(path: Path = PHISH_HISTORY_PATH) -> list[dict]:
    if not path.exists():
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def add_urls(urls: list[str], collected_on: str, path: Path = PHISH_HISTORY_PATH) -> dict:
    """Append URLs not already in the history. Returns counts for the log."""
    history = load_history(path)
    seen = {r["url"] for r in history}
    new = [u for u in dict.fromkeys(urls) if u not in seen]
    rows = history + [{"url": u, "collected_on": collected_on} for u in new]
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    return {"collected_on": collected_on, "feed_urls": len(urls),
            "new_urls": len(new), "total_urls": len(rows)}


def download_feed(url: str = PHISH_FEED_URL) -> str:
    res = requests.get(url, timeout=REQUEST_TIMEOUT)
    if res.status_code != 200:
        raise SystemExit(f"Phishing feed download failed: HTTP {res.status_code}. History not changed.")
    return res.text


def main(argv: list[str]) -> None:
    today = datetime.now(timezone.utc).date().isoformat()
    if len(argv) > 1:
        source = Path(argv[1])
        text = source.read_text(encoding="utf-8", errors="replace")
        DATA_RAW.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        (DATA_RAW / f"openphish_{stamp}.txt").write_text(text, encoding="utf-8")
    else:
        text = download_feed()
    urls = parse_lines(text)
    if not urls:
        raise SystemExit("No URLs found in the phishing feed. History not changed.")
    print(add_urls(urls, today))


if __name__ == "__main__":
    main(sys.argv)
