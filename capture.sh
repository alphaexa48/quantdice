#!/usr/bin/env bash
# Capture desktop and mobile evidence for the running app.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
: "${CAPTURE_URL:?CAPTURE_URL is required}"
: "${CAPTURE_DIR:?CAPTURE_DIR is required}"

/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
CAPTURE_DIR="$(cd "$CAPTURE_DIR" && pwd -P)"
case "$CAPTURE_DIR/" in
  "$PROJECT_ROOT/"*)
    echo "CAPTURE_DIR must be outside the source tree: $CAPTURE_DIR" >&2
    exit 1
    ;;
esac

/usr/bin/time -p rm -f "$CAPTURE_DIR/final-desktop.png" "$CAPTURE_DIR/final-mobile.png"

# Wait for a real rendered shell instead of the initial blank document.
export CAPTURE_READY_SELECTOR="${CAPTURE_READY_SELECTOR:-.app}"
# This app has no gameplay start control; avoid clicking unrelated tab buttons.
export CAPTURE_AUTO_START="${CAPTURE_AUTO_START:-false}"

# default-capture owns its browser, handles transient navigation/browser errors
# as exit 75, and closes the browser before returning.
set +e
/usr/bin/time -p node "${RUNTIME_DIR:?}/scripts/default-capture.mjs"
capture_status=$?
set -e

if [[ "$capture_status" -eq 75 ]]; then
  exit 75
fi
if [[ "$capture_status" -ne 0 ]]; then
  exit 1
fi

# A missing, truncated, wrong-sized, or blank capture is a rendering defect.
/usr/bin/time -p node -e '
const fs = require("fs");
const path = require("path");
const dir = process.argv[1];
const expected = { "final-desktop.png": [1440, 900], "final-mobile.png": [390, 844] };
let failed = false;
for (const [name, [width, height]] of Object.entries(expected)) {
  const file = path.join(dir, name);
  try {
    const data = fs.readFileSync(file);
    const signature = data.subarray(0, 8).toString("hex");
    if (signature !== "89504e470d0a1a0a") throw new Error("not a PNG");
    if (data.readUInt32BE(16) !== width || data.readUInt32BE(20) !== height) {
      throw new Error(`expected ${width}x${height}, got ${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`);
    }
    if (data.length < 10000) throw new Error(`suspiciously small (${data.length} bytes)`);
    console.log(`${name}: ${width}x${height}, ${data.length} bytes`);
  } catch (error) {
    console.error(`${name}: ${error.message}`);
    failed = true;
  }
}
if (failed) process.exit(1);
' "$CAPTURE_DIR"

echo "Captured $CAPTURE_URL to $CAPTURE_DIR"
