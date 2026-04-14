#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${GAME_SERVER_ENV_FILE:-$ROOT_DIR/.env.server}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-4173}"
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-https://wonyliu.github.io,http://127.0.0.1:4173,http://localhost:4173}"

if [[ -z "${USER_CENTER_DATABASE_URL:-}" && -z "${DATABASE_URL:-}" && "${USER_CENTER_BACKEND:-postgres}" != "json" ]]; then
  echo "Missing USER_CENTER_DATABASE_URL or DATABASE_URL. Set it in .env.server or export it before running." >&2
  exit 1
fi

LOG_DIR="$ROOT_DIR/.local-data/logs"
PID_FILE="$LOG_DIR/dev-server.pid"
LOG_FILE="$LOG_DIR/dev-server.log"
mkdir -p "$LOG_DIR"

if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" >/dev/null 2>&1 || true
fi

pkill -f "node scripts/dev-server.mjs" >/dev/null 2>&1 || true
sleep 1

nohup node scripts/dev-server.mjs >"$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" >"$PID_FILE"
sleep 1

if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
  echo "dev-server failed to start. Check $LOG_FILE" >&2
  tail -n 40 "$LOG_FILE" >&2 || true
  exit 1
fi

echo "dev-server restarted"
echo "pid: $SERVER_PID"
echo "url: http://$HOST:$PORT"
echo "log: $LOG_FILE"
