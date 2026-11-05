"""Feature-only baseline: Random Forest on per-URL features, no graph structure.

The GNN must beat this model to justify the graph. Malicious rows come from URLhaus;
benign rows come from the Tranco top-sites list.

Split policy:
- Malicious URLs are split by time (oldest 80% train, newest 20% test).
- Benign URLs are split at random with the same fraction, because they have no
  first-seen date. This is a known limitation: the benign side is not temporal.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

from src.config import DATA_PROCESSED, DATA_RAW, TRANCO_CSV
from src.ingest.tranco import load_top_domains
from src.ingest.urlhaus import parse_feed
from src.models.features import FEATURE_NAMES, HOST_FEATURE_NAMES, url_features


_EXTRACTOR = None


def registered_domain(host: str) -> str:
    """Return the registrable domain (e.g. 'evil.co.uk' for 'a.b.evil.co.uk').

    Uses tldextract's bundled public-suffix snapshot, so no network access is needed.
    """
    global _EXTRACTOR
    import tldextract
    if _EXTRACTOR is None:
        _EXTRACTOR = tldextract.TLDExtract(suffix_list_urls=())
    ext = _EXTRACTOR(host)
    return f"{ext.domain}.{ext.suffix}" if ext.suffix else host


def grouped_split(df: pd.DataFrame, test_fraction: float = 0.2, seed: int = 42) -> pd.Series:
    """Assign whole registered domains to train or test, so no family spans both sides.

    Groups are shuffled separately within each class, so both classes contribute about
    test_fraction of their families to the test set. Without this, a few very large
    malicious families can leave almost no malicious rows in test.
    """
    rng = np.random.default_rng(seed)
    test_groups: set = set()
    for label in (0, 1):
        groups = np.array(df.loc[df["label"] == label, "reg_domain"].unique(), dtype=object)
        rng.shuffle(groups)
        n_test = int(len(groups) * test_fraction)
        test_groups.update(groups[:n_test])
    return df["reg_domain"].map(lambda g: "test" if g in test_groups else "train")


def build_dataset(malicious: list[dict], benign_domains: list[str],
                  test_fraction: float = 0.2, seed: int = 42,
                  split_mode: str = "temporal") -> pd.DataFrame:
    """split_mode: 'temporal' (newest malicious rows in test) or 'grouped' (whole
    registered domains held out, so related domains never appear in both sets)."""
    mal = pd.DataFrame(malicious, columns=["url", "first_seen"])
    mal = mal[mal["url"] != ""].drop_duplicates("url").sort_values("first_seen", kind="stable")
    mal = mal.copy()
    mal["label"] = 1
    mal["split"] = ""
    cut = int(len(mal) * (1 - test_fraction))
    mal["split"] = ["train"] * cut + ["test"] * (len(mal) - cut)

    ben = pd.DataFrame({"url": [f"https://{d}/" for d in benign_domains]})
    rng = np.random.default_rng(seed)
    ben["split"] = np.where(rng.random(len(ben)) < test_fraction, "test", "train")
    ben["label"] = 0
    ben["first_seen"] = ""

    df = pd.concat([mal, ben], ignore_index=True)
    rows, keep = [], []
    for i, url in enumerate(df["url"]):
        feats = url_features(url)
        if feats is not None:
            rows.append(feats)
            keep.append(i)
    df = df.iloc[keep].reset_index(drop=True)
    df = pd.concat([df, pd.DataFrame(rows)], axis=1)

    from src.graph.build import extract_host
    df["reg_domain"] = [
        registered_domain(extract_host(u)[0] or "") for u in df["url"]
    ]
    if split_mode == "grouped":
        df["split"] = grouped_split(df, test_fraction, seed)
    elif split_mode != "temporal":
        raise ValueError(f"unknown split_mode: {split_mode}")
    return df


def train_and_evaluate(df: pd.DataFrame, feature_names: list[str] | None = None,
                       seed: int = 42) -> dict:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import average_precision_score, f1_score

    feature_names = feature_names or FEATURE_NAMES
    train = df[df["split"] == "train"]
    test = df[df["split"] == "test"]
    clf = RandomForestClassifier(
        n_estimators=200, class_weight="balanced", n_jobs=-1, random_state=seed
    )
    clf.fit(train[feature_names], train["label"])
    proba = clf.predict_proba(test[feature_names])[:, 1]
    pred = (proba >= 0.5).astype(int)
    return {
        "n_features": len(feature_names),
        "model": "random_forest",
        "n_train": int(len(train)),
        "n_test": int(len(test)),
        "test_malicious_share": round(float(test["label"].mean()), 4),
        "n_test_malicious": int((test["label"] == 1).sum()),
        "n_test_benign": int((test["label"] == 0).sum()),
        "pr_auc": round(float(average_precision_score(test["label"], proba)), 4),
        "f1_at_0.5": round(float(f1_score(test["label"], pred)), 4),
    }


LENGTH_BINS = [0, 8, 12, 16, 20, 25, 1000]
DIGIT_BINS = [-1, 0, 1, 2, 4, 1000]
POOL_START_RANK = 100_000  # benign candidates are drawn from ranks at or below this


def _cells(df: pd.DataFrame) -> list:
    """Bucket each host by (length, digit count) so classes can be matched cell by cell."""
    return list(zip(
        pd.cut(df["host_length"], LENGTH_BINS, labels=False),
        pd.cut(df["host_digits"], DIGIT_BINS, labels=False),
    ))


def match_benign(mal_records: list[dict], pool: list[str], seed: int = 42) -> list[str]:
    """Pick benign domains with the same length/digit mix as the malicious domains.

    For each (length, digit) bucket, sample up to as many benign domains as there are
    malicious ones in that bucket. Buckets with too few candidates are left short.
    """
    rng = np.random.default_rng(seed)
    mal_feats = pd.DataFrame([f for f in (url_features(r["url"]) for r in mal_records) if f])
    mal_feats["cell"] = _cells(mal_feats)

    pool_rows = []
    for d in pool:
        f = url_features(f"https://{d}/")
        if f is not None:
            f["domain"] = d
            pool_rows.append(f)
    pool_feats = pd.DataFrame(pool_rows)
    pool_feats["cell"] = _cells(pool_feats)

    chosen: list[str] = []
    for cell, n in mal_feats["cell"].value_counts().items():
        candidates = pool_feats.loc[pool_feats["cell"] == cell, "domain"].tolist()
        take = min(int(n), len(candidates))
        if take:
            chosen += [str(x) for x in rng.choice(candidates, size=take, replace=False)]
    return chosen


if __name__ == "__main__":
    from src.graph.build import extract_host

    feeds = sorted(DATA_RAW.glob("urlhaus_recent_*.csv"))
    if not feeds:
        raise SystemExit("No malicious feed in data/raw. Run the URLhaus import first.")
    if not Path(TRANCO_CSV).exists():
        raise SystemExit(
            f"Benign list not found at {TRANCO_CSV}. Download the Tranco CSV from "
            "https://tranco-list.eu, save it as data/raw/tranco_top.csv, or set TRANCO_CSV."
        )
    malicious = parse_feed(feeds[-1])
    # Drop IP-address hosts: benign hosts are never IPs, so they are a free shortcut.
    mal_domains = [r for r in malicious if extract_host(r["url"])[1] == "domain"]
    ip_excluded = len(malicious) - len(mal_domains)

    # Benign candidates come from lower-ranked (less famous) sites, matched to the
    # malicious hosts on length and digit-count buckets.
    pool = load_top_domains(Path(TRANCO_CSV), limit=1_000_000)[POOL_START_RANK:]
    benign = match_benign(mal_domains, pool)
    from src.graph.build import extract_host as _host

    mal_reg = {registered_domain(_host(r["url"])[0] or "") for r in mal_domains}

    # Main result: host-only features, grouped split, repeated over several seeds.
    # Full URL features are excluded here because the path shortcut inflates them.
    N_SEEDS = 10
    per_seed = []
    for seed in range(N_SEEDS):
        df_g = build_dataset(mal_domains, benign, split_mode="grouped", seed=seed)
        m = train_and_evaluate(df_g, HOST_FEATURE_NAMES, seed=seed)
        per_seed.append({"seed": seed, "pr_auc": m["pr_auc"], "f1_at_0.5": m["f1_at_0.5"],
                         "n_test_malicious": m["n_test_malicious"]})

    def _summary(key: str) -> dict:
        vals = np.array([r[key] for r in per_seed], dtype=float)
        return {"mean": round(float(vals.mean()), 4), "std": round(float(vals.std()), 4),
                "min": round(float(vals.min()), 4), "max": round(float(vals.max()), 4)}

    df_t = build_dataset(mal_domains, benign, split_mode="temporal")
    temporal_ref = train_and_evaluate(df_t, HOST_FEATURE_NAMES)

    results = {
        "setup": {
            "malicious_domain_hosts": len(mal_domains),
            "distinct_malicious_registered_domains": len(mal_reg),
            "ip_hosts_excluded": ip_excluded,
            "benign_matched": len(benign),
            "benign_pool_start_rank": POOL_START_RANK,
            "grouped_split_seeds": N_SEEDS,
        },
        "main_result_host_only_grouped": {
            "pr_auc": _summary("pr_auc"),
            "f1_at_0.5": _summary("f1_at_0.5"),
            "n_test_malicious": _summary("n_test_malicious"),
            "per_seed": per_seed,
        },
        "reference_host_only_temporal_single_run": temporal_ref,
    }
    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
    (DATA_PROCESSED / "baseline_metrics.json").write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))
