#!/bin/zsh
# Atalho de duplo-clique: compila o PROJECTUS, abre o instalador e reinicia
# o servidor local usando o binário recém-compilado.
#
# Como usar:
#   - duplo-clique neste arquivo no Finder
#   - OU: ./INSTALAR.command
#   - OU: pnpm instalar
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      exec ./scripts/instalar.sh "$@"
      ;;
  esac
done

SERVER_LABEL="com.projectus.server"
SERVER_BIN="$ROOT/target/release/projectus-server"
PLIST="$HOME/Library/LaunchAgents/$SERVER_LABEL.plist"
LOG_DIR="$HOME/Library/Logs/PROJECTUS"
LAUNCH_DOMAIN="gui/$UID"

parar_server() {
  if [[ -f "$PLIST" ]]; then
    launchctl bootout "$LAUNCH_DOMAIN" "$PLIST" 2>/dev/null || true
  fi
  pkill -x projectus-server 2>/dev/null || true
}

iniciar_server() {
  mkdir -p "$LOG_DIR"
  if [[ -f "$PLIST" ]]; then
    if ! launchctl bootstrap "$LAUNCH_DOMAIN" "$PLIST" 2>/dev/null; then
      launchctl kickstart -k "$LAUNCH_DOMAIN/$SERVER_LABEL"
    fi
    echo ">> servidor reiniciado via launchd"
    return
  fi

  PROJECTUS_WEB_DIST="$ROOT/apps/web/dist" nohup "$SERVER_BIN" >"$LOG_DIR/server.log" 2>"$LOG_DIR/server.err.log" &
  disown $! 2>/dev/null || true
  echo ">> servidor iniciado: $SERVER_BIN"
}

echo ">> parando servidor PROJECTUS atual..."
parar_server

./scripts/instalar.sh "$@"

echo ">> compilando projectus-server em release..."
cargo build --release -p projectus-server --manifest-path "$ROOT/Cargo.toml"

echo ">> iniciando servidor PROJECTUS recém-compilado..."
parar_server
iniciar_server
