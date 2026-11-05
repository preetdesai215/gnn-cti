#!/usr/bin/env bash
# Back up the project's data folder (feeds, history, results, logs) to a timestamped archive.
#
# Usage:
#   scripts/backup.sh                       # uses BACKUP_DIR or ~/gnn-cti-backups
#   scripts/backup.sh /mnt/c/Users/YOU/Documents/gnn-cti-backups
#
# The API key file (~/.gnn-cti.env) is NOT included. Keep it separately.
# Restore with:  tar -xzf ARCHIVE -C ~/projects/gnn-cti
set -euo pipefail

PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${GNN_CTI_ENV:-$HOME/.gnn-cti.env}"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

DEST="${1:-${BACKUP_DIR:-$HOME/gnn-cti-backups}}"
KEEP="${BACKUP_KEEP:-30}"

if [ ! -d "$PROJECT/data" ]; then
  echo "ERROR: $PROJECT/data not found, nothing to back up"
  exit 1
fi

mkdir -p "$DEST"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="$DEST/gnn-cti-data-$STAMP.tar.gz"
tar -czf "$ARCHIVE" -C "$PROJECT" data
echo "backup written: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

# Keep only the newest $KEEP archives
ls -1t "$DEST"/gnn-cti-data-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
