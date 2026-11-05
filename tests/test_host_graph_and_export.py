import numpy as np
import pandas as pd
import pytest

from src.export.summary import defang
from src.graph.host_graph import build_host_graph
from src.ingest.dns_resolve import resolve_host, resolve_new


class FakeAnswer:
    def __init__(self, ip):
        self._ip = ip

    def to_text(self):
        return self._ip


class FakeResolver:
    def __init__(self, table):
        self.table = table

    def resolve(self, host, rdtype, lifetime=None):
        if host not in self.table:
            import dns.resolver
            raise dns.resolver.NXDOMAIN()
        return [FakeAnswer(ip) for ip in self.table[host]]


def test_resolve_host_ok_and_nxdomain():
    r = FakeResolver({"a.example.com": ["203.0.113.5"]})
    assert resolve_host("a.example.com", r) == (["203.0.113.5"], "ok")
    assert resolve_host("missing.example.com", r) == ([], "nxdomain")


def test_resolve_new_caches_and_skips_known(tmp_path):
    path = tmp_path / "dns.csv"
    r = FakeResolver({"a.example.com": ["203.0.113.5"]})
    first = resolve_new(["a.example.com", "missing.example.com"], resolver=r, path=path, pause=0)
    second = resolve_new(["a.example.com"], resolver=r, path=path, pause=0)
    assert first["hosts_resolved_now"] == 2
    assert second["hosts_resolved_now"] == 0
    cached = pd.read_csv(path, dtype=str).fillna("")
    assert set(cached["host"]) == {"a.example.com", "missing.example.com"}


def test_host_graph_links_domains_to_shared_ip():
    dns = pd.DataFrame([
        {"host": "one.example.com", "ip": "203.0.113.5", "status": "ok", "resolved_on": ""},
        {"host": "two.example.org", "ip": "203.0.113.5", "status": "ok", "resolved_on": ""},
        {"host": "benign.example.net", "ip": "198.51.100.9", "status": "ok", "resolved_on": ""},
    ])
    nodes, edges = build_host_graph(["one.example.com", "two.example.org"],
                                    ["benign.example.net"], dns)
    assert (nodes["kind"] == "ip").sum() == 2
    assert edges.shape[0] == 2
    # both directions stored, so the graph is undirected
    assert edges.shape[1] == 2 * 3
    labels = dict(zip(nodes["name"], nodes["label"]))
    assert labels["one.example.com"] == 1 and labels["benign.example.net"] == 0


def test_defang_hides_dots():
    assert defang("evil.example.com") == "evil[.]example[.]com"


def test_gnn_module_imports_without_torch():
    import src.models.gnn_experiment as g  # must not import torch at module load
    assert callable(g.train_rf)


def test_gnn_trains_when_torch_installed():
    torch = pytest.importorskip("torch")
    pytest.importorskip("torch_geometric")
    from src.models.gnn_experiment import train_gnn
    feat = np.random.default_rng(0).normal(size=(12, 8))
    edges = np.array([[0, 1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 0]])
    labels = np.array([1, 0, 1, 0, 1, 0, -1, -1, -1, -1, -1, -1])
    train = np.zeros(12, bool); train[:6] = True
    test = np.zeros(12, bool); test[6:] = False; test[0:0] = False
    probs = train_gnn(feat, edges, labels, train, np.isin(np.arange(12), [0, 1]), seed=0)
    assert probs.shape == (2,)
    assert torch is not None
