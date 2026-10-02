# Lost Ark Tracker

FastAPI + SQLAlchemy + SQLite backend in `backend/`, Next.js 16 + Tailwind 4
frontend in `frontend/` (see `frontend/AGENTS.md`: read the bundled Next docs
before using unfamiliar Next APIs).

- Backend tests: `cd backend && .venv/Scripts/python -m pytest -q`
- Frontend checks: `cd frontend && npx tsc --noEmit && npm run lint`
- Reset logic lives in `backend/resets.py` (naive UTC everywhere). Completions
  are stored per reset period, never cleared, and double as gold history.
- Schema changes: add new model columns with a `server_default` so
  `add_missing_columns()` can upgrade existing databases.
- Never touch `backend/database.db` in tests; set `DATABASE_URL` instead.
- Commit style: conventional commits (`feat:`, `fix:`, `chore:`).
