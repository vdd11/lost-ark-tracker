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
  - Ebony Cube has a run counter for the character's own unlock (Kurzan Front /
    Chaos Rift tickets); the details popover counts lower unlocks from guild
    shop boxes. Haal's
    Hourglass (1730+) a weekly checkbox at Lv1/Lv2. Click the tier label to
    log Sands of Trial, lucky rooms and mega lucky rooms.
- **Rest bonus**: Chaos Dungeon and Guardian Raid cells show each character's
  rest gauge, highlighted in gold when a rested run is available today. Click
  the number to match it to the game.
- **Raids**: Act 4, The Final Day, Serca and Horizon Cathedral, with each
  difficulty's item level and gold, and which of your characters qualify.
  - Built-in values update with the app unless you've edited them.
  - Each character is paid for 3 raids a week.
  - Gold is split into tradeable, roster-bound (half of Serca Normal) and
    character-bound (Cathedral), on the tracker and the Gold page.
  - Tick "+ bonus" on a cleared raid when you buy its bonus ("View More")
    chests. Like the game, they're paid from that character's
    character-bound gold first, then roster-bound, then tradeable. The
    tracker's top-right box shows the tradeable and roster-bound gold left;
    each character's row shows its character-bound gold left. Act 4 and The Final Day
    costs are built in; enter Serca's and Cathedral's on the Raids page.
  - The **Events** tab adds limited-time raids (e.g. "Act 3 Extreme"). Pick
    the raid, check the pre-filled difficulties, done. Events are one clear
    per roster, pay any character, and disappear when they end.
- **Gold**: log Field Boss, Chaos Gate, Fate Ember, etc., and chart weekly gold
  (raid clears + logged gold).
  - **Gold on hand**: once a week (or whenever you like), enter how much
    tradeable, roster-bound and character-bound gold you have. The app
    compares it with your last check-in plus everything it tracked since, so
    you see how much went to things it doesn't track (honing, the market, ...)
    without logging each one. The tracker reminds you after the weekly reset.
- **Gems**: Ebony Cube and Haal's Hourglass gems are counted from the tracker
  using each tier's reward table (editable on the Gems page). Log Guardian
  Raid and Field Boss drops by hand. Weekly chart and per-character totals in
  terms of what your gems combine into (3 of a level make the next, so 15 Lv1
  gems are a Lv3 + 2× Lv2).
- **Export**: "Export CSV" on the Gold and Gems pages downloads your full
  history for a spreadsheet.
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

Everything stays on your computer. There are no accounts and none of your data is sent anywhere. The only
network request is a check of this repo's latest GitHub release, which shows "Update available" in the menu
when there's a newer version.
Your data is saved here:

| System  | Location |
|---------|----------|
| Windows | `%APPDATA%\LostArkTracker\database.db` |
| macOS   | `~/Library/Application Support/LostArkTracker/database.db` |
| Linux   | `~/.local/share/lost-ark-tracker/database.db` |

Each day you open the app it also saves a copy in a `backups` folder next to
`database.db` (the last 10 days are kept). To restore one, close the app and
copy it over `database.db`. **Settings → Download backup** gives you a file
that restores your data on another computer, or after a reinstall.

**First-run warnings.** The downloads aren't code-signed, so:
- **Windows** SmartScreen may say "Windows protected your PC". Click
  *More info → Run anyway*.
- **macOS**: run `chmod +x LostArkTracker-macos && xattr -d com.apple.quarantine LostArkTracker-macos`
  once in Terminal, then open it (or right-click → Open).
- **Linux**: `chmod +x LostArkTracker-linux` once, then run it.

**If it won't start or something breaks,** the window says so and stays open.
The details are in `tracker.log` in the same data folder, so send that file to
whoever's helping. If the database itself got damaged, close the app and copy
the newest file from `backups` over `database.db`.

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
