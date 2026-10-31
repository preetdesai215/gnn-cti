"""Load the benign reference list (Tranco top sites) used as negative examples."""
from pathlib import Path


def load_top_domains(path: Path, limit: int) -> list[str]:
    """Return up to `limit` domains from a Tranco CSV (lines look like 'rank,domain')."""
    domains: list[str] = []
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            domain = line.split(",")[-1].strip().lower()
            if domain:
                domains.append(domain)
            if len(domains) >= limit:
                break
    return domains
