#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR/dist"
STATE_FILE="$SCRIPT_DIR/.build-version"
UUID="native-dock-follow-mouse@neoshui"

mkdir -p "$OUT_DIR"

if [[ -f "$STATE_FILE" ]]; then
  BUILD_NO="$(<"$STATE_FILE")"
else
  BUILD_NO=0
fi

if ! [[ "$BUILD_NO" =~ ^[0-9]+$ ]]; then
  BUILD_NO=0
fi
BUILD_NO=$((BUILD_NO + 1))
printf '%s\n' "$BUILD_NO" > "$STATE_FILE"

VERSION_TAG="v$(printf '%04d' "$BUILD_NO")"
ZIP_NAME="$OUT_DIR/${UUID}-${VERSION_TAG}.zip"
rm -f "$ZIP_NAME"

cd "$SCRIPT_DIR"
zip -r "$ZIP_NAME" \
  extension.js prefs.js metadata.json stylesheet.css install.sh README.md LICENSE schemas \
  -x 'dist/*' '.build-version'

echo "Created: $ZIP_NAME"
echo "Build no: $BUILD_NO"
