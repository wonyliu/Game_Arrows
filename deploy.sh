#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-4173}"
TUNNEL_URL_TARGET="${TUNNEL_URL_TARGET:-http://127.0.0.1:${PORT}}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/.local-data/logs}"
DEV_LOG_FILE="$LOG_DIR/dev-server.log"
CLOUDFLARED_LOG_FILE="$LOG_DIR/cloudflared.log"
CLOUDFLARED_PID_FILE="$LOG_DIR/cloudflared.pid"

echo "[deploy] root: $ROOT_DIR"
echo "[deploy] port: $PORT"
echo "[deploy] tunnel target: $TUNNEL_URL_TARGET"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[deploy] missing required command: $1" >&2
    exit 1
  fi
}

require_cmd git
require_cmd node
require_cmd npm
require_cmd cloudflared
require_cmd curl

mkdir -p "$LOG_DIR"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "[deploy] working tree is not clean; aborting to avoid accidental overwrite." >&2
  echo "[deploy] commit/stash local changes first." >&2
  exit 1
fi

echo "[deploy] pulling latest code..."
git fetch --all --prune
git pull --ff-only

echo "[deploy] installing/updating dependencies..."
if [[ -f package-lock.json ]]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi

echo "[deploy] restarting dev server..."
if [[ -x "$ROOT_DIR/scripts/restart-dev-server.sh" ]]; then
  "$ROOT_DIR/scripts/restart-dev-server.sh"
else
  bash "$ROOT_DIR/scripts/restart-dev-server.sh"
fi

echo "[deploy] restarting cloudflared tunnel..."
pkill -f "cloudflared tunnel --url" >/dev/null 2>&1 || true
sleep 1
nohup cloudflared tunnel --url "$TUNNEL_URL_TARGET" >"$CLOUDFLARED_LOG_FILE" 2>&1 &
CLOUDFLARED_PID=$!
echo "$CLOUDFLARED_PID" >"$CLOUDFLARED_PID_FILE"
sleep 2

if ! kill -0 "$CLOUDFLARED_PID" >/dev/null 2>&1; then
  echo "[deploy] cloudflared failed to start. log: $CLOUDFLARED_LOG_FILE" >&2
  tail -n 60 "$CLOUDFLARED_LOG_FILE" >&2 || true
  exit 1
fi

echo "[deploy] local health check..."
curl -fsS "http://127.0.0.1:${PORT}/admin.html" >/dev/null

TUNNEL_PUBLIC_URL="$(grep -Eo 'https://[-a-zA-Z0-9.]+trycloudflare.com' "$CLOUDFLARED_LOG_FILE" | tail -n 1 || true)"

echo
echo "[deploy] done."
echo "[deploy] dev log: $DEV_LOG_FILE"
echo "[deploy] cloudflared log: $CLOUDFLARED_LOG_FILE"
if [[ -n "$TUNNEL_PUBLIC_URL" ]]; then
  echo "[deploy] tunnel url: $TUNNEL_PUBLIC_URL"
fi
echo "[deploy] tail dev server log:"
tail -n 20 "$DEV_LOG_FILE" || true
echo "[deploy] tail cloudflared log:"
tail -n 20 "$CLOUDFLARED_LOG_FILE" || true
