#!/usr/bin/env bash
# Codex, 2026-11-28. Run outside the managed sandbox against npm start with a funded key.
# Uses an existing browser installation; installs no packages and does not read environment files.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
mode_browser="${MEDBOT_BROWSER_BIN:-chromium}"
mode_base="${MEDBOT_BASE_URL:-http://localhost:3000}"
mode_output="$PWD/docs/review/interview-modes"
mode_profile=$(mktemp -d)
trap 'rm -r -- "$mode_profile"' EXIT
mkdir -p "$mode_output"
for mode_size in 375x812 1280x900; do
  "$mode_browser" --headless --no-first-run --no-default-browser-check \
    --user-data-dir="$mode_profile" --force-device-scale-factor=1 \
    --window-size="${mode_size/x/,}" --hide-scrollbars --virtual-time-budget=3000 \
    --screenshot="$mode_output/picker-$mode_size.png" "$mode_base/"
done
printf 'Picker screenshots saved in %s. Complete the live walkthrough in docs/interview-modes-handoff.md.\n' "$mode_output"
