"""Central configuration for paths and data sources."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_RAW = ROOT / "data" / "raw"
DATA_PROCESSED = ROOT / "data" / "processed"
MODELS_DIR = ROOT / "models"

# abuse.ch URLhaus recent-URL CSV. The old URL returns HTTP 410 (retired), so the
# endpoint is overridable via environment variable. Check https://urlhaus.abuse.ch/api/
# for the current path.
URLHAUS_RECENT_CSV = os.getenv(
    "URLHAUS_RECENT_CSV", "https://urlhaus.abuse.ch/downloads/csv_recent/"
)
# abuse.ch may require a free Auth-Key from your account. Set it here if needed.
URLHAUS_AUTH_KEY = os.getenv("URLHAUS_AUTH_KEY")

REQUEST_TIMEOUT = 60  # seconds
