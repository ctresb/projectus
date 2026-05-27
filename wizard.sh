#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"
export PROJECTUS_ROOT="$ROOT"
export PYTHONPATH="$ROOT/wizard${PYTHONPATH:+:$PYTHONPATH}"

if "$PYTHON_BIN" -c "import textual" >/dev/null 2>&1; then
  exec "$PYTHON_BIN" -m projectus_wizard
fi

VENV="$ROOT/wizard/.venv"
if [[ ! -x "$VENV/bin/python" ]]; then
  "$PYTHON_BIN" -m venv "$VENV"
fi

"$VENV/bin/python" -m pip install -r "$ROOT/wizard/requirements.txt"
exec "$VENV/bin/python" -m projectus_wizard
