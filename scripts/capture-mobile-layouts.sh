#!/usr/bin/env bash
# Codex, 2026-11-28. Run only outside the managed agent sandbox, against npm start.
# MEDBOT_BROWSER_BIN may be an installed Chrome/Chromium executable. No npm packages required.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
mobile_browser="${MEDBOT_BROWSER_BIN:-chromium}"
mobile_base="${MEDBOT_BASE_URL:-http://localhost:3000}"
mobile_output="$PWD/docs/review/mobile"
mobile_profile=$(mktemp -d)
trap 'rm -r -- "$mobile_profile"' EXIT
mkdir -p "$mobile_output"
for mobile_size in 375x812 390x844; do
  for mobile_page in interview learning review evidence offline; do
    case "$mobile_page" in
      interview) mobile_route="/" ;;
      learning) mobile_route="/learning" ;;
      review) mobile_route="/learning/review" ;;
      evidence) mobile_route="/eval" ;;
      offline) mobile_route="/offline.html" ;;
    esac
    "$mobile_browser" --headless --no-first-run --no-default-browser-check \
      --user-data-dir="$mobile_profile" --force-device-scale-factor=1 \
      --window-size="${mobile_size/x/,}" --hide-scrollbars --virtual-time-budget=3000 \
      --screenshot="$mobile_output/$mobile_page-$mobile_size.png" "$mobile_base$mobile_route"
  done
done
printf 'Screenshots saved in %s\n' "$mobile_output"
