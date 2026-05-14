#!/bin/bash
set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null || true)

if ! echo "$COMMAND" | grep -qE 'git\s+push'; then
  exit 0
fi

REPO_ROOT=$(git -C /workspaces/tenbou rev-parse --show-toplevel)
cd "$REPO_ROOT"

echo "▶ Pre-push CI checks..."

echo "  [1/3] Lint & Format"
if ! pnpm exec biome ci .; then
  echo "✗ Lint/Format check failed. Fix before pushing." >&2
  exit 2
fi

echo "  [2/3] Build"
if ! PUBLIC_API_URL=https://tenbou-backend.mijinko.workers.dev pnpm build; then
  echo "✗ Build failed. Fix before pushing." >&2
  exit 2
fi

echo "  [3/3] Tests"
if ! pnpm test; then
  echo "✗ Tests failed. Fix before pushing." >&2
  exit 2
fi

echo "✓ All checks passed."
exit 0
