"""LOA Logs import, against small databases shaped like LOA Logs' own (built
here; nothing is read from a real install)."""

import json
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta, timezone

import pytest

import loa_logs
from tests.test_raids import NOW, add_character, task_named

WEEK_START = datetime(2026, 9, 30, 10)  # NOW's weekly reset


def ms(moment: datetime) -> int:
    return int(moment.replace(tzinfo=timezone.utc).timestamp() * 1000)


def make_db(path, rows, *, legacy=False):
    """rows: (fight_start, boss, difficulty, player, cleared)."""
    with closing(sqlite3.connect(path)) as db:
        if legacy:
            # The oldest layout: everything on `encounter`, the clear flag in misc JSON.
            db.execute("CREATE TABLE encounter (id INTEGER PRIMARY KEY, fight_start INTEGER, current_boss TEXT, local_player TEXT, misc TEXT)")
            db.executemany(
                "INSERT INTO encounter (fight_start, current_boss, local_player, misc) VALUES (?, ?, ?, ?)",
                [(ms(at), boss, player, json.dumps({"raidClear": cleared})) for at, boss, _, player, cleared in rows],
            )
        else:
            db.execute("CREATE TABLE encounter (id INTEGER PRIMARY KEY, misc TEXT)")
            db.execute(
                "CREATE TABLE encounter_preview (id INTEGER PRIMARY KEY, fight_start INTEGER, current_boss TEXT, duration INTEGER, "
                "players TEXT, difficulty TEXT, local_player TEXT, my_dps INTEGER, favorite BOOLEAN NOT NULL DEFAULT 0, cleared BOOLEAN, "
                "boss_only_damage BOOLEAN NOT NULL DEFAULT 0)"
            )
            db.executemany(
                "INSERT INTO encounter_preview (fight_start, current_boss, difficulty, local_player, cleared) VALUES (?, ?, ?, ?, ?)",
                [(ms(at), boss, difficulty, player, cleared) for at, boss, difficulty, player, cleared in rows],
            )
        db.commit()
    return path


def write_raid_map(folder):
    meter = folder / "meter-data"
    meter.mkdir()
    (meter / "encounters.json").write_text(json.dumps({
        "Serca": {"Serca G1": ["Witch of Agony, Serca"], "Serca G2": ["Corvus Tul Rak"]},
        "Act 4: Armoche": {"Act 4: Armoche G1": ["Brelshaza, Ember in the Ashes"], "Act 4: Armoche G2": ["Armoche, Sentinel of the Abyss"]},
    }), encoding="utf-8")


def test_reads_cleared_fights_since_a_time_read_only(tmp_path):
    path = make_db(tmp_path / "encounters.db", [
        (WEEK_START - timedelta(hours=1), "Corvus Tul Rak", "Hard", "Bardy", 1),  # last week
        (WEEK_START + timedelta(hours=2), "Witch of Agony, Serca", "Hard", "Bardy", 1),
        (WEEK_START + timedelta(hours=3), "Corvus Tul Rak", "Hard", "Bardy", 0),  # a wipe
        (WEEK_START + timedelta(hours=4), "Corvus Tul Rak", "Hard", "Bardy", 1),
    ])
    clears = loa_logs.read_cleared(path, WEEK_START)
    assert [(c.boss, c.fight_start) for c in clears] == [
        ("Witch of Agony, Serca", WEEK_START + timedelta(hours=2)),
        ("Corvus Tul Rak", WEEK_START + timedelta(hours=4)),
    ]
    with closing(loa_logs.connect_readonly(path)) as db, pytest.raises(sqlite3.OperationalError, match="readonly"):
        db.execute("DELETE FROM encounter_preview")


def test_reads_the_oldest_layout(tmp_path):
    path = make_db(tmp_path / "old.db", [(WEEK_START + timedelta(hours=1), "Corvus Tul Rak", None, "Bardy", True)], legacy=True)
    [clear] = loa_logs.read_cleared(path, WEEK_START)
    assert (clear.boss, clear.player, clear.difficulty) == ("Corvus Tul Rak", "Bardy", None)


def test_explains_what_it_cant_read(tmp_path):
    with pytest.raises(loa_logs.LoaLogsError, match="No LOA Logs database"):
        loa_logs.read_cleared(tmp_path / "missing.db", WEEK_START)
    other = tmp_path / "other.db"
    with closing(sqlite3.connect(other)) as db:
        db.execute("CREATE TABLE notes (id INTEGER)")
    with pytest.raises(loa_logs.LoaLogsError, match="doesn't look like a LOA Logs database"):
        loa_logs.read_cleared(other, WEEK_START)
    odd = tmp_path / "odd.db"
    with closing(sqlite3.connect(odd)) as db:
        db.execute("CREATE TABLE encounter_preview (id INTEGER, current_boss TEXT)")
    with pytest.raises(loa_logs.LoaLogsError, match="no fight_start"):
        loa_logs.read_cleared(odd, WEEK_START)


def test_suggests_last_gate_bosses_by_raid_name(tmp_path):
    write_raid_map(tmp_path)
    raid_map = loa_logs.read_raid_map(tmp_path / "encounters.db")
    mapping = loa_logs.suggest_mapping(raid_map, {1: ["Serca", "Shadow Raid: Serca"], 2: ["Act 4", "Act 4: Armoche"]})
    assert mapping == {"Corvus Tul Rak": 1, "Armoche, Sentinel of the Abyss": 2}
    assert loa_logs.read_raid_map(tmp_path / "elsewhere" / "encounters.db") is None


def test_preview_matches_clears_to_characters_and_raids(client, set_now, tmp_path):
    set_now(NOW)
    serca, act4 = task_named(client, "Serca"), task_named(client, "Act 4")
    bardy = add_character(client, 1745, [{"task_id": serca["id"]}], name="Bardy")
    add_character(client, 1745, name="Slayer")
    client.put(f"/api/characters/{bardy['id']}/tasks/{act4['id']}/completion")  # already ticked

    write_raid_map(tmp_path)
    path = make_db(tmp_path / "encounters.db", [
        (WEEK_START + timedelta(hours=1), "Corvus Tul Rak", "Hard", "bardy", 1),
        (WEEK_START + timedelta(hours=2), "Armoche, Sentinel of the Abyss", "Normal", "Bardy", 1),
        (WEEK_START + timedelta(hours=3), "Some Field Boss", "Normal", "Slayer", 1),
        (WEEK_START + timedelta(hours=3), "Witch of Agony, Serca", "Hard", "Bardy", 1),  # gate 1: not a clear
        (WEEK_START + timedelta(hours=4), "Corvus Tul Rak", "Hard", "Stranger", 1),
    ])

    preview = client.post("/api/loa-logs/preview", json={"path": str(path)}).json()
    assert [(c["character_name"], c["task_name"], c["difficulty"], c["already_done"]) for c in preview["clears"]] == [
        ("Bardy", "Serca", "Hard", False),
        ("Bardy", "Act 4", "Normal", True),
    ]
    serca_hard = next(d["id"] for d in serca["difficulties"] if d["name"] == "Hard")
    assert preview["clears"][0]["difficulty_id"] == serca_hard
    assert preview["unknown_bosses"] == ["Some Field Boss"]
    assert preview["unknown_players"] == ["Stranger"]
    assert preview["raid_map_found"] is True

    # The user maps the field boss away; a later "since" skips what was imported.
    again = client.post("/api/loa-logs/preview", json={
        "path": str(path), "mapping": {"Some Field Boss": 0}, "since": (WEEK_START + timedelta(hours=3)).isoformat(),
    }).json()
    assert again["clears"] == [] and again["unknown_bosses"] == []

    # The browser's last-import time comes with a timezone ("...Z").
    aware = client.post("/api/loa-logs/preview", json={"path": str(path), "since": "2026-09-30T11:30:00.000Z"})
    assert aware.status_code == 200 and [c["task_name"] for c in aware.json()["clears"]] == ["Act 4"]

    bad = client.post("/api/loa-logs/preview", json={"path": str(tmp_path / "nope.db")})
    assert bad.status_code == 400 and "No LOA Logs database" in bad.json()["detail"]
