#!/usr/bin/env bash
set -euo pipefail

# Midline Journal — Safe SQLite + Photos Backup Script (for rclone / Google Drive)
#
# Usage:
#   RCLONE_REMOTE="gdrive:MidlineBackup" ./scripts/backup.sh
#
# Optional environment variables:
#   DATA_DIR       Path to Midline's data directory (default: ./data)
#   RCLONE_REMOTE  Any rclone remote:path (default: gdrive:MidlineBackup)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="${DATA_DIR:-$PROJECT_DIR/data}"
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive:MidlineBackup}"

if ! command -v rclone >/dev/null 2>&1; then
  echo "Error: rclone is not installed. Install it from https://rclone.org/install/ or 'sudo apt install rclone'." >&2
  exit 1
fi

if [ ! -f "$DATA_DIR/midline.db" ]; then
  echo "Error: database not found at $DATA_DIR/midline.db" >&2
  exit 1
fi

STAGE_DIR="$(mktemp -d -t midline-backup-XXXXXX)"
cleanup() { rm -rf "$STAGE_DIR"; }
trap cleanup EXIT

echo "Creating safe SQLite snapshot..."
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DATA_DIR/midline.db" ".backup '$STAGE_DIR/midline.db'"
else
  # Fallback using Node + better-sqlite3 if sqlite3 CLI is unavailable
  node -e "
    import('$PROJECT_DIR/server/node_modules/better-sqlite3/lib/index.js').then(({ default: Database }) => {
      const db = new Database(process.argv[1], { readonly: true });
      db.backup(process.argv[2]).then(() => db.close());
    });
  " "$DATA_DIR/midline.db" "$STAGE_DIR/midline.db"
fi

echo "Syncing database snapshot to $RCLONE_REMOTE..."
rclone copyto "$STAGE_DIR/midline.db" "$RCLONE_REMOTE/midline.db"

if [ -d "$DATA_DIR/uploads" ]; then
  echo "Syncing photos to $RCLONE_REMOTE/uploads..."
  rclone sync "$DATA_DIR/uploads" "$RCLONE_REMOTE/uploads"
fi

echo "Backup complete: $(date)"
