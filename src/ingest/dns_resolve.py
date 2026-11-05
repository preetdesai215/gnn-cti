"""Resolve A records for the domains in the URL history.

DNS queries only: nothing connects to these hosts. Results are cached in
data/processed/dns_a_records.csv, and each run resolves only domains not yet cached,
so daily runs stay quick.

Run: python -m src.ingest.dns_resolve
"""
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from src.config import DATA_PROCESSED
from src.graph.build import extract_host
from src.ingest.history import load_history

CACHE_PATH = DATA_PROCESSED / "dns_a_records.csv"
COLUMNS = ["host", "ip", "status", "resolved_on"]


def resolve_host(host: str, resolver) -> tuple[list[str], str]:
    """Return (ip_addresses, status) using A records only."""
    import dns.exception
    import dns.resolver

    try:
        answer = resolver.resolve(host, "A", lifetime=5.0)
        return [rr.to_text() for rr in answer], "ok"
    except dns.resolver.NXDOMAIN:
        return [], "nxdomain"
    except dns.resolver.NoAnswer:
        return [], "noanswer"
    except dns.exception.Timeout:
        return [], "timeout"
    except Exception:
        return [], "error"


def load_cache(path: Path = CACHE_PATH) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame(columns=COLUMNS)
    return pd.read_csv(path, dtype=str).fillna("")


def resolve_new(hosts: list[str], resolver=None, path: Path = CACHE_PATH,
                pause: float = 0.02) -> dict:
    """Resolve hosts not yet in the cache and append the results."""
    if resolver is None:
        import dns.resolver
        resolver = dns.resolver.Resolver()

    cache = load_cache(path)
    known = set(cache["host"])
    todo = sorted({h for h in hosts if h} - known)
    today = datetime.now(timezone.utc).date().isoformat()

    rows = []
    for host in todo:
        ips, status = resolve_host(host, resolver)
        if ips:
            rows += [{"host": host, "ip": ip, "status": status, "resolved_on": today} for ip in ips]
        else:
            rows.append({"host": host, "ip": "", "status": status, "resolved_on": today})
        time.sleep(pause)

    merged = pd.concat([cache, pd.DataFrame(rows, columns=COLUMNS)], ignore_index=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    merged.to_csv(path, index=False)
    return {
        "hosts_already_cached": len(known),
        "hosts_resolved_now": len(todo),
        "host_ip_pairs_total": int((merged["ip"] != "").sum()),
        "cache_file": str(path),
    }


def domain_hosts_from_history() -> list[str]:
    hosts = set()
    for row in load_history():
        host, kind = extract_host(row["url"])
        if host and kind == "domain":
            hosts.add(host)
    return sorted(hosts)


if __name__ == "__main__":
    print(resolve_new(domain_hosts_from_history()))
