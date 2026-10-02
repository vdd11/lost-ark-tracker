# Lost Ark Tracker

A roster tracker for Lost Ark: check off dailies, weeklies, and raids per
character, mark characters you're saving for friends, and log gold from
non-raid sources to see your weekly gold over time.

- **Tracker**: characters × tasks grid that resets on its own at the daily
  reset (10:00 UTC) and weekly reset (Wednesday 10:00 UTC).
  - Raid cells show the difficulty and gold, and you can change the difficulty
    right in the cell.
  - Raids a character qualifies for but doesn't usually run show faded, so you
    can tick an extra clear.
  - Ebony Cube has a run counter at each character's unlock tier.
- **Rest bonus**: Chaos Dungeon and Guardian Raid cells show each character's
  rest gauge, highlighted in gold when a rested run is available today. Click
  the number to match it to the game.
- **Raids**: Act 4, The Final Day, Serca and Horizon Cathedral, with each
  difficulty's item level and gold, and which of your characters qualify.
  - Built-in values update with the app unless you've edited them.
  - Each character is paid for 3 raids a week.
  - The **Events** tab adds limited-time raids (e.g. "Act 3 Extreme"). Pick
    the raid, check the pre-filled difficulties, done. Events are one clear
    per roster, pay any character, and disappear when they end.
- **Gold**: log Field Boss, Chaos Gate, Fate Ember, etc., and chart weekly gold
  (raid clears + logged gold).
- **Gems**: log gem drops by level from Ebony Cube, Guardian Raids and Field
  Bosses, and chart weekly gems in level-1 equivalents (Lv2 = 3, Lv3 = 9).
- **Settings**: add characters (their usual raids are pre-selected from item
  level), edit daily/weekly columns, and download/restore backups.

## Using it

1. Download the file for your system from the
   [latest release](../../releases/latest):
   - Windows: `LostArkTracker-windows.exe`
   - macOS: `LostArkTracker-macos`
   - Linux: `LostArkTracker-linux`
2. Run it. A small window opens and the tracker appears in your browser at
   <http://127.0.0.1:8777>. Keep that window open while you use it; close it
   to stop. Running it again while it's open just reopens the browser tab.
3. First time: add your characters in **Settings**. Their usual raids are
   picked from item level, and you can adjust them before adding.

Everything stays on your computer. There are no accounts and nothing is sent anywhere.
Your data is saved here:

| System  | Location |
|---------|----------|
| Windows | `%APPDATA%\LostArkTracker\database.db` |
| macOS   | `~/Library/Application Support/LostArkTracker/database.db` |
| Linux   | `~/.local/share/lost-ark-tracker/database.db` |

Use **Settings → Download backup** now and then. The same file restores your
data on another computer, or after a reinstall.

**First-run warnings.** The downloads aren't code-signed, so:
- **Windows** SmartScreen may say "Windows protected your PC". Click
  *More info → Run anyway*.
- **macOS**: run `chmod +x LostArkTracker-macos && xattr -d com.apple.quarantine LostArkTracker-macos`
  once in Terminal, then open it (or right-click → Open).
- **Linux**: `chmod +x LostArkTracker-linux` once, then run it.

Options: `--port 9000` to use another port, `--no-browser` to skip opening a
tab, `--data-dir PATH` to keep the database somewhere else.

## Development

Backend (FastAPI + SQLite), from `backend/`:

```sh
python -m venv .venv
.venv\Scripts\activate        # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn main:app --reload     # API at http://127.0.0.1:8000/api
python -m pytest              # tests
```

Frontend (Next.js), from `frontend/`:

```sh
npm install
npm run dev                   # http://localhost:3000, talks to the API above
```

In development the database is `backend/database.db`, separate from the
packaged app's. To move data between them, use Settings → Download backup in
one and Restore in the other.

### Building the app

With the backend venv active, from the repo root:

```sh
python build.py               # exports the frontend, then packages dist/LostArkTracker(.exe)
```

PyInstaller only builds for the system it runs on. To publish downloads for
all three systems, bump `APP_VERSION` in `backend/version.py`, then push a
version tag:

```sh
git tag v1.1.0
git push origin v1.1.0
```

The Release workflow builds Windows, macOS and Linux binaries and attaches them
to a GitHub release. The CI workflow runs tests, lint, and a build on every
push to `main` and on pull requests.
