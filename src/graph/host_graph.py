"""Host-level graph for the GNN: domain nodes (labelled) joined to IP nodes by DNS A records.

Node features are the same host features used by the baseline, so the GNN and the
Random Forest see identical inputs. The GNN gets the extra information from the IP edges.
"""
import numpy as np
import pandas as pd

from src.models.baseline import registered_domain
from src.models.features import HOST_FEATURE_NAMES, url_features


def build_host_graph(mal_hosts: list[str], benign_hosts: list[str],
                     dns_df: pd.DataFrame) -> tuple[pd.DataFrame, np.ndarray]:
    """Return (nodes table, edges as an array of shape (2, E) of node positions).

    nodes columns: name, kind ('domain' or 'ip'), label (1, 0, or -1 for IPs),
    reg_domain, the host features, and is_ip_node.
    """
    mal = sorted(set(mal_hosts))
    benign = sorted(set(benign_hosts) - set(mal))

    rows = []
    for name, label in [(h, 1) for h in mal] + [(h, 0) for h in benign]:
        f = url_features(f"https://{name}/")
        if f is None:
            continue
        rows.append({"name": name, "kind": "domain", "label": label,
                     "reg_domain": registered_domain(name),
                     **{k: f[k] for k in HOST_FEATURE_NAMES}})

    domain_names = {r["name"] for r in rows}
    pairs = dns_df[(dns_df["ip"] != "") & dns_df["host"].isin(domain_names)][["host", "ip"]]
    pairs = pairs.drop_duplicates()

    for ip in sorted(set(pairs["ip"])):
        f = url_features(f"http://{ip}/")
        if f is None:
            continue
        rows.append({"name": ip, "kind": "ip", "label": -1, "reg_domain": "",
                     **{k: f[k] for k in HOST_FEATURE_NAMES}})

    nodes = pd.DataFrame(rows)
    nodes["is_ip_node"] = (nodes["kind"] == "ip").astype(int)
    position = {name: i for i, name in enumerate(nodes["name"])}
    pairs = pairs[pairs["host"].isin(position) & pairs["ip"].isin(position)]
    src = pairs["host"].map(position).to_numpy(dtype=np.int64)
    dst = pairs["ip"].map(position).to_numpy(dtype=np.int64)
    edges = np.stack([np.concatenate([src, dst]), np.concatenate([dst, src])])
    return nodes, edges
