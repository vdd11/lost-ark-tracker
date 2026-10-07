"""Import raid clears from LOA Logs: a preview to review, never automatic.

The frontend applies the clears the user keeps with the normal completion
endpoint, so gold, the 3-raid limit and Undo all work as usual.
"""

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import loa_logs
from database import get_db
from models import Character, Completion, RaidDifficulty, Task
from raids import CATALOG
from resets import utc_now, week_of, weekly_reset_before
from routes.common import to_naive_utc
from schemas import LoaClear, LoaLogsPath, LoaPreview, LoaPreviewRequest

router = APIRouter(prefix="/api")


@router.get("/loa-logs/default-path", response_model=LoaLogsPath)
def get_default_path():
    path = loa_logs.default_path()
    return LoaLogsPath(path=str(path) if path else None, exists=bool(path and path.is_file()))


def task_names(db: Session) -> dict[int, list[str]]:
    """Each raid's names LOA Logs might use: its own, and catalog legacy names."""
    legacy = {item.key: item.legacy_names for item in CATALOG}
    raids = db.query(Task).filter(Task.category == "raid", Task.archived.is_(False))
    return {task.id: [task.name, *legacy.get(task.catalog_key or "", [])] for task in raids}


@router.post("/loa-logs/preview", response_model=LoaPreview)
def preview(request: LoaPreviewRequest, db: Session = Depends(get_db)):
    """Clears in LOA Logs this week (since the last import), matched to
    characters and raids, with anything unmatched listed for the user."""
    path = Path(request.path) if request.path else loa_logs.default_path()
    if path is None:
        raise HTTPException(status_code=400, detail="Set the path to LOA Logs' encounters.db in Settings.")

    now = utc_now()
    week_start = weekly_reset_before(now)
    # The browser sends the last import with a timezone; the app works in naive UTC.
    since = max(to_naive_utc(request.since) if request.since else week_start, week_start)
    try:
        encounters = loa_logs.read_cleared(path, since)
    except loa_logs.LoaLogsError as error:
        raise HTTPException(status_code=400, detail=str(error))

    raid_map = loa_logs.read_raid_map(path)
    suggested = loa_logs.suggest_mapping(raid_map, task_names(db))
    # The user's own choices win; 0 means "not a raid clear, ignore it".
    mapping = {**suggested, **(request.mapping or {})}
    # Which gate each boss is; an earlier gate's boss belongs to the raid its last gate maps to.
    gates_of = loa_logs.boss_gates(raid_map)
    raid_tasks = {gates_of[boss][0]: task_id for boss, task_id in mapping.items() if boss in gates_of and gates_of[boss][2]}

    tasks = {task.id: task for task in db.query(Task).filter(Task.category == "raid")}
    difficulties: dict[int, list[RaidDifficulty]] = {}
    for difficulty in db.query(RaidDifficulty).filter(RaidDifficulty.task_id.in_(tasks)):
        difficulties.setdefault(difficulty.task_id, []).append(difficulty)
    characters = {c.name.casefold(): c for c in db.query(Character)}
    period = week_of(now)
    done = {
        (character_id, task_id)
        for character_id, task_id in db.query(Completion.character_id, Completion.task_id).filter(Completion.period == period)
    }

    clears: dict[tuple, LoaClear] = {}
    # Per character and raid: {gate: difficulty_id}, and whether its last gate was cleared.
    gates_cleared: dict[tuple, dict[int, int | None]] = {}
    finished: set[tuple] = set()
    unknown_bosses: set[str] = set()
    unknown_players: set[str] = set()
    for encounter in encounters:
        raid, gate, last = gates_of.get(encounter.boss, (None, None, False))
        task_id = mapping.get(encounter.boss)
        if task_id is None and raid is not None and not last:
            task_id = raid_tasks.get(raid)
        if task_id is None:
            if raid is None:
                unknown_bosses.add(encounter.boss)
            continue
        if task_id == 0 or task_id not in tasks:
            continue
        character = characters.get((encounter.player or "").casefold())
        if character is None:
            if encounter.player:
                unknown_players.add(encounter.player)
            continue
        task = tasks[task_id]
        difficulty = next(
            (
                d
                for d in difficulties.get(task.id, [])
                if encounter.difficulty and d.name.casefold() == encounter.difficulty.casefold()
            ),
            None,
        )
        key = (character.id, task.id)
        if gate is not None:
            # Once the raid is done, a later fight of an earlier gate changes nothing.
            if key in finished and not last:
                continue
            gates_cleared.setdefault(key, {})[gate] = difficulty.id if difficulty else None
            if last:
                finished.add(key)
        # Several clears of one raid in a week: the latest wins (they all pay at most once).
        clears[key] = LoaClear(
            fight_start=encounter.fight_start,
            boss=encounter.boss,
            difficulty=encounter.difficulty,
            character_id=character.id,
            character_name=character.name,
            task_id=task.id,
            task_name=task.name,
            difficulty_id=difficulty.id if difficulty else None,
            already_done=(character.id, task.id) in done,
        )

    for key, clear in clears.items():
        task = tasks[clear.task_id]
        gates = gates_cleared.get(key)
        if not gates or not task.gate_count:
            continue  # no gate data: the whole raid, as before
        if key in finished:
            # The last gate means the whole raid: gates not logged ran at the last gate's difficulty.
            last_difficulty = gates[max(gates)]
            gates = {g: gates.get(g, last_difficulty) for g in range(1, task.gate_count + 1)}
            if len(set(gates.values())) == 1:
                continue  # all at one difficulty: a plain whole clear
        clear.gates = gates

    return LoaPreview(
        path=str(path),
        since=since,
        clears=sorted(clears.values(), key=lambda c: c.fight_start),
        unknown_bosses=sorted(unknown_bosses),
        unknown_players=sorted(unknown_players),
        suggested_mapping=suggested,
        raid_map_found=raid_map is not None,
    )
