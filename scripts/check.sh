#!/usr/bin/env sh
# Every check CI runs, in one go: backend lint + tests, frontend tests, types,
# lint, the static build and the end-to-end tests. Run from anywhere: sh scripts/check.sh
set -e
cd "$(dirname "$0")/.."

if [ -x backend/.venv/Scripts/python ]; then PY=.venv/Scripts/python; else PY=.venv/bin/python; fi

echo "== backend: ruff + pytest"
(cd backend && "$PY" -m ruff check . && "$PY" -m pytest -q)

echo "== frontend: vitest, tsc, eslint, build"
(cd frontend && npm test && npx tsc --noEmit && npm run lint && npm run build)

echo "== frontend: end-to-end (Playwright, installed Chrome)"
(cd frontend && npm run e2e)

# next build rewrites this file; it's never committed.
git checkout -- frontend/next-env.d.ts 2>/dev/null || true
echo "== all checks passed"
