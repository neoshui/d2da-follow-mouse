#!/usr/bin/env bash
# Native Dock Follow Mouse — Install Script
# Installs the extension with a local schema directory only.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/native-dock-follow-mouse@neoshui"
UUID="native-dock-follow-mouse@neoshui"
SCHEMA_FILE="org.gnome.shell.extensions.native-dock-follow-mouse.gschema.xml"

install() {
    echo "==> Installing Native Dock Follow Mouse..."

    rm -rf "$EXT_DIR"
    mkdir -p "$EXT_DIR/schemas"
    cp "$SCRIPT_DIR/extension.js" "$SCRIPT_DIR/prefs.js" "$SCRIPT_DIR/metadata.json" "$SCRIPT_DIR/stylesheet.css" "$EXT_DIR/"
    cp "$SCRIPT_DIR/schemas/$SCHEMA_FILE" "$EXT_DIR/schemas/"

    if ! command -v glib-compile-schemas >/dev/null 2>&1; then
        echo "ERROR: glib-compile-schemas not found"
        exit 1
    fi

    glib-compile-schemas "$EXT_DIR/schemas"
    echo "    Extension files installed → $EXT_DIR"
    echo "    Local schema compiled → $EXT_DIR/schemas"

    if command -v gnome-extensions >/dev/null 2>&1; then
        gnome-extensions enable "$UUID" >/dev/null 2>&1 || true
        echo "    Extension enabled"
    fi

    echo "==> Done. Log out and back in to activate cleanly."
    echo "    Status: gnome-extensions info $UUID"
}

uninstall() {
    echo "==> Uninstalling Native Dock Follow Mouse..."

    if command -v gnome-extensions >/dev/null 2>&1; then
        gnome-extensions disable "$UUID" >/dev/null 2>&1 || true
    fi

    rm -rf "$EXT_DIR"
    echo "    Removed → $EXT_DIR"
    echo "==> Done."
}

case "${1:-}" in
    --uninstall)
        uninstall
        ;;
    "")
        install
        ;;
    *)
        echo "Usage: $0 [--uninstall]"
        exit 1
        ;;
esac
