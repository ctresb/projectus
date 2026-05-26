#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/target/release/projectus-server"
PLIST="$HOME/Library/LaunchAgents/com.projectus.server.plist"
LOG_DIR="$HOME/Library/Logs/PROJECTUS"

pnpm --dir "$ROOT" build
cargo build --release -p projectus-server --manifest-path "$ROOT/Cargo.toml"
mkdir -p "${PLIST:h}" "$LOG_DIR"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.projectus.server</string>
<key>ProgramArguments</key><array><string>$BIN</string></array>
<key>WorkingDirectory</key><string>$ROOT</string>
<key>EnvironmentVariables</key><dict>
<key>PROJECTUS_WEB_DIST</key><string>$ROOT/apps/web/dist</string>
</dict>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>$LOG_DIR/server.log</string>
<key>StandardErrorPath</key><string>$LOG_DIR/server.err.log</string>
</dict></plist>
EOF

launchctl bootout "gui/$UID" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$UID" "$PLIST"
echo "PROJECTUS server instalado: $PLIST"
