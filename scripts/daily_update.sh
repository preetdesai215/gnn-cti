#!/usr/bin/env bash
# Daily URLhaus update: download the feed, add new URLs to the history, rerun the evaluation.
#
# Setup (once):
#   1. Create ~/.gnn-cti.env containing one line (keep the key private):
#        URLHAUS_FEED_URL="https://urlhaus-api.abuse.ch/v2/files/exports/YOUR-KEY/recent.csv"
#      then: chmod 600 ~/.gnn-cti.env
#   2. chmod +x scripts/daily_update.sh
#   3. Schedule it (see docs in the README).
#
# The history is only changed if the download succeeds and the file looks like URLhaus CSV.
set -uo pipefail

PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${GNN_CTI_ENV:-$HOME/.gnn-cti.env}"
LOG_DIR="$PROJECT/data/processed/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/daily_$(date -u +%Y%m%d).log"
exec >>"$LOG" 2>&1

echo "=== $(date -u +%FT%TZ) daily update start"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. History not changed."
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"
if [ -z "${URLHAUS_FEED_URL:-}" ]; then
  echo "ERROR: URLHAUS_FEED_URL is not set in $ENV_FILE. History not changed."
  exit 1
fi

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

# Do not print the URL: it contains the API key.
STATUS=$(curl -sS -o "$TMP" -w "%{http_code}" "$URLHAUS_FEED_URL" 2>/dev/null) || STATUS="000"
echo "download HTTP status: $STATUS"
if [ "$STATUS" != "200" ]; then
  echo "ERROR: download failed. History not changed."
  exit 1
fi
if ! head -1 "$TMP" | grep -q '^#'; then
  echo "ERROR: downloaded file does not look like URLhaus CSV. History not changed."
  exit 1
fi

# Activate the project environment (Miniconda default location)
CONDA_SH="$HOME/miniconda3/etc/profile.d/conda.sh"
if [ -f "$CONDA_SH" ]; then
  # shellcheck disable=SC1090
  source "$CONDA_SH"
  conda activate gnn-cti || { echo "ERROR: could not activate gnn-cti env"; exit 1; }
fi

cd "$PROJECT" || { echo "ERROR: project folder missing"; exit 1; }

if ! python -m src.ingest.history "$TMP"; then
  echo "ERROR: history update failed"
  exit 1
fi

if python -m src.models.run_eval > /dev/null; then
  echo "evaluation finished: data/processed/platform_comparison.json updated"
else
  echo "ERROR: evaluation failed (history was updated)"
  exit 1
fi

echo "=== $(date -u +%FT%TZ) daily update done"
