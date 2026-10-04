# Lost Ark Tracker

FastAPI + SQLAlchemy + SQLite backend in `backend/`, Next.js 16 + Tailwind 4
frontend in `frontend/` (see `frontend/AGENTS.md`: read the bundled Next docs
before using unfamiliar Next APIs).

Shipped as one executable: the frontend is a static export (`output: "export"`,
so no server components with dynamic data, rewrites, or route handlers), served
by FastAPI alongside the API. `backend/app.py` is the packaged entry point;
`build.py` runs PyInstaller. All API routes live under `/api`.

- The server has no login, so `hosts.py` refuses any request whose `Host`
  isn't `127.0.0.1`, `localhost` or `[::1]` (any port): DNS rebinding
  protection. Tests use `TestClient(main.app, base_url="http://127.0.0.1")`;
  the default `testserver` host gets 400.
- Backend: `main.py` sets up the app; endpoints live in `routes/<area>.py`
  (one router each, all under `/api`). Domain logic stays out of routes:
  `raids.py` (catalog), `rest.py`, `gems.py`, `resets.py`.
- All checks at once: `powershell -File scripts\check.ps1` (or `sh scripts/check.sh`).
- Backend checks: `cd backend && .venv/Scripts/python -m ruff check . && .venv/Scripts/python -m pytest -q`
- Frontend checks: `cd frontend && npm test && npx tsc --noEmit && npm run lint && npm run build`
  (vitest covers the pure logic in `lib/`; keep component-free code there.
  Interactive components have React Testing Library tests in
  `components/__tests__/`, which start with `// @vitest-environment jsdom`)
- The packaged Windows app is windowed (no console) and lives in the system
  tray (`backend/tray.py`, pystray + Pillow, Windows-only deps); errors go to a
  message box. `--no-tray` runs it console-style (the smoke test uses it).
- Package: `backend/.venv/Scripts/python build.py` → `dist/LostArkTracker.exe`,
  then `python scripts/smoke_test.py dist/LostArkTracker.exe` starts it and
  checks `/api/` and `/` (CI does this on Linux, releases on all three OSes).
- Reset logic lives in `backend/resets.py` (naive UTC everywhere). Completions
  are stored per reset period, never cleared, and double as gold history.
- Changing the database (details in `migrations.py`):
  - new column: give it a `server_default`; `add_missing_columns()` adds it.
  - new table: `create_all` makes it; also add it to `BACKUP_MODELS` in `backups.py`.
  - fill in or fix data: `run_once(db, "name", fn)` (from `migrations.py`) in `main.py`.
  - rename / retype / drop a column: `rebuild_table` in `SCHEMA_MIGRATIONS`
    (runs before `add_missing_columns`; check the old shape first so a new
    database is a no-op), plus a backup format step (below). Never edit a
    migration that has shipped; add a new one.
- Backups (`backups.py`): any change to backed-up data that old files can't
  just be read as (renamed/removed column, changed meaning) bumps
  `BACKUP_FORMAT`, adds an `upgrade_vN_to_vN+1` to `UPGRADES`, and commits a
  new fixture from `tests/fixtures/make_backup_fixture.py`. Keep old fixtures;
  their restore tests must keep passing.
- Never touch `backend/database.db` or the user's app-data database in tests;
  set `DATABASE_URL` (or `--data-dir` for the exe) instead.
- Raids and Ebony Cube come from the catalog in `backend/raids.py`, synced on
  startup. Only add numbers from official NA patch notes or the user. Use
  `None` for unknown gold. Values a user edited are never overwritten. Keep
  `legacy_names` when renaming so existing columns are adopted.
- Tools live under `app/tools/<tool>/` with their maths in `lib/<tool>.ts`
  and a card in `lib/tools.ts`. Market prices are user-entered (`MarketPrice`
  rows); `price_items.py` only names built-in items, each with a cited source.
  The honing planner (`lib/honing.ts`) has no game numbers at all: users
  enter chances and costs from their honing panel. Keep it that way unless
  the user supplies sourced values.
- Guides page links are data (`frontend/lib/data/guides.json`, with a
  `checked` date). Check new ones with `python scripts/check_links.py`; a
  weekly workflow (`links.yml`) runs it and opens an issue for dead links or
  links that now lead to another site. It's not part of the normal checks.
- Event raids (Extreme) are user-created via `/api/event-raids`, not
  cataloged: they're tasks with `ends_on`, `roster_limited` and
  `gold_for_everyone`.
- Accounts (`accounts.py`): each character has an `account_id`; an account is
  a roster, so "roster-limited" and the 6-gold-earner limit are per account.
  `ensure_accounts()` runs on startup and after a restore.
- `news.py` fetches server status (playlostark.com) and Steam announcements,
  cached 10 minutes, using certifi's certificates. Tests never hit the network:
  monkeypatch `news.fetch_text`.
- `loa_logs.py` reads LOA Logs' `encounters.db` strictly read-only (`mode=ro`)
  for the opt-in clear import; tests build their own small databases.
- Anything that goes online must be opt-in, off by default (see
  `frontend/lib/online.ts`), labeled in the UI, and listed in the README's
  "Privacy and network" table.
- Version lives in `backend/version.py`; releases are cut by pushing a `v*` tag,
  only when the user asks: follow `.claude/skills/release/SKILL.md` (notes
  drafted by `scripts/release_notes.py` become the annotated tag's message and
  the GitHub release body). Ask before pushing the tag.
- Commit style: conventional commits (`feat:`, `fix:`, `chore:`).
