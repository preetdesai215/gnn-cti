"""Domain-level evaluation with shared-hosting platforms separated out.

Runs the grouped, host-only evaluation twice on the same benign pool:
  A. all malicious URLs (including payloads hosted on shared platforms), for reference
  B. only malicious URLs whose registered domain is not a shared-hosting platform

A URL hosted on GitHub or Discord is not evidence that the platform itself is malicious,
so B is the closer answer to "is this domain malicious?".

Run: python -m src.models.run_eval
"""
import json
from pathlib import Path

import numpy as np

from src.config import DATA_PROCESSED, DATA_RAW, TRANCO_CSV
from src.graph.build import extract_host
from src.ingest.tranco import load_top_domains
from src.ingest.urlhaus import parse_feed
from src.models.baseline import (
    POOL_START_RANK, build_dataset, cap_per_domain, family_report, match_benign,
    registered_domain, train_and_evaluate,
)
from src.models.features import HOST_FEATURE_NAMES

# Registrable domains used as shared hosting. Attackers often serve payloads from these.
SHARED_HOSTING = {
    "github.com", "githubusercontent.com", "gitlab.com", "gitlab.io",
    "discordapp.com", "discordapp.net", "discord.com",
    "workers.dev", "pages.dev", "netlify.app", "herokuapp.com", "glitch.me",
    "google.com", "googleapis.com", "firebaseapp.com", "web.app",
    "dropbox.com", "dropboxusercontent.com", "mediafire.com", "transfer.sh",
    "ngrok.io", "ngrok-free.app", "amazonaws.com", "blogspot.com", "weebly.com", "wixsite.com",
}

N_SEEDS = 10
PER_DOMAIN_CAP = 200


def split_platform(records: list[dict]) -> tuple[list[dict], list[dict]]:
    """Return (platform-hosted records, all other records)."""
    platform, other = [], []
    for r in records:
        reg = registered_domain(extract_host(r["url"])[0] or "")
        (platform if reg in SHARED_HOSTING else other).append(r)
    return platform, other


def _summary(values: list[float]) -> dict:
    arr = np.array(values, dtype=float)
    return {"mean": round(float(arr.mean()), 4), "std": round(float(arr.std()), 4),
            "min": round(float(arr.min()), 4), "max": round(float(arr.max()), 4)}


def evaluate(records: list[dict], pool: list[str]) -> dict:
    """Grouped, host-only evaluation over N_SEEDS splits for one malicious set."""
    benign = match_benign(records, pool)
    per_seed = []
    for seed in range(N_SEEDS):
        df = build_dataset(records, benign, split_mode="grouped", seed=seed)
        m = train_and_evaluate(df, HOST_FEATURE_NAMES, seed=seed)
        fam = family_report(df, HOST_FEATURE_NAMES, seed=seed)
        per_seed.append({
            "seed": seed,
            "pr_auc": m["pr_auc"],
            "f1_at_0.5": m["f1_at_0.5"],
            "n_test_malicious": m["n_test_malicious"],
            "share_families_detected": fam["share_detected"],
            "median_family_recall": fam["median_recall"],
        })
    return {
        "malicious_urls": len(records),
        "benign_urls": len(benign),
        "pr_auc": _summary([r["pr_auc"] for r in per_seed]),
        "f1_at_0.5": _summary([r["f1_at_0.5"] for r in per_seed]),
        "share_families_detected": _summary([r["share_families_detected"] for r in per_seed]),
        "per_seed": per_seed,
    }


def main() -> None:
    feeds = sorted(DATA_RAW.glob("urlhaus_recent_*.csv"))
    if not feeds:
        raise SystemExit("No feed in data/raw. Run the URLhaus import first.")
    if not Path(TRANCO_CSV).exists():
        raise SystemExit("Benign list missing. Save the Tranco CSV as data/raw/tranco_top.csv.")

    # Prefer the accumulated history (all days collected so far); fall back to the latest snapshot.
    from src.ingest.history import HISTORY_PATH, load_history
    if HISTORY_PATH.exists():
        malicious = [{"url": r["url"], "first_seen": r["first_seen"]} for r in load_history()]
        source = str(HISTORY_PATH)
    else:
        malicious = parse_feed(feeds[-1])
        source = feeds[-1].name
    domain_level = [r for r in malicious if extract_host(r["url"])[1] == "domain"]
    capped = cap_per_domain(domain_level, cap=PER_DOMAIN_CAP)
    platform, clean = split_platform(capped)
    pool = load_top_domains(Path(TRANCO_CSV), limit=1_000_000)[POOL_START_RANK:]

    strip = lambda rows: [{"url": r["url"], "first_seen": r["first_seen"]} for r in rows]
    results = {
        "setup": {
            "feed": source,
            "domain_hosted_urls_before_cap": len(domain_level),
            "after_cap": len(capped),
            "shared_hosting_urls_removed": len(platform),
            "remaining_urls": len(clean),
            "shared_hosting_domains": len(SHARED_HOSTING),
            "grouped_split_seeds": N_SEEDS,
            "cap_per_registered_domain": PER_DOMAIN_CAP,
        },
        "A_all_malicious_including_platforms": evaluate(strip(capped), pool),
        "B_excluding_shared_hosting": evaluate(strip(clean), pool),
    }
    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
    (DATA_PROCESSED / "platform_comparison.json").write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
