#!/usr/bin/env bash
# TaskCompleted hook: block marking a task complete unless `npm run check` passes.
# Exit 2 = prevent completion and send stderr back to the teammate as feedback.
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
cat >/dev/null # consume hook JSON on stdin

if ! output=$(npm run check --silent 2>&1); then
  {
    echo "Task NOT marked complete: \`npm run check\` failed. Fix the failures below, then mark the task completed again."
    echo "$output" | tail -40
  } >&2
  exit 2
fi
exit 0
