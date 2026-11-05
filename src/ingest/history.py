"""Accumulate URLhaus snapshots into one deduplicated history file.

Each run adds only URLs not seen before. Existing rows keep their original first_seen date
(when URLhaus first listed the URL), so later analysis can use real time order.

Daily use (after saving today's CSV):
  python -m src.ingest.history path/to/urlhaus_recent.csv
"""
import csv
import sys
from datetime import datetime, timezone
from pathlib import Path

from src.config import DATA_PROCESSED
from src.ingest.urlhaus import import_local_file, parse_feed

HISTORY_PATH = DATA_PROCESSED / "urlhaus_history.csv"
FIELDS = ["url", "first_seen", "threat", "tags", "collected_on"]


def load_history(path: Path = HISTORY_PATH) -> list[dict]:
    if not path.exists():
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def merge_snapshot(history: list[dict], snapshot: list[dict],
                   collected_on: str) -> tuple[list[dict], int]:
    """Append snapshot rows whose URL is not in history. Returns (merged rows, new count)."""
    seen = {r["url"] for r in history}
    merged = list(history)
    new = 0
    for r in snapshot:
        url = r.get("url", "")
        if not url or url in seen:
            continue
        seen.add(url)
        new += 1
        merged.append({
            "url": url,
            "first_seen": r.get("first_seen", ""),
            "threat": r.get("threat", ""),
            "tags": r.get("tags", ""),
            "collected_on": collected_on,
        })
    return merged, new


def save_history(rows: list[dict], path: Path = HISTORY_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def add_feed(feed_path: Path, path: Path = HISTORY_PATH) -> dict:
    today = datetime.now(timezone.utc).date().isoformat()
    snapshot = parse_feed(feed_path)
    merged, new = merge_snapshot(load_history(path), snapshot, today)
    save_history(merged, path)
    return {
        "collected_on": today,
        "snapshot_rows": len(snapshot),
        "new_urls": new,
        "total_urls_in_history": len(merged),
        "history_file": str(path),
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python -m src.ingest.history path/to/urlhaus_recent.csv")
    saved = import_local_file(Path(sys.argv[1]))  # keeps a timestamped archive copy in data/raw
    print(add_feed(saved))
