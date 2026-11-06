"""Phishing evaluation: host-only Random Forest on OpenPhish URLs against popular sites.

Same protocol as the URLhaus baseline:
- IP-address hosts are dropped, because benign hosts are never IPs (a free shortcut)
- at most 200 URLs per registered domain, so one campaign cannot dominate
- benign hosts are popular sites matched to the phishing hosts on length and digit buckets
- host-only features (no URL path), grouped split by registered domain, repeated over 10 seeds
- headline result excludes URLs on free hosting platforms: a page on a free host says
  little about the host itself. The reference result includes them.

Run: python -m src.models.phish_eval
"""
import json
from pathlib import Path

import numpy as np

from src.config import DATA_PROCESSED, TRANCO_CSV
from src.graph.build import extract_host
from src.ingest.phishing import PHISH_HISTORY_PATH, load_history
from src.ingest.tranco import load_top_domains
from src.models.baseline import (
    POOL_START_RANK, build_dataset, cap_per_domain, family_report, match_benign,
    registered_domain, train_and_evaluate,
)
from src.models.features import HOST_FEATURE_NAMES
from src.models.run_eval import SHARED_HOSTING

# Free hosting and tunnel platforms that phishing pages often use, on top of the URLhaus list
PHISH_PLATFORMS = SHARED_HOSTING | {
    "vercel.app", "myshopify.com", "r2.dev", "duckdns.org", "000webhostapp.com",
    "azurewebsites.net", "cloudfront.net", "onrender.com", "fly.dev", "replit.dev",
    "typeform.com", "gitbook.io", "godaddysites.com", "carrd.co", "framer.app", "notion.site",
}
N_SEEDS = 10
PER_DOMAIN_CAP = 200
MIN_HOSTS = 50  # below this, the grouped test sets are too small to report


def split_platform(records: list[dict], platforms: set[str] = PHISH_PLATFORMS) -> tuple[list[dict], list[dict]]:
    """Return (records on free hosting platforms, all other records)."""
    platform, other = [], []
    for r in records:
        reg = registered_domain(extract_host(r["url"])[0] or "")
        (platform if reg in platforms else other).append(r)
    return platform, other


def _summary(values: list[float]) -> dict:
    arr = np.array(values, dtype=float)
    return {"mean": round(float(arr.mean()), 4), "std": round(float(arr.std()), 4),
            "min": round(float(arr.min()), 4), "max": round(float(arr.max()), 4)}


def evaluate(records: list[dict], pool: list[str]) -> dict:
    """Grouped, host-only evaluation over N_SEEDS splits. Returns a note if there is no data."""
    if not records:
        return {"malicious_urls": 0, "note": "no phishing URLs left after the exclusions"}
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
        })
    return {
        "malicious_urls": len(records),
        "benign_hosts": len(benign),
        "pr_auc": _summary([r["pr_auc"] for r in per_seed]),
        "f1_at_0.5": _summary([r["f1_at_0.5"] for r in per_seed]),
        "share_families_detected": _summary(
            [r["share_families_detected"] for r in per_seed if r["share_families_detected"] is not None]
            or [0.0]),
        "per_seed": per_seed,
    }


def main() -> None:
    if not Path(TRANCO_CSV).exists():
        raise SystemExit("Benign list missing. Save the Tranco CSV as data/raw/tranco_top.csv.")
    rows = load_history(PHISH_HISTORY_PATH)
    if not rows:
        raise SystemExit("No phishing history yet. Run: python -m src.ingest.phishing")

    records = [{"url": r["url"], "first_seen": r["collected_on"]} for r in rows]
    domain_level = [r for r in records if extract_host(r["url"])[1] == "domain"]
    capped = cap_per_domain(domain_level, cap=PER_DOMAIN_CAP)
    platform, clean = split_platform(capped)
    clean_hosts = len({extract_host(r["url"])[0] for r in clean})
    pool = load_top_domains(Path(TRANCO_CSV), limit=1_000_000)[POOL_START_RANK:]

    results = {
        "setup": {
            "phishing_urls_in_history": len(records),
            "ip_hosts_excluded": len(records) - len(domain_level),
            "after_cap": len(capped),
            "free_hosting_urls_excluded_from_headline": len(platform),
            "hosts_in_headline": clean_hosts,
            "platform_domains": len(PHISH_PLATFORMS),
            "cap_per_registered_domain": PER_DOMAIN_CAP,
            "grouped_split_seeds": N_SEEDS,
            "warning": None if clean_hosts >= MIN_HOSTS else
                f"Only {clean_hosts} phishing hosts after exclusions. Keep collecting before reading these numbers.",
        },
        "headline_excluding_free_hosting": evaluate(clean, pool),
        "reference_including_free_hosting": evaluate(capped, pool),
    }
    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
    (DATA_PROCESSED / "phishing_eval.json").write_text(json.dumps(results, indent=2))
    print(json.dumps(results["setup"], indent=2))
    print(json.dumps({k: v for k, v in results.items() if k != "setup"}, indent=2))


if __name__ == "__main__":
    main()
