#!/bin/zsh
# Gera o DMG de instalação do PROJECTUS-SERVER e abre o Finder.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OPEN_FINDER=1
for arg in "$@"; do
  case "$arg" in
    --apenas-build) OPEN_FINDER=0 ;;
    -h|--help)
      echo "Uso: $0 [--apenas-build]"
      exit 0
      ;;
  esac
done

echo ">> verificando ferramentas..."
for tool in pnpm cargo; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "ERR / dependência ausente: $tool. Instale antes de prosseguir." >&2
    exit 1
  fi
done

echo ">> compilando PROJECTUS-SERVER em release..."
pnpm --filter @projectus/server-app tauri build --bundles dmg

DMG_PATH=$(ls "$ROOT/target/release/bundle/dmg/"PROJECTUS-SERVER_*.dmg 2>/dev/null | head -n 1 || true)
if [[ -z "$DMG_PATH" || ! -f "$DMG_PATH" ]]; then
  echo "ERR / DMG não encontrado em target/release/bundle/dmg/." >&2
  exit 1
fi

xattr -dr com.apple.quarantine "$DMG_PATH" 2>/dev/null || true

echo ""
echo "DMG pronto: $DMG_PATH"
echo ""

if (( OPEN_FINDER )); then
  echo ">> abrindo o instalador no Finder (arraste PROJECTUS-SERVER.app para Applications)..."
  for mount in /Volumes/PROJECTUS-SERVER*; do
    [[ -d "$mount" ]] && hdiutil detach "$mount" -quiet 2>/dev/null || true
  done
  open "$DMG_PATH"
fi

cat <<MSG

Próximos passos:
  1. Arraste PROJECTUS-SERVER.app para Applications.
  2. Abra o PROJECTUS-SERVER; ele fica na barra de menus.
  3. Copie o token no popover e cole em PROJECTUS / ajustes / servidor.

  Dados:      ~/Documents/PROJECTUS
  Recompilar: ./scripts/instalar-server.sh

MSG
