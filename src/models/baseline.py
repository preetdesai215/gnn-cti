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
from src.models.features import FEATURE_NAMES, url_features


def build_dataset(malicious: list[dict], benign_domains: list[str],
                  test_fraction: float = 0.2, seed: int = 42) -> pd.DataFrame:
    mal = pd.DataFrame(malicious, columns=["url", "first_seen"])
    mal = mal[mal["url"] != ""].drop_duplicates("url").sort_values("first_seen", kind="stable")
    cut = int(len(mal) * (1 - test_fraction))
    mal = mal.copy()
    mal["split"] = ["train"] * cut + ["test"] * (len(mal) - cut)
    mal["label"] = 1

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
    return pd.concat([df, pd.DataFrame(rows)], axis=1)


def train_and_evaluate(df: pd.DataFrame, seed: int = 42) -> dict:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import average_precision_score, f1_score

    train = df[df["split"] == "train"]
    test = df[df["split"] == "test"]
    clf = RandomForestClassifier(
        n_estimators=200, class_weight="balanced", n_jobs=-1, random_state=seed
    )
    clf.fit(train[FEATURE_NAMES], train["label"])
    proba = clf.predict_proba(test[FEATURE_NAMES])[:, 1]
    pred = (proba >= 0.5).astype(int)
    return {
        "model": "random_forest_url_features",
        "n_train": int(len(train)),
        "n_test": int(len(test)),
        "test_malicious_share": round(float(test["label"].mean()), 4),
        "pr_auc": round(float(average_precision_score(test["label"], proba)), 4),
        "f1_at_0.5": round(float(f1_score(test["label"], pred)), 4),
    }


if __name__ == "__main__":
    feeds = sorted(DATA_RAW.glob("urlhaus_recent_*.csv"))
    if not feeds:
        raise SystemExit("No malicious feed in data/raw. Run the URLhaus import first.")
    if not Path(TRANCO_CSV).exists():
        raise SystemExit(
            f"Benign list not found at {TRANCO_CSV}. Download the Tranco CSV from "
            "https://tranco-list.eu, save it as data/raw/tranco_top.csv, or set TRANCO_CSV."
        )
    malicious = parse_feed(feeds[-1])
    benign = load_top_domains(Path(TRANCO_CSV), limit=len(malicious))
    df = build_dataset(malicious, benign)
    metrics = train_and_evaluate(df)
    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
    (DATA_PROCESSED / "baseline_metrics.json").write_text(json.dumps(metrics, indent=2))
    print(json.dumps(metrics, indent=2))
