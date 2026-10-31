"""Per-URL features computed from the URL string alone.

No DNS, WHOIS, or network lookups, so features are fast and reproducible.
"""
import ipaddress
import math
from collections import Counter
from urllib.parse import urlsplit

FEATURE_NAMES = [
    "url_length", "host_length", "path_length", "query_length",
    "num_dots", "num_hyphens", "num_digits", "num_special",
    "num_subdomains", "is_ip_host", "uses_https", "has_port",
    "host_entropy", "path_entropy", "tld_length",
]


def _entropy(s: str) -> float:
    """Shannon entropy in bits per character. Random-looking strings score high."""
    if not s:
        return 0.0
    n = len(s)
    return -sum((c / n) * math.log2(c / n) for c in Counter(s).values())


def url_features(url: str) -> dict | None:
    """Return the feature dict for a URL, or None if it cannot be parsed."""
    try:
        parts = urlsplit(url)
        host = parts.hostname or ""
    except ValueError:
        return None
    if not host:
        return None

    try:
        ipaddress.ip_address(host)
        is_ip = True
    except ValueError:
        is_ip = False

    labels = [lab for lab in host.split(".") if lab]
    return {
        "url_length": len(url),
        "host_length": len(host),
        "path_length": len(parts.path),
        "query_length": len(parts.query),
        "num_dots": url.count("."),
        "num_hyphens": url.count("-"),
        "num_digits": sum(ch.isdigit() for ch in url),
        "num_special": sum(ch in "@?=&%_~" for ch in url),
        "num_subdomains": 0 if is_ip else max(len(labels) - 2, 0),
        "is_ip_host": int(is_ip),
        "uses_https": int(parts.scheme == "https"),
        "has_port": int(":" in parts.netloc.rsplit("@", 1)[-1].split("]")[-1]),
        "host_entropy": _entropy(host),
        "path_entropy": _entropy(parts.path),
        "tld_length": 0 if (is_ip or not labels) else len(labels[-1]),
    }
