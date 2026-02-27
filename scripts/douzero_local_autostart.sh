#!/usr/bin/env bash
set -euo pipefail

# This command runs once per DouZero decision in local-command mode.
# It receives JSON on stdin and must output one JSON move on stdout.

if [[ -n "${DOUZERO_LOCAL_INNER_CMD:-}" ]]; then
  exec bash -lc "${DOUZERO_LOCAL_INNER_CMD}"
fi

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "[douzero:local-cmd] python not found" >&2
  exit 127
fi

# Try common local-command entry module names.
if "$PY" -c "import importlib.util,sys;sys.exit(0 if importlib.util.find_spec('douzero_local_cmd') else 1)" 2>/dev/null; then
  exec "$PY" -m douzero_local_cmd
fi

if "$PY" -c "import importlib.util,sys;sys.exit(0 if importlib.util.find_spec('douzero_agent') else 1)" 2>/dev/null; then
  exec "$PY" -m douzero_agent
fi

echo "[douzero:local-cmd] no known local module found." >&2
echo "Set DOUZERO_LOCAL_CMD or DOUZERO_LOCAL_INNER_CMD explicitly." >&2
exit 2
