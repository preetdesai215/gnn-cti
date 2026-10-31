"""Central configuration for paths and data sources."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_RAW = ROOT / "data" / "raw"
DATA_PROCESSED = ROOT / "data" / "processed"
MODELS_DIR = ROOT / "models"

# abuse.ch URLhaus: recent malicious URLs (CSV, free, no key required)
URLHAUS_RECENT_CSV = "https://urlhaus.abuse.ch/downloads/csv_recent/"

REQUEST_TIMEOUT = 60  # seconds
