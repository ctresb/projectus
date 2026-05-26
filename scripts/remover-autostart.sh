#!/bin/zsh
set -euo pipefail

PLIST="$HOME/Library/LaunchAgents/com.projectus.server.plist"
launchctl bootout "gui/$UID" "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
echo "Autostart removido."
