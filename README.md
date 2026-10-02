# Lost Ark Tracker

A roster tracker for Lost Ark: check off dailies, weeklies, and raids per
character, mark characters you're saving for friends, and log gold from
non-raid sources to see your weekly gold over time.

- **Tracker** (`/`): characters × tasks grid. Cells reset on their own at the
  daily reset (10:00 UTC) and weekly reset (Wednesday 10:00 UTC). Use
  "Choose tasks per character" to pick which raids each character runs.
- **Gold** (`/gold`): log Field Boss, Chaos Gate, Fate Ember, etc., and chart
  weekly gold (raid clears + logged gold).
- **Settings** (`/settings`): add/edit characters and task columns. Set each
  raid's current gold value here; only gold-earner characters count toward
  raid gold.

## Running locally

Backend (FastAPI + SQLite), from `backend/`:

```sh
python -m venv .venv
.venv\Scripts\activate        # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload     # http://127.0.0.1:8000
```

Frontend (Next.js), from `frontend/`:

```sh
npm install
npm run dev                   # http://localhost:3000
```

Set `NEXT_PUBLIC_API_URL` if the API isn't at `http://127.0.0.1:8000`.

## Tests

```sh
cd backend && .venv\Scripts\python -m pytest
```

## Data

Everything lives in `backend/database.db` (git-ignored). New columns are added
to an existing database automatically on startup. Back the file up if your
history matters to you.
