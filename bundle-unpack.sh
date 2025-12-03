#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE="${BUNDLE_FILE:-nebuchadnezzar-changes.bundle}"

if [ ! -f "$BUNDLE" ]; then
  echo "Bundle file not found: $BUNDLE"
  exit 1
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Not a git repository. Aborting."
  exit 1
fi

branch="$(git bundle list-heads "$BUNDLE" | awk '{print $2}' | head -n1 | sed 's|refs/heads/||')"
if [ -z "$branch" ]; then
  branch="main"
fi

echo "Applying bundle $BUNDLE onto branch $branch ..."
git pull "$BUNDLE" "$branch"
echo "Done."
