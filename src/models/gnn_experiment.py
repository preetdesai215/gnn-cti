"""GNN experiment on the host graph, compared with a Random Forest and a GNN without edges.

All models see the same domain nodes, the same grouped train/test split per seed, and the
same host features. The GNN also uses IP nodes and DNS edges. Both classes are resolved with
the same DNS procedure, so DNS coverage cannot reveal the label.

Needs PyTorch and PyTorch Geometric (see README). Run: python -m src.models.gnn_experiment
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import average_precision_score, f1_score

from src.config import DATA_PROCESSED, TRANCO_CSV
from src.graph.build import extract_host
from src.graph.host_graph import build_host_graph
from src.ingest.dns_resolve import load_cache, resolve_new
from src.ingest.history import load_history
from src.ingest.tranco import load_top_domains
from src.models.baseline import POOL_START_RANK, cap_per_domain, grouped_split, match_benign
from src.models.features import HOST_FEATURE_NAMES
from src.models.run_eval import split_platform

N_SEEDS = 10
EPOCHS = 200
HIDDEN = 32
LEARNING_RATE = 0.01
PER_DOMAIN_CAP = 200


def _make_model(in_dim: int, hidden: int):
    import torch
    from torch_geometric.nn import SAGEConv

    class SAGE(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.c1 = SAGEConv(in_dim, hidden)
            self.c2 = SAGEConv(hidden, hidden)
            self.head = torch.nn.Linear(hidden, 1)

        def forward(self, x, edge_index):
            h = torch.relu(self.c1(x, edge_index))
            h = torch.nn.functional.dropout(h, 0.2, self.training)
            h = torch.relu(self.c2(h, edge_index))
            return self.head(h).squeeze(-1)

    return SAGE()


def train_gnn(feat: np.ndarray, edges: np.ndarray, labels: np.ndarray,
              train_mask: np.ndarray, test_mask: np.ndarray, seed: int) -> np.ndarray:
    """Train on labelled training nodes, return predicted probabilities for test nodes.

    Fixed number of epochs and no tuning on the test set. Test labels are never used.
    """
    import torch

    torch.manual_seed(seed)
    mu = feat[train_mask].mean(axis=0)
    sd = feat[train_mask].std(axis=0) + 1e-9
    x = torch.tensor((feat - mu) / sd, dtype=torch.float)
    ei = torch.tensor(edges, dtype=torch.long)
    y = torch.tensor(np.clip(labels, 0, 1), dtype=torch.float)
    tr = torch.tensor(train_mask)
    te = torch.tensor(test_mask)

    model = _make_model(x.shape[1], HIDDEN)
    opt = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE, weight_decay=5e-4)
    pos = float(y[tr].sum())
    neg = float(tr.sum()) - pos
    loss_fn = torch.nn.BCEWithLogitsLoss(pos_weight=torch.tensor(neg / max(pos, 1.0)))

    for _ in range(EPOCHS):
        model.train()
        opt.zero_grad()
        loss = loss_fn(model(x, ei)[tr], y[tr])
        loss.backward()
        opt.step()

    model.eval()
    with torch.no_grad():
        return torch.sigmoid(model(x, ei))[te].numpy()


def train_rf(feat: np.ndarray, labels: np.ndarray, train_mask: np.ndarray,
             test_mask: np.ndarray, seed: int) -> np.ndarray:
    clf = RandomForestClassifier(n_estimators=200, class_weight="balanced",
                                 n_jobs=-1, random_state=seed)
    clf.fit(feat[train_mask], labels[train_mask])
    return clf.predict_proba(feat[test_mask])[:, 1]


def _summary(values: list[float]) -> dict:
    arr = np.array(values, dtype=float)
    return {"mean": round(float(arr.mean()), 4), "std": round(float(arr.std()), 4),
            "min": round(float(arr.min()), 4), "max": round(float(arr.max()), 4)}


def load_inputs(dns_cache: pd.DataFrame | None = None):
    """Return (malicious hosts, benign hosts) after the same cleaning as run_eval.

    dns_cache is not used here; it is accepted so older calls still work.
    """
    rows = load_history()
    domain_rows = [r for r in rows if extract_host(r["url"])[1] == "domain"]
    capped = cap_per_domain(domain_rows, cap=PER_DOMAIN_CAP)
    _, clean = split_platform(capped)
    mal_hosts = sorted({extract_host(r["url"])[0] for r in clean if extract_host(r["url"])[0]})

    pool = load_top_domains(Path(TRANCO_CSV), limit=1_000_000)[POOL_START_RANK:]
    benign_hosts = match_benign(clean, pool)
    return mal_hosts, benign_hosts


def main() -> None:
    if not Path(TRANCO_CSV).exists():
        raise SystemExit("Benign list missing. Save the Tranco CSV as data/raw/tranco_top.csv.")
    if not load_history():
        raise SystemExit("No history yet. Run: python -m src.ingest.history FEED.csv")

    mal_hosts, benign_hosts = load_inputs()

    # Same DNS procedure for both classes (A records only, cached). If only malicious
    # domains were resolved, "has an IP record" would reveal the label.
    dns_info = resolve_new(sorted(set(mal_hosts) | set(benign_hosts)))
    dns_df = load_cache()

    nodes, edges = build_host_graph(mal_hosts, benign_hosts, dns_df)
    feat_cols = HOST_FEATURE_NAMES + ["is_ip_node"]
    feat = nodes[feat_cols].to_numpy(dtype=float)
    labels = nodes["label"].to_numpy()
    domain_nodes = nodes[nodes["kind"] == "domain"]
    no_edges = np.zeros((2, 0), dtype=edges.dtype)

    # Leak check: share of domains with at least one IP edge, per class. Should be similar.
    has_ip = np.zeros(len(nodes), dtype=bool)
    has_ip[edges[0]] = True
    mal_pos = domain_nodes.index[(domain_nodes["label"] == 1).to_numpy()]
    ben_pos = domain_nodes.index[(domain_nodes["label"] == 0).to_numpy()]
    ip_share = {
        "malicious": round(float(has_ip[mal_pos].mean()), 4),
        "benign": round(float(has_ip[ben_pos].mean()), 4),
    }
    if abs(ip_share["malicious"] - ip_share["benign"]) > 0.1:
        print(f"WARNING: IP-edge share differs by class {ip_share}; DNS coverage may leak the label")

    rf_scores, gnn_scores, no_edge_scores, per_seed = [], [], [], []
    for seed in range(N_SEEDS):
        split = grouped_split(domain_nodes, test_fraction=0.2, seed=seed)
        train_mask = np.zeros(len(nodes), dtype=bool)
        test_mask = np.zeros(len(nodes), dtype=bool)
        train_mask[domain_nodes.index[(split == "train").to_numpy()]] = True
        test_mask[domain_nodes.index[(split == "test").to_numpy()]] = True
        y_test = labels[test_mask]

        p_rf = train_rf(feat, labels, train_mask, test_mask, seed)
        p_gnn = train_gnn(feat, edges, labels, train_mask, test_mask, seed)
        p_mlp = train_gnn(feat, no_edges, labels, train_mask, test_mask, seed)

        rf_pr = average_precision_score(y_test, p_rf)
        gnn_pr = average_precision_score(y_test, p_gnn)
        mlp_pr = average_precision_score(y_test, p_mlp)
        rf_scores.append(rf_pr)
        gnn_scores.append(gnn_pr)
        no_edge_scores.append(mlp_pr)
        per_seed.append({
            "seed": seed,
            "test_domains": int(test_mask.sum()),
            "test_malicious": int(y_test.sum()),
            "random_forest_pr_auc": round(float(rf_pr), 4),
            "random_forest_f1": round(float(f1_score(y_test, (p_rf >= 0.5).astype(int))), 4),
            "gnn_no_edges_pr_auc": round(float(mlp_pr), 4),
            "gnn_pr_auc": round(float(gnn_pr), 4),
            "gnn_f1": round(float(f1_score(y_test, (p_gnn >= 0.5).astype(int))), 4),
        })

    results = {
        "setup": {
            "domain_nodes": int(len(domain_nodes)),
            "malicious_domains": int((domain_nodes["label"] == 1).sum()),
            "benign_domains": int((domain_nodes["label"] == 0).sum()),
            "ip_nodes": int((nodes["kind"] == "ip").sum()),
            "edges_directed": int(edges.shape[1]),
            "ip_edge_share_by_class": ip_share,
            "dns_resolution": dns_info,
            "epochs": EPOCHS,
            "hidden": HIDDEN,
            "seeds": N_SEEDS,
        },
        "random_forest_host_features": {"pr_auc": _summary(rf_scores)},
        "gnn_no_edges_ablation": {"pr_auc": _summary(no_edge_scores)},
        "gnn_graphsage": {"pr_auc": _summary(gnn_scores)},
        "per_seed": per_seed,
    }
    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
    (DATA_PROCESSED / "gnn_experiment.json").write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
