#!/usr/bin/env bash
set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
BRIDGE_DIR="$HOME/.mcp_servers/md-annotate"
BRIDGE_DEST="$BRIDGE_DIR/mcp-bridge.js"

echo "==> Stopping daemon..."
node "$REPO_DIR/bin/cli.js" stop 2>/dev/null || true

echo "==> Killing anything on port 4242..."
if command -v lsof &>/dev/null; then
  lsof -ti :4242 | xargs kill -9 2>/dev/null || true
elif command -v fuser &>/dev/null; then
  fuser -k 4242/tcp 2>/dev/null || true
else
  echo "   (skipped — install lsof or fuser to auto-kill port 4242)"
fi

echo "==> Removing node_modules..."
rm -rf "$REPO_DIR/node_modules"

echo "==> Installing dependencies..."
cd "$REPO_DIR"
npm install

echo "==> Building UI..."
npm run build

echo "==> Building MCP bridge..."
npm run build:mcp

echo "==> Copying bridge to $BRIDGE_DEST..."
mkdir -p "$BRIDGE_DIR"
cp "$REPO_DIR/mcp-bridge.js" "$BRIDGE_DEST"

echo "==> Starting daemon..."
node "$REPO_DIR/bin/cli.js" start

echo ""
echo "Done. UI running at http://localhost:4242"
