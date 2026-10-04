# Lost Ark Tracker

A roster tracker for Lost Ark: check off dailies, weeklies, and raids per
character, across one or more game accounts, and log gold from non-raid
sources to see your weekly gold over time.

- **Tracker**: three cards, by how often things reset.
  - **This week**: raids and Haal's Hourglass (1730+), reset Wednesday 10:00
    UTC. Each raid shows a checkbox, a difficulty dropdown, and once cleared a
    "Bonus box" button. Raids a character can enter but doesn't usually run
    show faded, so an extra clear can be ticked.
  - **Today**: Chaos Dungeon (and Guardian Raid if you turn it on), reset
    daily at 10:00 UTC.
  - **Any time**: Ebony Cube run counters for the character's own unlock
    (Kurzan Front / Chaos Rift tickets); the unlock button counts lower unlocks
    from guild shop boxes and lucky rooms.
  - **Customize** starts from a play style (Just raids, Raids + dailies, or
    Everything), then lets you tick every card, column, gold box and menu
    page on or off, and tuck away characters who are done (saved per
    browser). The top boxes count gold raids left and log other gold in one
    step. Optional widgets chart the past month of gold, project a gold goal
    (from your last check-in) and show when your tracked gems add up to the
    next Lv9 / Lv10. More you can turn on under Customize: a **reset
    clock** (next daily and weekly reset in your time and UTC) and
    **counters** you keep by hand (collectibles, tokens, reputation: a name,
    a number, an optional target and +1 / −1, for a character, an account or
    everyone), and **raid groups** for your statics (raid, time, members,
    some of them other players): each shows which of your characters in it
    still need the raid this week. A **Lost Ark updates** widget shows live NA/EU server
    status and official announcements, with the official X accounts
    (@LAGameStatus, @playlostark) a tab away. **Edit who does what** sets each
    character's usual raids and tasks; the pencil by an item level updates it.
  - **What's left** switches the cards to a list of only unfinished tasks per
    character, richest first, with one-click ticks and **Copy as text** for
    Discord.
  - **All** beside a character ticks off everything they have left in that
    card. After the Wednesday reset, a recap shows last week's gold, gems and
    any gold raids left unrun.
  - On a phone or narrow window, each character gets a stacked block instead
    of a wide table.
  - Mistakes can be undone from the toast that follows a tick, "All" or a
    delete. Press **?** for keyboard shortcuts: arrows move between cells,
    Space ticks, `a` marks a character done, `g` then a letter jumps pages.
  - Optional **reminders** (Settings) nudge you a few hours before the weekly
    reset if gold raids are left, and before the daily reset if a rest gauge is
    full. They come as browser notifications (or a banner) while the app is open.
- **Import clears from LOA Logs** (opt-in, Settings): if you run the LOA Logs
  DPS meter (Windows/Linux), the tracker reads the raids it saw you clear this
  week, read-only, matches bosses to raids and names to characters, and ticks
  the ones you keep after you review them (with Undo).
- **Suggest my gold setup** (Settings) picks, per account, the 6 gold earners
  and each one's 3 best-paying raids and difficulties, shows the gain against
  your current setup, and applies it in one click (with Undo). Bound gold can
  count fully, half, or not at all.
- **Tools** (`g` `o`): planners that use your own characters and gold.
  - **Prices**: market prices you type in from the game (price and bundle
    size per item, with when you last updated it), used by the other tools to
    value materials. Add your own items; hide or reset any. Nothing is looked
    up online: the community price site (lostarkmarket.online) now redirects
    to an unrelated site, so there's no price fetch.
  - **Honing planner**: pick a character and a target item level, then enter
    each upgrade with the numbers your in-game honing panel shows (chance,
    any increase per failure or guaranteed attempt, gold, silver and
    materials per try) and what you already own. It shows the cost as a
    range (good luck, typical, unlucky), how many weeks your own average
    income takes to pay for it (choose whether bound gold counts), a "what if
    I earned more" slider, and which character reaches their goal first.
    Nothing about honing is built in, since the rules change with patches.
    Saved plans show a progress line on the tracker; "Log this honing"
    records the spending. Honing fees use the character's bound gold first,
    then roster-bound, then tradeable, like the game.
  - **Astrogem cutting**: keep it beside the game while you process a gem.
    Set the gem's levels, attempts and refreshes, click the 4 options the game
    shows, and it says **process**, **refresh** or **stop** (goal met, or out
    of reach), with your chance of reaching the goal (total points, plus
    minimum levels if you want) and the gold it'll take. Click the option the
    game applied (or press 1-4; r = refresh used, u = undo, f = finish).
    A session log counts gems, grades and gold, and "Log as spending" adds it
    to the Gold page. Odds are Smilegate's official table (one of the 4 shown
    options is applied, 25% each); every number is editable, with Reset.
- **Guides** (`g` `u`): a short, hand-picked list of guides, calculators
  and databases (Maxroll, the official patch notes, honing and astrogem
  calculators, LOA Logs, lostark.bible, ...), searchable and grouped by
  category. Add your own links (your guild's Discord, a creator you follow),
  hide built-in ones and bring them back. Links open in your browser; the
  tracker loads nothing from them. On a phone or narrow window the menu shows
  icons, with the current page's name.
- **Paste a roster** (Settings): add many characters at once from pasted
  lines of name, class and item level, in any order (typed, or copied from a
  spreadsheet or a roster page). It previews what it read, skips duplicates,
  and makes the highest item levels gold earners. Nothing is looked up online.
- **Accounts**: play more than one account? Add accounts in Settings and put
  each character on one. Each account is its own roster (up to 6 gold earners,
  its own event clears, its own gold and check-ins). The tracker, Gold and
  Gems pages get a switcher to view one account or all of them.
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
    per account, pay any character, and disappear when they end.
- **Gold**: log Field Boss, Chaos Gate, Fate Ember, etc., and chart weekly gold
  (raid clears + logged gold). **By source** shows what each source (raids,
  Chaos Gate, ...) paid this week, over the last 4 weeks and per week on
  average. A **weekly history** grid shows each character's paid
  gold raids and gold over the last 8 weeks. An **auction calculator** gives the break-even and
  recommended bid for a raid drop (4 or 8 players, with or without the 5%
  market fee).
  - **Gold on hand**: once a week (or whenever you like), enter how much
    tradeable, roster-bound and character-bound gold you have. The app
    compares it with your last check-in plus everything it tracked since, so
    you see how much went to things it doesn't track (honing, the market, ...)
    without logging each one. The tracker reminds you after the weekly reset.
  - **Spending**: log gold you spent (honing, gems, market, other) with an
    optional character and note. Check-ins subtract it, so "untracked" is only
    what you didn't log. Market purchases come out of tradeable gold; the rest
    uses the character's bound gold first, then roster-bound, then tradeable
    (or choose tradeable only). Totals for the last 30 days; CSV export.
- **Gems**: Ebony Cube and Haal's Hourglass gems are counted from the tracker
  using each tier's reward table (editable on the Gems page). Log Guardian
  Raid and Field Boss drops by hand. Weekly chart and per-character totals in
  terms of what your gems combine into (3 of a level make the next, so 15 Lv1
  gems are a Lv3 + 2× Lv2).
- **Export**: "Export CSV" on the Gold and Gems pages downloads your full
  history for a spreadsheet; the spending log, prices and honing plans have
  their own exports.
- **Settings**: add characters (their usual raids are pre-selected from item
  level), edit daily/weekly columns, and download/restore backups.

## Using it

1. Download the file for your system from the
   [latest release](../../releases/latest):
   - Windows: `LostArkTracker-windows.exe`
   - macOS: `LostArkTracker-macos`
   - Linux: `LostArkTracker-linux`
2. Run it. The tracker appears in your browser at <http://127.0.0.1:8777>.
   - **Windows:** it runs from a gold "LA" icon in the system tray (near the
     clock). Right-click it to open the tracker, your data folder or the log,
     or to **Quit**. If something goes wrong, a message box says so.
   - **macOS / Linux:** a terminal window opens; keep it open while you use
     the tracker and close it to stop.

   Running it again while it's open just reopens the browser tab.
3. First time: add your characters in **Settings**. Their usual raids are
   picked from item level, and you can adjust them before adding.

Everything stays on your computer. There are no accounts and none of your data is sent anywhere. See
[Privacy and network](#privacy-and-network) for the few optional things that go online.

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

**First-run warnings.** The downloads aren't code-signed (what that would take: `docs/signing.md`), so:
- **Windows** SmartScreen may say "Windows protected your PC". Click
  *More info → Run anyway*.
- **macOS**: run `chmod +x LostArkTracker-macos && xattr -d com.apple.quarantine LostArkTracker-macos`
  once in Terminal, then open it (or right-click → Open).
- **Linux**: `chmod +x LostArkTracker-linux` once, then run it.

**Updating.** With the update check on, the nav shows *Update available*
when there's a new release; click it for what's new, the download for your
system and the steps: quit the tracker, replace the old file with the new one,
run it. Your data stays where it is (above), so nothing is lost. The first run
after an update says so, with a link to what changed. The app doesn't download
or replace itself: unsigned files that swap themselves out are exactly what
antivirus tools flag (see `docs/signing.md`).

**If it won't start or something breaks,** a message box says so (Windows), or
the terminal window says so and stays open (macOS / Linux).
The details are in `tracker.log` in the same data folder, so send that file to
whoever's helping. If the database itself got damaged, close the app and copy
the newest file from `backups` over `database.db`.

Options: `--port 9000` to use another port, `--no-browser` to skip opening a
tab, `--data-dir PATH` to keep the database somewhere else.

## Privacy and network

Your roster, clears, gold and check-ins are stored only in the database on
your computer and are never uploaded. The app makes exactly these internet
requests, and only these:

| What | Contacts | When | Default |
|------|----------|------|---------|
| Update check | `api.github.com` (this repo's latest release, its notes and download links) | Once per browser session | Asked on first launch; existing users keep it on |
| Lost Ark updates widget | `www.playlostark.com` (server status page) and `api.steampowered.com` (Lost Ark news), fetched by the app | When the widget is on screen, then every 10 minutes while the tracker is open | Off |
| The widget's "On X" tab | `platform.twitter.com` / `x.com` (X's embed) | Only after you open that tab | Off (the widget is off) |

The optional **LOA Logs import** (Settings) only reads that meter's
`encounters.db` on your computer, read-only, when you click Import clears;
it never goes online.

Turn each one on or off in **Settings → Online features** (the widget also
in **Customize**). Links you click (patch notes, the status page) open in
your browser as usual. Fonts and everything else ship inside the app.

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
python scripts/smoke_test.py dist/LostArkTracker.exe   # starts it and checks the API and page
```

CI builds and smoke-tests the Linux binary on every push; the Release
workflow smoke-tests all three before attaching them.

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
