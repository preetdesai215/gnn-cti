from src.graph.build import build_graph, extract_host


def test_extract_host_domain_is_lowercased():
    assert extract_host("http://Evil.Example/a.exe") == ("evil.example", "domain")


def test_extract_host_ip_literal():
    assert extract_host("http://203.0.113.5:8080/x") == ("203.0.113.5", "ip")


def test_extract_host_unparseable():
    assert extract_host("not a url") == (None, None)


def test_build_graph_links_urls_to_hosts():
    recs = [
        {"url": "http://evil.example/a", "threat": "malware_download", "first_seen": "t"},
        {"url": "http://evil.example/b", "threat": "malware_download", "first_seen": "t"},
        {"url": "http://203.0.113.5/c", "threat": "malware_download", "first_seen": "t"},
    ]
    g = build_graph(recs)
    assert g.has_edge("url:http://evil.example/a", "domain:evil.example")
    assert g.has_edge("url:http://203.0.113.5/c", "ip:203.0.113.5")
    assert g.nodes["ip:203.0.113.5"]["type"] == "ip"
    # 3 URL nodes + 1 domain + 1 IP; 3 hosted_on edges
    assert g.number_of_nodes() == 5
    assert g.number_of_edges() == 3
