#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  exit 0
fi

MISSING=()
check() {
  pkg-config --exists "$1" 2>/dev/null || MISSING+=("$1")
}

command -v pkg-config >/dev/null 2>&1 || { echo "ERR / pkg-config não encontrado; instale antes de continuar." >&2; exit 1; }

check webkit2gtk-4.1
check gtk+-3.0
check openssl

if [[ ${#MISSING[@]} -eq 0 ]]; then
  echo "OK / todas as dependências Tauri encontradas."
  exit 0
fi

echo "ERR / dependências ausentes: ${MISSING[*]}" >&2
echo "" >&2
echo "Arch Linux:" >&2
echo "  sudo pacman -S webkit2gtk-4.1 gtk3 openssl pkg-config libayatana-appindicator" >&2
echo "" >&2
echo "Debian/Ubuntu:" >&2
echo "  sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libssl-dev pkg-config libayatana-appindicator3-dev librsvg2-dev" >&2
exit 1
