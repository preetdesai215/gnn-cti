"""Write a summary file for the web dashboard.

Contains counts, evaluation results, and defanged domain names only. Raw malicious URLs
are never written here. Defanged means 'example.com' is written as 'example[.]com'.

Run: python -m src.export.summary
"""
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from src.config import DATA_PROCESSED, ROOT
from src.graph.build import extract_host
from src.ingest.history import load_history

OUT = ROOT / "web" / "public" / "data" / "latest.json"


def defang(host: str) -> str:
    return host.replace(".", "[.]")


def _read_json(path: Path):
    return json.loads(path.read_text()) if path.exists() else None


def build_summary(top_n: int = 20) -> dict:
    rows = load_history()
    hosts = pd.Series([extract_host(r["url"])[0] or "" for r in rows], dtype=object)
    counts = hosts[hosts != ""].value_counts().head(top_n)
    collected = {r["collected_on"] for r in rows if r.get("collected_on")}
    return {
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "data_source": "URLhaus public feed, accumulated history",
        "simulated": False,
        "history": {
            "urls": len(rows),
            "collection_days": len(collected),
            "first_collected": min(collected) if collected else None,
            "last_collected": max(collected) if collected else None,
        },
        "top_hosts_defanged": [{"host": defang(h), "urls": int(n)} for h, n in counts.items()],
        "platform_comparison": _read_json(DATA_PROCESSED / "platform_comparison.json"),
        "gnn_experiment": _read_json(DATA_PROCESSED / "gnn_experiment.json"),
    }


def main() -> None:
    summary = build_summary()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(summary, indent=2))
    print(f"wrote {OUT} ({summary['history']['urls']} URLs in history)")


if __name__ == "__main__":
    main()
