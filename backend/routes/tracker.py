"""Check-offs for the current reset period, run details and rest bonus."""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from database import get_db
from gems import run_gems
from models import Character, CharacterTask, Completion, RaidDifficulty, Task
from resets import daily_reset_before, period_for, utc_now, weekly_reset_before
from schemas import (
    CompletionUpdate,
    EmberWeek,
    RestState,
    Run,
    RestUpdate,
    TrackerState,
)
from raids import FREE_BONUS_RAIDS_PER_WEEK, GOLD_RAIDS_PER_WEEK
from rest import RestRules, rest_at_start_of, run_is_rested, start_value_for_shown
from routes.common import get_or_404
from routes.characters import choose_difficulty

router = APIRouter(prefix="/api")


@router.get("/tracker", response_model=TrackerState)
def get_tracker(db: Session = Depends(get_db)):
    now = utc_now()
    daily_reset = daily_reset_before(now)
    weekly_reset = weekly_reset_before(now)

    rows = (
        db.query(Completion, Task.category)
        .join(Task, Task.id == Completion.task_id)
        .filter(Completion.character_id.is_not(None))
        .filter(Completion.period >= weekly_reset.date())
        .all()
    )
    current = [c for c, category in rows if c.period == period_for(category, now)]
    completed = [(c.character_id, c.task_id) for c in current]
    runs = [
        Run(
            character_id=c.character_id,
            task_id=c.task_id,
            difficulty_id=c.difficulty_id,
            count=c.count,
            lucky_rooms=c.lucky_rooms,
            mega_rooms=c.mega_rooms,
            sands=c.sands,
            fate_embers=c.fate_embers,
            blessed_embers=c.blessed_embers,
            bought_bonus=c.bought_bonus,
            bonus_spent=c.bonus_spent,
            tier_counts={int(k): v for k, v in c.tier_counts.items()} if c.tier_counts else None,
            gates={int(k): v for k, v in c.gates.items()} if c.gates else None,
            gems=c.gems,
        )
        for c in current
    ]

    embers: dict[int, EmberWeek] = {}
    for c, _ in rows:
        if c.fate_embers or c.blessed_embers:
            week = embers.setdefault(c.character_id, EmberWeek(character_id=c.character_id, fate=0, blessed=0))
            week.fate += c.fate_embers
            week.blessed += c.blessed_embers

    return TrackerState(
        daily_period=daily_reset.date(),
        weekly_period=weekly_reset.date(),
        next_daily_reset=daily_reset + timedelta(days=1),
        next_weekly_reset=weekly_reset + timedelta(days=7),
        completed=completed,
        runs=runs,
        rest=current_rest(db, daily_reset.date()),
        embers=list(embers.values()),
    )


def rules_for(task: Task) -> RestRules:
    return RestRules(max=task.rest_max, gain=task.rest_gain, cost=task.rest_cost)


def current_rest(db: Session, today) -> list[RestState]:
    tasks = {task.id: task for task in db.query(Task).filter(Task.rest_max > 0)}
    if not tasks:
        return []

    assignments = db.query(CharacterTask).filter(CharacterTask.task_id.in_(tasks)).all()
    completed_days: dict[tuple[int, int], set] = {}
    for character_id, task_id, period in (
        db.query(Completion.character_id, Completion.task_id, Completion.period)
        .filter(Completion.task_id.in_(tasks), Completion.character_id.is_not(None))
    ):
        completed_days.setdefault((character_id, task_id), set()).add(period)

    states = []
    for assignment in assignments:
        rules = rules_for(tasks[assignment.task_id])
        days = completed_days.get((assignment.character_id, assignment.task_id), set())

        if assignment.rest_period is None:
            # Nothing entered yet: start tracking from an empty gauge today.
            start = 0
        else:
            start = rest_at_start_of(today, assignment.rest_value, assignment.rest_period, days, rules)
        start = min(start, rules.max)  # in case the max was lowered
        # Move the anchor up to today. Past days can't be unchecked anymore,
        # so this loses nothing and keeps the replay short.
        assignment.rest_value, assignment.rest_period = start, today

        done_today = today in days
        rested = run_is_rested(start, rules)
        states.append(RestState(
            character_id=assignment.character_id,
            task_id=assignment.task_id,
            value=start - rules.cost if done_today and rested else start,
            rested_run_available=rested and not done_today,
        ))

    db.commit()
    return states


@router.put("/characters/{character_id}/tasks/{task_id}/rest", status_code=204)
def set_rest(character_id: int, task_id: int, update: RestUpdate, db: Session = Depends(get_db)):
    """Sync the gauge with the game: `value` is what the game shows right now."""
    assignment = db.get(CharacterTask, (character_id, task_id))
    if assignment is None:
        raise HTTPException(status_code=404, detail="Character doesn't do this task")
    task = get_or_404(db, Task, task_id)
    rules = rules_for(task)
    if not rules.enabled:
        raise HTTPException(status_code=400, detail="This task has no rest bonus")

    today = daily_reset_before(utc_now()).date()
    done_today = (
        db.query(Completion)
        .filter_by(character_id=character_id, task_id=task_id, period=today)
        .first()
        is not None
    )
    assignment.rest_value = start_value_for_shown(update.value, done_today, rules)
    assignment.rest_period = today
    db.commit()

    return Response(status_code=204)


@router.put("/characters/{character_id}/tasks/{task_id}/completion", status_code=204)
def complete_task(
    character_id: int,
    task_id: int,
    body: CompletionUpdate | None = None,
    db: Session = Depends(get_db),
):
    """Check a task off, or update this period's run (difficulty, run count).

    Works for raids the character doesn't usually run, so extra clears count.
    """
    character = get_or_404(db, Character, character_id)
    task = get_or_404(db, Task, task_id)
    body = body or CompletionUpdate()

    now = utc_now()
    period = period_for(task.category, now)
    existing = (
        db.query(Completion)
        .filter_by(character_id=character_id, task_id=task_id, period=period)
        .first()
    )

    tiers = counted_tiers(db, task, character, existing, body) if task.counted else None
    gates = cleared_gates_after(db, task, character, existing, body)
    # With tiers, the week's entry goes only when every tier is back to zero;
    # with gates, when every gate is un-cleared.
    if (sum(tiers.values()) == 0) if tiers is not None else (body.count == 0 or gates == {}):
        if existing is not None:
            db.delete(existing)
            db.commit()
        return Response(status_code=204)

    if task.roster_limited:
        other = (
            db.query(Character.name)
            .join(Completion, Completion.character_id == Character.id)
            .filter(
                Completion.task_id == task_id,
                Completion.period == period,
                Character.id != character_id,
                # Once per roster: each account gets its own clear.
                Character.account_id == character.account_id,
            )
            .first()
        )
        if other is not None:
            raise HTTPException(status_code=409, detail=f"{task.name} was already cleared this week by {other.name}")

    details = body.model_dump(include={"lucky_rooms", "mega_rooms", "sands", "fate_embers", "blessed_embers"}, exclude_none=True)
    if existing is None:
        existing = Completion(
            character_id=character_id,
            task_id=task_id,
            period=period,
            completed_at=now,
            difficulty_id=run_difficulty(db, task, character, body.difficulty_id),
            count=body.count or 1,
            bought_bonus=bool(body.bought_bonus),
            bonus_bought_at=now if body.bought_bonus else None,
            **details,
        )
        if tiers is not None:
            existing.tier_counts, existing.count = tier_json(tiers), sum(tiers.values())
        if gates is not None:
            store_gates(existing, task, gates)
        db.add(existing)
        db.flush()
        price_completion(db, character, task, existing)
        existing.gems = completion_gems(db, task, existing)
    else:
        changed = bool(details) or body.count is not None or tiers is not None
        if tiers is not None:
            existing.tier_counts, existing.count = tier_json(tiers), sum(tiers.values())
        elif body.count is not None:
            existing.count = body.count
        for field, value in details.items():
            setattr(existing, field, value)
        if body.bought_bonus is not None and body.bought_bonus != existing.bought_bonus:
            existing.bought_bonus = body.bought_bonus
            existing.bonus_bought_at = now if body.bought_bonus else None
            existing.bonus_spent = bonus_spent(db, existing)
            db.flush()
            reprice_bonuses(db, character, existing.period)
        # Only a different difficulty, or a gate cleared or un-cleared, re-prices
        # a clear; history stays as recorded.
        if gates is not None:
            store_gates(existing, task, gates)
            price_completion(db, character, task, existing)
            changed = True
        elif body.difficulty_id is not None and (body.difficulty_id != existing.difficulty_id or existing.gates):
            # A difficulty for the whole raid clears every gate at it.
            existing.difficulty_id = run_difficulty(db, task, character, body.difficulty_id)
            existing.gates = None
            price_completion(db, character, task, existing)
            changed = True
        if changed:
            existing.gems = completion_gems(db, task, existing)
    db.commit()

    return Response(status_code=204)


def counted_tiers(
    db: Session, task: Task, character: Character, existing: Completion | None, body: CompletionUpdate
) -> dict[int, int] | None:
    """Runs per tier for counted tasks after this update, or None if untouched.

    `count` sets the character's own tier (Kurzan Front / Chaos Rift tickets);
    `tier_counts` sets any tier the character can enter (guild shop tickets).
    """
    if body.count is None and body.tier_counts is None:
        return None
    own = run_difficulty(db, task, character, None)
    tiers = {int(k): v for k, v in ((existing.tier_counts or {}) if existing else {}).items()}
    if existing is not None and not existing.tier_counts and own is not None:
        tiers = {own: existing.count}  # runs recorded before tiers existed
    if body.tier_counts is not None:
        allowed = {
            d.id for d in db.query(RaidDifficulty).filter_by(task_id=task.id)
            if d.min_item_level <= character.item_level or d.id == own
        }
        if not set(body.tier_counts) <= allowed:
            raise HTTPException(status_code=400, detail=f"{character.name} can't run that {task.name} tier")
        tiers.update(body.tier_counts)
    if body.count is not None and own is not None:
        tiers[own] = body.count
    return {tier: runs for tier, runs in tiers.items() if runs > 0}


def cleared_gates(task: Task, completion: Completion | None) -> dict[int, int | None]:
    """{gate: difficulty_id} for the gates a clear covers (all of them for a whole clear)."""
    if completion is None:
        return {}
    if completion.gates:
        return {int(gate): difficulty for gate, difficulty in completion.gates.items()}
    return {gate: completion.difficulty_id for gate in range(1, task.gate_count + 1)}


def cleared_gates_after(
    db: Session, task: Task, character: Character, existing: Completion | None, body: CompletionUpdate
) -> dict[int, int | None] | None:
    """The gates cleared after this update, or None when it doesn't touch gates."""
    if not task.gate_count or body.gates is None:
        return None
    if not set(body.gates) <= set(range(1, task.gate_count + 1)):
        raise HTTPException(status_code=400, detail=f"{task.name} has {task.gate_count} gates")
    gates = cleared_gates(task, existing)
    for gate, difficulty_id in body.gates.items():
        if difficulty_id == 0:
            gates.pop(gate, None)
        else:
            gates[gate] = run_difficulty(db, task, character, difficulty_id)
    return gates


def store_gates(completion: Completion, task: Task, gates: dict[int, int | None]):
    """Every gate at one difficulty is a whole clear (gates None); anything else is kept per gate."""
    first = gates[min(gates)]
    if len(gates) == task.gate_count and all(d == first for d in gates.values()):
        completion.gates = None
        completion.difficulty_id = first
    else:
        completion.gates = {str(gate): difficulty for gate, difficulty in sorted(gates.items())}
        completion.difficulty_id = first


def tier_json(tiers: dict[int, int]) -> dict[str, int]:
    return {str(tier): runs for tier, runs in sorted(tiers.items())}


def bonus_spent(db: Session, completion: Completion) -> int:
    """What the bonus chests cost: the difficulty's price, except that a
    non-earner's first FREE_BONUS_RAIDS_PER_WEEK raids with bonus chests each
    week are free (per the user, 2026-10-04)."""
    if not completion.bought_bonus or completion.difficulty_id is None:
        return 0
    character = db.get(Character, completion.character_id) if completion.character_id else None
    if character is not None and not character.is_gold_earner:
        earlier = [c for c in bonus_purchases(db, character.id, completion.period) if c.id != completion.id]
        before = [c for c in earlier if purchase_order(c) < purchase_order(completion)]
        if len(before) < FREE_BONUS_RAIDS_PER_WEEK:
            return 0
    if completion.gates:
        # Bonus chests come with the gates cleared, each at its difficulty's price.
        task = db.get(Task, completion.task_id)
        return sum(gate_share(db, gate, difficulty_id, "gate_bonus") for gate, difficulty_id in cleared_gates(task, completion).items())
    difficulty = db.get(RaidDifficulty, completion.difficulty_id)
    return (difficulty.bonus_cost or 0) if difficulty else 0


def gate_share(db: Session, gate: int, difficulty_id: int | None, per_gate: str) -> int:
    """One gate's gold (or bonus cost) at a difficulty: from the per-gate table,
    else 0 when only the total is known (an unknown split pays nothing yet)."""
    difficulty = db.get(RaidDifficulty, difficulty_id) if difficulty_id else None
    if difficulty is None:
        return 0
    values = getattr(difficulty, per_gate)
    if values and len(values) >= gate:
        return values[gate - 1] or 0
    return 0


def bonus_purchases(db: Session, character_id: int, period) -> list[Completion]:
    """A character's raid clears this period with bonus chests bought, in order."""
    rows = (
        db.query(Completion)
        .join(Task, Task.id == Completion.task_id)
        .filter(
            Completion.character_id == character_id,
            Completion.period == period,
            Completion.bought_bonus.is_(True),
            Task.category == "raid",
        )
        .all()
    )
    return sorted(rows, key=purchase_order)


def purchase_order(completion: Completion):
    # Older clears may have no purchase time; their clear time stands in.
    return (completion.bonus_bought_at or completion.completed_at, completion.id)


def reprice_bonuses(db: Session, character: Character, period):
    """Recount which of a non-earner's bonus chests are free after one changes."""
    if character.is_gold_earner:
        return
    for completion in bonus_purchases(db, character.id, period):
        completion.bonus_spent = bonus_spent(db, completion)


def run_difficulty(db: Session, task: Task, character: Character, requested: int | None) -> int | None:
    """The requested difficulty, else the usual one, else the best for the item level."""
    if requested is None:
        assignment = db.get(CharacterTask, (character.id, task.id))
        if assignment is not None and assignment.difficulty_id is not None:
            return assignment.difficulty_id
    return choose_difficulty(db, task, character, requested)


def completion_gems(db: Session, task: Task, completion: Completion):
    difficulty = db.get(RaidDifficulty, completion.difficulty_id) if completion.difficulty_id else None
    tiers = {d.id: d for d in db.query(RaidDifficulty).filter_by(task_id=task.id)} if task.counted else None
    return run_gems(task, difficulty, completion, tiers)


def price_completion(db: Session, character: Character, task: Task, completion: Completion):
    """Snapshot a clear's gold, how much of it is bound (and to what), and the
    cost of any bonus chests bought."""
    completion.gold = completion_gold(db, character, task, completion)
    if completion.gates and completion.gold:
        # Each gate is bound like its own difficulty (partly bound raids: the same share on every gate).
        completion.bound_gold = completion.character_bound_gold = 0
        for gate, difficulty_id in cleared_gates(task, completion).items():
            difficulty = db.get(RaidDifficulty, difficulty_id) if difficulty_id else None
            if difficulty is None:
                continue
            bound = round(gate_share(db, gate, difficulty_id, "gate_gold") * difficulty.bound_percent / 100)
            completion.bound_gold += bound
            if difficulty.bound_kind == "character":
                completion.character_bound_gold += bound
    else:
        difficulty = db.get(RaidDifficulty, completion.difficulty_id) if completion.difficulty_id else None
        percent = difficulty.bound_percent if difficulty else 0
        completion.bound_gold = round(completion.gold * percent / 100)
        character_bound = difficulty is not None and difficulty.bound_kind == "character"
        completion.character_bound_gold = completion.bound_gold if character_bound else 0
    completion.bonus_spent = bonus_spent(db, completion)


def completion_gold(db: Session, character: Character, task: Task, completion: Completion) -> int:
    """Gold a clear pays right now, snapshotted onto the completion."""
    gold = task.gold
    if completion.gates:
        # Some gates, or gates at different difficulties: each gate's own gold.
        gold = sum(gate_share(db, gate, d, "gate_gold") for gate, d in cleared_gates(task, completion).items())
    elif completion.difficulty_id is not None:
        difficulty = db.get(RaidDifficulty, completion.difficulty_id)
        gold = (difficulty.gold or 0) if difficulty else 0

    if task.gold_for_everyone:
        return gold
    if not character.is_gold_earner:
        return 0

    if task.category == "raid":
        paid_raids_this_week = (
            db.query(Completion)
            .join(Task, Task.id == Completion.task_id)
            .filter(
                Completion.character_id == character.id,
                Completion.period == completion.period,
                Completion.id != completion.id,
                Completion.gold > 0,
                Task.category == "raid",
                Task.gold_for_everyone.is_(False),
            )
            .count()
        )
        if paid_raids_this_week >= GOLD_RAIDS_PER_WEEK:
            return 0
    return gold


@router.delete("/characters/{character_id}/tasks/{task_id}/completion", status_code=204)
def uncomplete_task(character_id: int, task_id: int, db: Session = Depends(get_db)):
    task = get_or_404(db, Task, task_id)
    period = period_for(task.category, utc_now())

    db.query(Completion).filter_by(
        character_id=character_id, task_id=task_id, period=period
    ).delete()
    character = db.get(Character, character_id)
    if character is not None and task.category == "raid":
        db.flush()
        reprice_bonuses(db, character, period)  # a later chest may be free now
    db.commit()

    return Response(status_code=204)
