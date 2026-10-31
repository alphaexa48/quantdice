#!/usr/bin/env bash
# Once-per-worker prerequisites for browser capture.
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  exit 0
fi

RUNTIME_ROOT="${RUNTIME_DIR:-/home/runner/work/_temp/omgithub-runtime}"
PLAYWRIGHT_ROOT="$HOME/.local/share/omgithub-playwright"
need_setup=false

[[ -x "$PLAYWRIGHT_ROOT/node_modules/.bin/playwright" ]] || need_setup=true
[[ -f "$PLAYWRIGHT_ROOT/linux.json" ]] || need_setup=true
[[ -s "$PLAYWRIGHT_ROOT/display" ]] || need_setup=true
if [[ -f "$PLAYWRIGHT_ROOT/xvfb.pid" ]] && kill -0 "$(cat "$PLAYWRIGHT_ROOT/xvfb.pid")" 2>/dev/null; then
  :
else
  need_setup=true
fi
if ! compgen -G "$HOME/.cache/ms-playwright/chromium-*/chrome-linux64/chrome" >/dev/null; then
  need_setup=true
fi

if [[ "$need_setup" == true ]]; then
  echo "Installing Playwright/Xvfb prerequisites for this worker."
  /usr/bin/time -p bash "$RUNTIME_ROOT/scripts/setup-linux-playwright.sh"
else
  echo "Playwright/Xvfb prerequisites already present."
fi
