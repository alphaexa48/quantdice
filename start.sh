#!/usr/bin/env bash
# Build the static deployment output and serve the live DiceForge app.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

PORT="${PORT:-3000}"
DIST_DIR="$PROJECT_ROOT/dist"
DEPLOY_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
DEPLOY_FILE="$DEPLOY_DIR/deployment-output.json"

/usr/bin/time -p mkdir -p "$DEPLOY_DIR"
/usr/bin/time -p test -f "$PROJECT_ROOT/package.json"

# Install project dependencies. This app currently has none, so this is a fast no-op.
/usr/bin/time -p npm install --no-audit --no-fund --package-lock=false --ignore-scripts

# Build the static output that the deployment controller publishes.
/usr/bin/time -p rm -rf "$DIST_DIR"
/usr/bin/time -p mkdir -p "$DIST_DIR"
/usr/bin/time -p cp "$PROJECT_ROOT/index.html" "$PROJECT_ROOT/app.js" "$PROJECT_ROOT/styles.css" \
  "$PROJECT_ROOT/manifest.webmanifest" "$PROJECT_ROOT/sw.js" "$DIST_DIR"/
/usr/bin/time -p cp -R "$PROJECT_ROOT/icons" "$DIST_DIR"/
/usr/bin/time -p test -f "$DIST_DIR/index.html"

# Declare the built static directory before serving.
/usr/bin/time -p bash -c 'printf "{\"project\":\"%s\",\"directory\":\"%s\"}\n" "$1" "$2" > "$3"' \
  _ "$PROJECT_ROOT" "$DIST_DIR" "$DEPLOY_FILE"
/usr/bin/time -p cat "$DEPLOY_FILE"

echo "Serving DiceForge from $PROJECT_ROOT on port $PORT (static output: $DIST_DIR)"
exec /usr/bin/time -p node "$PROJECT_ROOT/server.mjs"
