"""Write the real data files for the web dashboard.

Written to web/public/data/:
  latest.json      counts, daily additions, threat types, top hosts, experiment results
  indicators.json  one record per host in the history, for the lookup page
  graph.json       top domains and the IPs they resolved to, for the graph page
  alerts.json      hosts with new URLs in the last 7 collection days, with a rule-based priority
  reference.json   popularity ranks for the top sites in the Tranco list (defanged)

No raw URLs are written, and hosts are defanged: example.com is written as example[.]com.
Priorities and risk values are fixed rules based on URL counts. They are not model scores.

Run: python -m src.export.summary
"""
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from src.config import DATA_PROCESSED, ROOT, TRANCO_CSV
from src.graph.build import extract_host
from src.ingest.dns_resolve import load_cache
from src.ingest.history import load_history
from src.ingest.phishing import PHISH_HISTORY_PATH, load_history as load_phish_history

DATA_OUT = ROOT / "web" / "public" / "data"
OUT = DATA_OUT / "latest.json"
GRAPH_DOMAINS = 120
ALERT_WINDOW_DAYS = 7
ALERT_LIMIT = 50
TOP_TAGS = 5
TRANCO_TOP_N = 10_000


def defang(host: str) -> str:
    return host.replace(".", "[.]")


def _read_json(path: Path):
    return json.loads(path.read_text()) if path.exists() else None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def priority(urls: int) -> tuple[str, int]:
    """Fixed rule from the number of URLs seen for a host. Not a model score."""
    if urls >= 10:
        return "critical", min(100, 10 * urls)
    if urls >= 5:
        return "high", min(100, 10 * urls)
    if urls >= 2:
        return "medium", min(100, 10 * urls)
    return "low", min(100, 10 * urls)


def build_host_index(rows: list[dict], dns: pd.DataFrame) -> dict[str, dict]:
    """Return {host: stats} for every host in the history, with DNS IPs where resolved."""
    stats: dict[str, dict] = {}
    for r in rows:
        host, kind = extract_host(r.get("url", ""))
        if not host:
            continue
        s = stats.get(host)
        if s is None:
            s = stats[host] = {
                "host": host, "kind": kind, "urls": 0, "first_seen": "", "last_added": "",
                "threats": Counter(), "tags": Counter(),
            }
        s["urls"] += 1
        first_seen = r.get("first_seen") or ""
        if first_seen and (not s["first_seen"] or first_seen < s["first_seen"]):
            s["first_seen"] = first_seen
        added = r.get("collected_on") or ""
        if added > s["last_added"]:
            s["last_added"] = added
        s["threats"][r.get("threat") or "unknown"] += 1
        for tag in (r.get("tags") or "").split(","):
            tag = tag.strip()
            if tag:
                s["tags"][tag] += 1

    ips_by_host: dict[str, list[str]] = defaultdict(list)
    status_by_host: dict[str, str] = {}
    for host, ip, status in zip(dns["host"], dns["ip"], dns["status"]):
        status_by_host.setdefault(host, status)
        if ip:
            ips_by_host[host].append(ip)
    for host, s in stats.items():
        if s["kind"] == "ip":
            s["ips"] = [host]
            s["dns_status"] = ""
        else:
            s["ips"] = sorted(set(ips_by_host.get(host, [])))
            s["dns_status"] = status_by_host.get(host, "not looked up")
    return stats


def public_record(s: dict) -> dict:
    top_threat = s["threats"].most_common(1)[0][0] if s["threats"] else "unknown"
    return {
        "host": defang(s["host"]),
        "kind": s["kind"],
        "urls": s["urls"],
        "first_seen": s["first_seen"],
        "last_added": s["last_added"],
        "threat": top_threat,
        "tags": [t for t, _ in s["tags"].most_common(TOP_TAGS)],
        "ips": [defang(ip) for ip in s["ips"]],
        "dns_status": s["dns_status"],
    }


def build_graph_export(stats: dict[str, dict]) -> dict:
    domains = sorted((s for s in stats.values() if s["kind"] == "domain"),
                     key=lambda s: -s["urls"])[:GRAPH_DOMAINS]
    max_urls = max((s["urls"] for s in domains), default=1)
    nodes, edges, ip_urls = [], [], Counter()
    for s in domains:
        dom_id = f"domain:{defang(s['host'])}"
        nodes.append({"id": dom_id, "type": "domain", "value": defang(s["host"]),
                      "urls": s["urls"], "risk": min(100, round(100 * s["urls"] / max_urls))})
        for ip in s["ips"]:
            ip_urls[ip] += s["urls"]
            edges.append({"source": dom_id, "target": f"ip:{defang(ip)}", "relation": "resolves_to"})
    for ip, urls in ip_urls.items():
        nodes.append({"id": f"ip:{defang(ip)}", "type": "ip", "value": defang(ip),
                      "urls": urls, "risk": min(100, round(100 * urls / max_urls))})
    return {
        "generated_utc": _now(),
        "note": "Top domains by URL count and the IPs they resolved to. Risk is relative URL count, not a model score.",
        "nodes": nodes,
        "edges": edges,
    }


def build_alerts(stats: dict[str, dict], rows: list[dict]) -> list[dict]:
    days = sorted({r["collected_on"] for r in rows if r.get("collected_on")})
    if not days:
        return []
    cutoff = days[-ALERT_WINDOW_DAYS] if len(days) >= ALERT_WINDOW_DAYS else days[0]
    recent = [s for s in stats.values() if s["last_added"] >= cutoff]
    recent.sort(key=lambda s: (-s["urls"], s["host"]))
    alerts = []
    for i, s in enumerate(recent[:ALERT_LIMIT], start=1):
        severity, risk = priority(s["urls"])
        threat = s["threats"].most_common(1)[0][0] if s["threats"] else "unknown"
        alerts.append({
            "id": f"feed-{i}",
            "title": f"{threat} · {defang(s['host'])}",
            "host": defang(s["host"]),
            "kind": s["kind"],
            "severity": severity,
            "risk": risk,
            "status": "open",
            "urls": s["urls"],
            "threat": threat,
            "tags": [t for t, _ in s["tags"].most_common(TOP_TAGS)],
            "time": f"{s['last_added']}T00:00:00Z",
        })
    return alerts


def build_latest(rows: list[dict], stats: dict[str, dict], top_n: int = 20) -> dict:
    collected = {r["collected_on"] for r in rows if r.get("collected_on")}
    daily = Counter(r["collected_on"] for r in rows if r.get("collected_on"))
    threats = Counter(r.get("threat") or "unknown" for r in rows)
    domains = [s for s in stats.values() if s["kind"] == "domain"]
    ips = [s for s in stats.values() if s["kind"] == "ip"]
    top = sorted(stats.values(), key=lambda s: (-s["urls"], s["host"]))[:top_n]
    return {
        "generated_utc": _now(),
        "data_source": "URLhaus public feed, accumulated history",
        "simulated": False,
        "history": {
            "urls": len(rows),
            "collection_days": len(collected),
            "first_collected": min(collected) if collected else None,
            "last_collected": max(collected) if collected else None,
        },
        "entity_counts": {
            "domains": len(domains),
            "ip_hosts": len(ips),
            "domains_with_dns_ip": sum(1 for s in domains if s["ips"]),
            "unique_resolved_ips": len({ip for s in domains for ip in s["ips"]}),
        },
        "daily_additions": [{"day": d, "new_urls": n} for d, n in sorted(daily.items())],
        "threat_types": [{"threat": t, "urls": n} for t, n in threats.most_common(10)],
        "top_hosts_defanged": [{"host": defang(s["host"]), "urls": s["urls"]} for s in top],
        "phishing_feed": _phishing_counts(),
        "platform_comparison": _read_json(DATA_PROCESSED / "platform_comparison.json"),
        "gnn_experiment": _read_json(DATA_PROCESSED / "gnn_experiment.json"),
        "phishing_experiment": _read_json(DATA_PROCESSED / "phishing_eval.json"),
    }


def _phishing_counts() -> dict:
    rows = load_phish_history(PHISH_HISTORY_PATH)
    days = sorted({r["collected_on"] for r in rows if r.get("collected_on")})
    return {
        "urls": len(rows),
        "collection_days": len(days),
        "first_collected": days[0] if days else None,
        "last_collected": days[-1] if days else None,
        "source": "OpenPhish community feed (non-commercial use only)",
    }


def build_reference(path: Path = Path(TRANCO_CSV), top_n: int = TRANCO_TOP_N) -> dict:
    """Popularity ranks for the top sites in the Tranco list, defanged.

    A high rank means popular, not safe. A popular site in URLhaus can be a compromised legitimate site.
    """
    domains: dict[str, int] = {}
    if path.exists():
        with open(path, encoding="utf-8", errors="replace") as f:
            for line in f:
                parts = line.strip().split(",")
                if len(parts) < 2:
                    continue
                try:
                    rank = int(parts[0])
                except ValueError:
                    continue
                if rank > top_n:
                    break
                domains[defang(parts[1].strip().lower())] = rank
    return {
        "generated_utc": _now(),
        "source": "Tranco top-sites list (popularity ranking)",
        "available": path.exists(),
        "top_n": top_n,
        "note": "Popularity is not a safety verdict.",
        "domains": domains,
    }


def build_summary(top_n: int = 20) -> dict:
    """Kept for callers that only need the dashboard summary."""
    rows = load_history()
    return build_latest(rows, build_host_index(rows, load_cache()), top_n)


def main() -> None:
    rows = load_history()
    stats = build_host_index(rows, load_cache())
    DATA_OUT.mkdir(parents=True, exist_ok=True)

    latest = build_latest(rows, stats)
    indicators = {
        "generated_utc": _now(),
        "hosts": [public_record(s) for s in sorted(stats.values(), key=lambda s: (-s["urls"], s["host"]))],
    }
    graph = build_graph_export(stats)
    alerts = {"generated_utc": _now(), "window_days": ALERT_WINDOW_DAYS, "alerts": build_alerts(stats, rows)}
    reference = build_reference(Path(TRANCO_CSV))

    OUT.write_text(json.dumps(latest, indent=2))
    (DATA_OUT / "indicators.json").write_text(json.dumps(indicators, separators=(",", ":")))
    (DATA_OUT / "graph.json").write_text(json.dumps(graph, indent=2))
    (DATA_OUT / "alerts.json").write_text(json.dumps(alerts, indent=2))
    (DATA_OUT / "reference.json").write_text(json.dumps(reference, separators=(",", ":")))
    print(f"wrote 4 files to {DATA_OUT} ({latest['history']['urls']} URLs in history, "
          f"{len(indicators['hosts'])} hosts)")


if __name__ == "__main__":
    main()
