"""Read raid clears from LOA Logs (github.com/snoww/loa-logs), the DPS meter
many players run. Opt-in, local only, and strictly read-only: its database is
opened with SQLite's `mode=ro` and never written.

What LOA Logs keeps (as of its 2026 source):
- `encounters.db`: next to `LOA Logs.exe` on Windows; on Linux in
  ~/.local/share/xyz.snow.loa-logs/. (LOA Logs doesn't run on macOS.)
- One row per fight in `encounter_preview` (older versions: `encounter`):
  `fight_start` (Unix ms), `current_boss`, `difficulty` ("Normal", "Hard", ...),
  `local_player` (the character who logged it) and `cleared`. Very old
  versions only had the clear flag in the `misc` JSON (`raidClear`).
- `meter-data/encounters.json` next to the exe: raid -> gate -> boss names,
  e.g. {"Serca": {"Serca G1": [...], "Serca G2": ["Corvus Tul Rak"]}}. Each
  gate's boss clears that gate; a boss of the last gate clears the whole raid
  (earlier gates at the difficulty logged for them, else the last gate's).

Anything that doesn't match is reported, never guessed: the caller shows
unknown bosses and players and lets the user map them.
"""

import json
import os
import sqlite3
import stat
import sys
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

DATABASE_NAME = "encounters.db"
SQLITE_HEADER = b"SQLite format 3\x00"
# Years of logs make a database of a few GB; nothing this big is LOA Logs'.
MAX_DATABASE_BYTES = 20 * 1024**3
MAX_RAID_MAP_BYTES = 5 * 1024**2


class LoaLogsError(Exception):
    """Something about the LOA Logs database we can't work with, said plainly."""


@dataclass(frozen=True)
class Encounter:
    fight_start: datetime  # naive UTC, like the rest of the app
    boss: str
    difficulty: str | None
    player: str | None


def candidate_paths() -> list[Path]:
    """Where LOA Logs usually keeps its database on this system."""
    if sys.platform == "win32":
        local = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
        return [
            local / "LOA Logs" / DATABASE_NAME,
            local / "Programs" / "LOA Logs" / DATABASE_NAME,
            Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "LOA Logs" / DATABASE_NAME,
        ]
    if sys.platform.startswith("linux"):
        data_home = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
        return [data_home / "xyz.snow.loa-logs" / DATABASE_NAME]
    return []


def default_path() -> Path | None:
    candidates = candidate_paths()
    return next((p for p in candidates if p.is_file()), candidates[0] if candidates else None)


def is_network_path(path: Path) -> bool:
    r"""UNC paths (\\server\share, \\?\UNC\...), device paths (\\.\pipe\...)
    and, on Windows, mapped network drives."""
    text = str(path)
    if text.upper().startswith(("\\\\?\\UNC\\", "//?/UNC/")):
        return True
    # \\?\C:\... is just a long local path; any other \\ prefix is a share or a device.
    if text.startswith(("\\\\", "//")) and not text.startswith(("\\\\?\\", "//?/")):
        return True
    if sys.platform == "win32" and path.drive.endswith(":"):
        import ctypes

        DRIVE_REMOTE = 4
        return ctypes.windll.kernel32.GetDriveTypeW(f"{path.drive}\\") == DRIVE_REMOTE
    return False


def check_database_path(path: Path) -> Path:
    """The real path of a local, regular, SQLite file of sane size, or a
    LoaLogsError saying what's wrong. The path comes from the request, so
    nothing else (folders, devices, network shares, other files) is opened."""
    if is_network_path(path):
        raise LoaLogsError("LOA Logs' database has to be on this computer, not a network path.")
    try:
        resolved = path.resolve(strict=True)
        info = resolved.stat()
    except (OSError, RuntimeError):
        raise LoaLogsError(f"No LOA Logs database at {path}. Check the path in Settings.") from None
    if is_network_path(resolved):  # a link or mapped drive that leads to a share
        raise LoaLogsError("LOA Logs' database has to be on this computer, not a network path.")
    if stat.S_ISDIR(info.st_mode):
        raise LoaLogsError(f"{path} is a folder. Choose the {DATABASE_NAME} file inside LOA Logs' folder.")
    if not stat.S_ISREG(info.st_mode):
        raise LoaLogsError(f"{path} isn't a regular file.")
    if info.st_size > MAX_DATABASE_BYTES:
        raise LoaLogsError(f"{path} is too large to be LOA Logs' database.")
    try:
        with open(resolved, "rb") as file:
            header = file.read(len(SQLITE_HEADER))
    except OSError as error:
        raise LoaLogsError(f"Couldn't read {path}: {error.strerror or error}") from error
    if header != SQLITE_HEADER:
        raise LoaLogsError(f"{path} isn't a SQLite database. Choose LOA Logs' {DATABASE_NAME}.")
    return resolved


def connect_readonly(path: Path) -> sqlite3.Connection:
    """Open LOA Logs' database without any chance of writing to it."""
    path = check_database_path(path)
    uri = f"file:{quote(str(path).replace(os.sep, '/'))}?mode=ro"
    try:
        return sqlite3.connect(uri, uri=True)
    except sqlite3.Error as error:
        raise LoaLogsError(f"Couldn't open {path}: {error}") from error


def read_cleared(path: Path, since: datetime) -> list[Encounter]:
    """Cleared fights since `since` (naive UTC), newest last."""
    with closing(connect_readonly(path)) as connection:
        try:
            tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
            table = next((t for t in ("encounter_preview", "encounter") if t in tables), None)
            if table is None:
                raise LoaLogsError("This doesn't look like a LOA Logs database (no encounter table).")
            columns = {row[1] for row in connection.execute(f'PRAGMA table_info("{table}")')}
            missing = {"fight_start", "current_boss"} - columns
            if missing:
                raise LoaLogsError(
                    f"This LOA Logs version stores fights differently (no {', '.join(sorted(missing))}). "
                    "Update LOA Logs or report it."
                )
            if "cleared" in columns:
                clear = "cleared = 1"
            elif "misc" in columns:
                clear = "json_extract(misc, '$.raidClear') = 1"
            else:
                raise LoaLogsError("This LOA Logs version doesn't record which fights were clears.")
            difficulty = "difficulty" if "difficulty" in columns else "NULL"
            player = "local_player" if "local_player" in columns else "NULL"
            since_ms = int(since.replace(tzinfo=timezone.utc).timestamp() * 1000)
            rows = connection.execute(
                f'SELECT fight_start, current_boss, {difficulty}, {player} FROM "{table}" '
                f"WHERE {clear} AND fight_start >= ? ORDER BY fight_start",
                (since_ms,),
            ).fetchall()
        except sqlite3.Error as error:
            raise LoaLogsError(f"Couldn't read LOA Logs' database: {error}") from error

    return [
        Encounter(
            fight_start=datetime.fromtimestamp(start / 1000, tz=timezone.utc).replace(tzinfo=None),
            boss=boss,
            difficulty=difficulty_name,
            player=player_name,
        )
        for start, boss, difficulty_name, player_name in rows
        if boss
    ]


def read_raid_map(database: Path) -> dict[str, dict[str, list[str]]] | None:
    """LOA Logs' raid -> gate -> bosses table, if it's installed next to the database."""
    path = database.parent / "meter-data" / "encounters.json"
    try:
        if is_network_path(path) or not path.is_file() or path.stat().st_size > MAX_RAID_MAP_BYTES:
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    return {
        raid: {gate: [b for b in bosses if isinstance(b, str)] for gate, bosses in gates.items() if isinstance(bosses, list)}
        for raid, gates in data.items()
        if isinstance(gates, dict)
    }


def final_gate_bosses(raid_map: dict[str, dict[str, list[str]]]) -> dict[str, str]:
    """boss -> LOA Logs raid name, for the bosses of each raid's last gate."""
    bosses = {}
    for raid, gates in raid_map.items():
        if not gates:
            continue
        last_gate = sorted(gates)[-1]  # "Serca G1" < "Serca G2"
        for boss in gates[last_gate]:
            bosses[boss] = raid
    return bosses


def boss_gates(raid_map: dict[str, dict[str, list[str]]] | None) -> dict[str, tuple[str, int, bool]]:
    """boss -> (LOA Logs raid name, gate number from 1, whether it's the last gate)."""
    found = {}
    for raid, gates in (raid_map or {}).items():
        ordered = sorted(gates)  # "Serca G1" < "Serca G2"
        for number, gate in enumerate(ordered, start=1):
            for boss in gates[gate]:
                found[boss] = (raid, number, number == len(ordered))
    return found


def earlier_gate_bosses(raid_map: dict[str, dict[str, list[str]]] | None) -> set[str]:
    """Bosses of any gate but a raid's last: clearing them isn't a raid clear."""
    if not raid_map:
        return set()
    final = final_gate_bosses(raid_map)
    return {boss for gates in raid_map.values() for bosses in gates.values() for boss in bosses if boss not in final}


def suggest_mapping(raid_map: dict[str, dict[str, list[str]]] | None, task_names: dict[int, list[str]]) -> dict[str, int]:
    """boss -> task id, where a LOA Logs raid name matches one of a task's
    names (its name, or a catalog legacy name like "Act 4: Armoche")."""
    if not raid_map:
        return {}
    by_name = {name.casefold(): task_id for task_id, names in task_names.items() for name in names}
    return {
        boss: by_name[raid.casefold()]
        for boss, raid in final_gate_bosses(raid_map).items()
        if raid.casefold() in by_name
    }
