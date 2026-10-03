# Lost Ark Tracker

FastAPI + SQLAlchemy + SQLite backend in `backend/`, Next.js 16 + Tailwind 4
frontend in `frontend/` (see `frontend/AGENTS.md`: read the bundled Next docs
before using unfamiliar Next APIs).

Shipped as one executable: the frontend is a static export (`output: "export"`,
so no server components with dynamic data, rewrites, or route handlers), served
by FastAPI alongside the API. `backend/app.py` is the packaged entry point;
`build.py` runs PyInstaller. All API routes live under `/api`.

- Backend: `main.py` sets up the app; endpoints live in `routes/<area>.py`
  (one router each, all under `/api`). Domain logic stays out of routes:
  `raids.py` (catalog), `rest.py`, `gems.py`, `resets.py`.
- Backend checks: `cd backend && .venv/Scripts/python -m ruff check . && .venv/Scripts/python -m pytest -q`
- Frontend checks: `cd frontend && npm test && npx tsc --noEmit && npm run lint && npm run build`
  (vitest covers the pure logic in `lib/`; keep component-free code there)
- Package: `backend/.venv/Scripts/python build.py` → `dist/LostArkTracker.exe`
- Reset logic lives in `backend/resets.py` (naive UTC everywhere). Completions
  are stored per reset period, never cleared, and double as gold history.
- Schema changes: add new model columns with a `server_default` so
  `add_missing_columns()` can upgrade existing databases. New tables must also
  be added to `BACKUP_MODELS` in `routes/backup.py`.
- Never touch `backend/database.db` or the user's app-data database in tests;
  set `DATABASE_URL` (or `--data-dir` for the exe) instead.
- Raids and Ebony Cube come from the catalog in `backend/raids.py`, synced on
  startup. Only add numbers from official NA patch notes or the user. Use
  `None` for unknown gold. Values a user edited are never overwritten. Keep
  `legacy_names` when renaming so existing columns are adopted.
- Event raids (Extreme) are user-created via `/api/event-raids`, not
  cataloged: they're tasks with `ends_on`, `roster_limited` and
  `gold_for_everyone`.
- Accounts (`accounts.py`): each character has an `account_id`; an account is
  a roster, so "roster-limited" and the 6-gold-earner limit are per account.
  `ensure_accounts()` runs on startup and after a restore.
- `news.py` fetches server status (playlostark.com) and Steam announcements,
  cached 10 minutes, using certifi's certificates. Tests never hit the network:
  monkeypatch `news.fetch_text`.
- Version lives in `backend/version.py`; releases are cut by pushing a `v*` tag.
- Commit style: conventional commits (`feat:`, `fix:`, `chore:`).
