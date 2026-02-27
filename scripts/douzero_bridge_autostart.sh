#!/usr/bin/env bash
set -euo pipefail

HOST="${DOUZERO_BRIDGE_HOST:-127.0.0.1}"
PORT="${DOUZERO_BRIDGE_PORT:-5000}"
PATH_SUFFIX="${DOUZERO_BRIDGE_PATH:-/douzero}"

# 允许用户完全自定义启动命令
if [[ -n "${DOUZERO_BRIDGE_INNER_CMD:-}" ]]; then
  exec bash -lc "${DOUZERO_BRIDGE_INNER_CMD}"
fi

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "[douzero:auto-start] python not found" >&2
  exit 127
fi

# 常见桥接模块名候选（按顺序尝试）
if "$PY" -c "import importlib.util,sys;sys.exit(0 if importlib.util.find_spec('douzero_bridge') else 1)" 2>/dev/null; then
  exec "$PY" -m douzero_bridge --host "$HOST" --port "$PORT" --path "$PATH_SUFFIX"
fi

if "$PY" -c "import importlib.util,sys;sys.exit(0 if importlib.util.find_spec('bridge') else 1)" 2>/dev/null; then
  exec "$PY" -m bridge --host "$HOST" --port "$PORT"
fi

echo "[douzero:auto-start] no known bridge module found."
echo "Set DOUZERO_BRIDGE_INNER_CMD or DOUZERO_AUTO_START_CMD explicitly." >&2
exit 2
