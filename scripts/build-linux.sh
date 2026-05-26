#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo ">> build web..."
pnpm --dir "$ROOT" build

echo ">> build server..."
cargo build --release -p projectus-server --manifest-path "$ROOT/Cargo.toml"

echo ">> build desktop (AppImage + deb)..."
"$ROOT/scripts/check-tauri-linux-deps.sh"
pnpm --filter @projectus/desktop tauri build --bundles deb,appimage

echo ""
echo "Artefatos:"
ls "$ROOT/target/release/bundle/" 2>/dev/null || true
echo ""
echo "Para rodar apenas o servidor:"
echo "  PROJECTUS_WEB_DIST=$ROOT/apps/web/dist $ROOT/target/release/projectus-server"
