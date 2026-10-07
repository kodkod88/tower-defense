#!/usr/bin/env bash
# TeammateIdle hook: keep a teammate working if it is about to go idle while the project is broken.
# Exit 2 = send stderr as feedback and keep the teammate working.
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
cat >/dev/null # consume hook JSON on stdin

if ! output=$(npm run check --silent 2>&1); then
  {
    echo "Don't go idle yet: \`npm run check\` is failing. If the failure is in your area, fix it. If it's in another teammate's area, message that owner (see CLAUDE.md) with the error, then you may stop."
    echo "$output" | tail -25
  } >&2
  exit 2
fi
exit 0
