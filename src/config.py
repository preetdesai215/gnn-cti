"""Central configuration for paths and data sources."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_RAW = ROOT / "data" / "raw"
DATA_PROCESSED = ROOT / "data" / "processed"
MODELS_DIR = ROOT / "models"

# abuse.ch URLhaus recent-URL CSV. No default is set: the previous endpoint was retired.
# Set URLHAUS_RECENT_CSV to the current link listed at https://urlhaus.abuse.ch/api/,
# or import a saved file instead (see src/ingest/urlhaus.py).
URLHAUS_RECENT_CSV = os.getenv("URLHAUS_RECENT_CSV", "")
# abuse.ch may require a free Auth-Key from your account. Set it here if needed.
URLHAUS_AUTH_KEY = os.getenv("URLHAUS_AUTH_KEY")

# Benign reference list: Tranco top sites CSV (rank,domain). Download from https://tranco-list.eu
# and save as data/raw/tranco_top.csv, or point TRANCO_CSV at it.
TRANCO_CSV = os.getenv("TRANCO_CSV", str(DATA_RAW / "tranco_top.csv"))

# OpenPhish community phishing feed (plain text, one URL per line, updated about every 12 hours).
# Non-commercial use only: see https://openphish.com/terms.html. No key is needed for this link.
PHISH_FEED_URL = os.getenv(
    "PHISH_FEED_URL",
    "https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt",
)

REQUEST_TIMEOUT = 60  # seconds
