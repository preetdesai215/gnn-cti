"""Diagnose what drives the host-only baseline score.

Prints, on the matched dataset:
  1. The most common TLDs in each class.
  2. Random Forest feature importances for the host-only model.
  3. Host-only scores with individual features removed.

Run: python -m src.evaluation.diagnostics
"""
from pathlib import Path

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import average_precision_score

from src.config import DATA_RAW, TRANCO_CSV
from src.graph.build import extract_host
from src.ingest.tranco import load_top_domains
from src.ingest.urlhaus import parse_feed
from src.models.baseline import POOL_START_RANK, build_dataset, match_benign, train_and_evaluate
from src.models.features import HOST_FEATURE_NAMES


def main() -> None:
    feed = sorted(DATA_RAW.glob("urlhaus_recent_*.csv"))[-1]
    malicious = parse_feed(feed)
    mal_domains = [r for r in malicious if extract_host(r["url"])[1] == "domain"]
    pool = load_top_domains(Path(TRANCO_CSV), limit=1_000_000)[POOL_START_RANK:]
    benign = match_benign(mal_domains, pool)
    df = build_dataset(mal_domains, benign)
    df["tld"] = df["url"].map(lambda u: (extract_host(u)[0] or "").rsplit(".", 1)[-1])

    print("\n=== Top TLDs by class (share of class) ===")
    shares = (df.groupby("label")["tld"].value_counts(normalize=True)
                .rename("share").reset_index())
    for lab in (0, 1):
        print(f"\nlabel={lab} ({'benign' if lab == 0 else 'malicious'})")
        print(shares[shares["label"] == lab].nlargest(8, "share").to_string(index=False))

    train = df[df["split"] == "train"]
    test = df[df["split"] == "test"]
    print("\n=== Feature importances (host-only model) ===")
    clf = RandomForestClassifier(n_estimators=200, class_weight="balanced",
                                 n_jobs=-1, random_state=42)
    clf.fit(train[HOST_FEATURE_NAMES], train["label"])
    imp = pd.Series(clf.feature_importances_, index=HOST_FEATURE_NAMES)
    print(imp.sort_values(ascending=False).round(3).to_string())

    print("\n=== Host-only PR-AUC with one feature removed ===")
    for feat in HOST_FEATURE_NAMES:
        reduced = [f for f in HOST_FEATURE_NAMES if f != feat]
        m = train_and_evaluate(df, reduced)
        print(f"without {feat:<14} PR-AUC = {m['pr_auc']}")


if __name__ == "__main__":
    main()
