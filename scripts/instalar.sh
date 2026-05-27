#!/bin/zsh
# Gera o DMG de instalação do PROJECTUS e abre o Finder com a janela clássica
# "arraste o app para a pasta Applications".
#
# Uso:
#   ./scripts/instalar.sh                 # compila o DMG e abre o Finder
#   ./scripts/instalar.sh --apenas-build  # só compila, não abre
#   ./scripts/instalar.sh --daemon        # após copiar, instala o daemon launchd

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OPEN_FINDER=1
INSTALL_DAEMON=0
for arg in "$@"; do
  case "$arg" in
    --apenas-build) OPEN_FINDER=0 ;;
    --daemon) INSTALL_DAEMON=1 ;;
    -h|--help)
      echo "Uso: $0 [--apenas-build] [--daemon]"
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

if [[ ! -x apps/desktop/node_modules/.bin/tauri ||
      ! -x apps/web/node_modules/.bin/vite ||
      ! -x apps/web/node_modules/.bin/tsc ]]; then
  echo ">> instalando dependências do workspace..."
  pnpm install --frozen-lockfile
fi

echo ">> compilando PROJECTUS em release (primeira vez demora alguns minutos)..."
pnpm --filter @projectus/desktop tauri build --bundles dmg

DMG_PATH=$(ls "$ROOT/target/release/bundle/dmg/"PROJECTUS_*.dmg 2>/dev/null | head -n 1 || true)
if [[ -z "$DMG_PATH" || ! -f "$DMG_PATH" ]]; then
  echo "ERR / DMG não encontrado em target/release/bundle/dmg/. Verifique o log do tauri build." >&2
  exit 1
fi

# Remove o atributo de quarentena para evitar o aviso "app baixado da internet"
# quando o usuário arrastar para /Applications.
xattr -dr com.apple.quarantine "$DMG_PATH" 2>/dev/null || true

echo ""
echo "DMG pronto: $DMG_PATH"
echo ""

if (( OPEN_FINDER )); then
  echo ">> abrindo o instalador no Finder (arraste PROJECTUS.app para Applications)..."
  # bundle_dmg.sh do tauri pode deixar um volume PROJECTUS montado;
  # desmonta antes pra evitar duas janelas do Finder.
  for mount in /Volumes/PROJECTUS*; do
    [[ -d "$mount" ]] && hdiutil detach "$mount" -quiet 2>/dev/null || true
  done
  open "$DMG_PATH"
fi

if (( INSTALL_DAEMON )); then
  echo ">> instalando daemon launchd..."
  "$ROOT/scripts/instalar-autostart.sh"
fi

cat <<MSG

Próximos passos:
  1. Na janela do Finder que abriu, arraste PROJECTUS.app para a pasta Applications.
  2. Ejete o DMG (botão direito na unidade -> Ejetar).
  3. Abra o app pelo Launchpad ou com: open -a PROJECTUS

  Dados:     ~/Documents/PROJECTUS
  Daemon:    ./scripts/instalar-autostart.sh   (mantém backend ativo no login)
  Recompilar: ./scripts/instalar.sh

MSG
