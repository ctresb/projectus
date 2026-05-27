#!/usr/bin/env bash
set -euo pipefail

SERVICE_FILE="$HOME/.config/systemd/user/projectus.service"

systemctl --user disable --now projectus.service 2>/dev/null || true
rm -f "$SERVICE_FILE"
systemctl --user daemon-reload
echo "Autostart Linux removido."
