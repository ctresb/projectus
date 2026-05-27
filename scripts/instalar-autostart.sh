#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$(uname -s)" in
  Darwin) exec "$SCRIPT_DIR/instalar-autostart-macos.sh" "$@" ;;
  Linux)  exec "$SCRIPT_DIR/instalar-autostart-linux.sh" "$@" ;;
  *)      echo "Autostart não suportado em $(uname -s)" >&2; exit 1 ;;
esac
