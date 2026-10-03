"""Gem arithmetic: tables are {level: count} with string keys (JSON), and
counts may be averages, so everything here works in floats."""

from models import Completion, RaidDifficulty, Task

Gems = dict[str, float]


def lv1_equivalent(level: int, count: float) -> float:
    """Gems combine 3 to 1, so a level-n gem is worth 3^(n-1) level-1 gems."""
    return count * 3 ** (level - 1)


def total_lv1(gems: Gems | None) -> float:
    return sum(lv1_equivalent(int(level), count) for level, count in (gems or {}).items())


def add_gems(total: Gems, gems: Gems | None, times: float = 1):
    if not gems or not times:
        return
    for level, count in gems.items():
        total[str(level)] = round(total.get(str(level), 0) + count * times, 3)


def run_gems(
    task: Task,
    difficulty: RaidDifficulty | None,
    completion: Completion,
    tiers: dict[int, RaidDifficulty] | None = None,
) -> Gems | None:
    """Expected gems for one period's run from the tier reward tables.

    Runs (cube tickets, per tier) and Sands of Trial multiply the base reward;
    lucky rooms use the character's own tier and aren't multiplied by tickets.
    """
    if difficulty is None:
        return None
    multiplier = 1 + completion.sands if task.sand_scaled else 1

    gems: Gems = {}
    if task.counted and completion.tier_counts and tiers:
        for tier_id, runs in completion.tier_counts.items():
            tier = tiers.get(int(tier_id))
            if tier is not None:
                add_gems(gems, tier.reward_gems, runs * multiplier)
    else:
        runs = completion.count if task.counted else 1
        add_gems(gems, difficulty.reward_gems, runs * multiplier)
    add_gems(gems, difficulty.lucky_gems, completion.lucky_rooms)
    add_gems(gems, difficulty.mega_gems, completion.mega_rooms)
    return gems or None
