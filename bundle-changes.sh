#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

BUNDLE="${BUNDLE_FILE:-nebuchadnezzar-changes.bundle}"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Not a git repository. Aborting."
  exit 1
fi

UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || true)"
if [ -z "$UPSTREAM" ]; then
  UPSTREAM="origin/$(git rev-parse --abbrev-ref HEAD)"
fi

if ! git rev-parse "$UPSTREAM" >/dev/null 2>&1; then
  echo "Cannot find upstream $UPSTREAM. Set an upstream or adjust BUNDLE_BASE."
  exit 1
fi

echo "Bundling commits from $UPSTREAM..HEAD into $BUNDLE"
git bundle create "$BUNDLE" "$UPSTREAM"..HEAD
echo "Bundle written to $BUNDLE"
