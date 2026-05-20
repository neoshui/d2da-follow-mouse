#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR/dist"
UUID="d2da-follow-mouse@neoshui"
ZIP_NAME="$OUT_DIR/${UUID}.zip"

mkdir -p "$OUT_DIR"
rm -f "$ZIP_NAME"

cd "$SCRIPT_DIR"
zip -r "$ZIP_NAME" \
  extension.js prefs.js metadata.json stylesheet.css install.sh README.md LICENSE schemas \
  -x 'dist/*'

echo "Created: $ZIP_NAME"
