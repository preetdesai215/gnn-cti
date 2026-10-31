"""Build a knowledge graph of URL, domain, and IP indicators from URLhaus records.

Node IDs are prefixed by type so a domain and an IP can never collide:
    url:http://evil.example/a.exe
    domain:evil.example
    ip:203.0.113.5

Edges (documented relationships):
    url -> domain/ip   relation="hosted_on"
"""
import ipaddress
from pathlib import Path
from urllib.parse import urlsplit

import networkx as nx
import pandas as pd

from src.config import DATA_PROCESSED, DATA_RAW


def classify_host(host: str) -> str:
    """Return 'ip' for an IP literal, otherwise 'domain'."""
    try:
        ipaddress.ip_address(host)
        return "ip"
    except ValueError:
        return "domain"


def extract_host(url: str):
    """Return (host, kind) for a URL, or (None, None) if no host can be parsed."""
    try:
        host = urlsplit(url).hostname
    except ValueError:
        return None, None
    if not host:
        return None, None
    host = host.lower().rstrip(".")
    return host, classify_host(host)


def build_graph(records: list[dict]) -> nx.DiGraph:
    """Create the graph. Duplicate URLs in the feed are merged into one node."""
    g = nx.DiGraph()
    for rec in records:
        url = rec.get("url", "")
        host, kind = extract_host(url)
        if host is None:
            continue
        url_node = f"url:{url}"
        host_node = f"{kind}:{host}"
        g.add_node(url_node, type="url",
                   threat=rec.get("threat", ""), first_seen=rec.get("first_seen", ""))
        g.add_node(host_node, type=kind)
        g.add_edge(url_node, host_node, relation="hosted_on")
    return g


def export_graph(g: nx.DiGraph, out_dir: Path = DATA_PROCESSED):
    """Write nodes.csv and edges.csv for inspection and for later GNN training."""
    out_dir.mkdir(parents=True, exist_ok=True)
    nodes = pd.DataFrame([{"node_id": n, **d} for n, d in g.nodes(data=True)])
    edges = pd.DataFrame([{"source": u, "target": v, **d} for u, v, d in g.edges(data=True)])
    nodes.to_csv(out_dir / "nodes.csv", index=False)
    edges.to_csv(out_dir / "edges.csv", index=False)
    return nodes, edges


if __name__ == "__main__":
    from src.ingest.urlhaus import parse_feed

    feeds = sorted(DATA_RAW.glob("urlhaus_recent_*.csv"))
    if not feeds:
        raise SystemExit("No feed in data/raw. Run: python -m src.ingest.urlhaus")
    records = parse_feed(feeds[-1])
    g = build_graph(records)
    nodes, edges = export_graph(g)
    print(f"Graph from {feeds[-1].name}: {len(nodes)} nodes, {len(edges)} edges")
