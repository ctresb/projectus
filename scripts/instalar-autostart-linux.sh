#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="$ROOT/target/release/projectus-server"
SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SERVICE_DIR/projectus.service"

if [[ ! -f "$BIN" ]]; then
  echo ">> compilando projectus-server..."
  pnpm --dir "$ROOT" build
  cargo build --release -p projectus-server --manifest-path "$ROOT/Cargo.toml"
fi

mkdir -p "$SERVICE_DIR"

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=PROJECTUS local server
After=network-online.target

[Service]
Type=simple
WorkingDirectory=$ROOT
ExecStart=$BIN
Environment=PROJECTUS_WEB_DIST=$ROOT/apps/web/dist
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now projectus.service
echo "PROJECTUS server instalado: $SERVICE_FILE"
echo ""
echo "Para verificar: systemctl --user status projectus.service"
echo "Para remover:   ./scripts/remover-autostart-linux.sh"
echo ""
echo "Nota: para iniciar com o sistema sem sessão ativa, habilite linger:"
echo "  sudo loginctl enable-linger \"\$USER\""
