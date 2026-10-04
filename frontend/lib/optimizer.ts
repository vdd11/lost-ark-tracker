import { Character, Difficulty, MAX_GOLD_EARNERS, Task } from "./api";
import { byAccount, difficultyOf, GOLD_RAIDS_PER_WEEK, isActiveRaid } from "./raids";

/**
 * "Suggest my gold setup": per account, the gold earners and each one's raids
 * and difficulties that pay the most per week.
 *
 * Greedy is exact here. A character's raids don't affect anyone else's (each
 * runs their own clears, up to 3 paid), so a character's best value is just
 * their 3 best raids at the best difficulty they can enter; the account's best
 * is then its 6 best characters by that value. Event raids pay anyone and
 * don't use a slot, so they're left out.
 */

/** How much bound gold counts next to tradeable gold: all of it, half, or none. */
export type BoundValue = 1 | 0.5 | 0;
export const BOUND_VALUES: { value: BoundValue; label: string }[] = [
  { value: 1, label: "Counts fully" },
  { value: 0.5, label: "Counts half" },
  { value: 0, label: "Doesn't count" },
];

export type RaidPick = {
  task: Task;
  difficulty: Difficulty;
  /** Gold the clear pays (0 if unknown). */
  gold: number;
  /** Gold weighted by how much its bound part counts. */
  value: number;
  unknownGold: boolean;
};

/** A difficulty's weekly value: tradeable gold, plus bound gold at `boundValue`. */
export function difficultyValue(difficulty: Difficulty, boundValue: BoundValue) {
  const gold = difficulty.gold ?? 0;
  const bound = (gold * difficulty.bound_percent) / 100;
  return gold - bound + bound * boundValue;
}

function pick(task: Task, difficulty: Difficulty, boundValue: BoundValue): RaidPick {
  return {
    task,
    difficulty,
    gold: difficulty.gold ?? 0,
    value: difficultyValue(difficulty, boundValue),
    unknownGold: difficulty.gold === null,
  };
}

const goldRaids = (tasks: Task[]) => tasks.filter((t) => isActiveRaid(t) && !t.gold_for_everyone && t.difficulties.length > 0);
const byValue = (a: RaidPick, b: RaidPick) => b.value - a.value || b.gold - a.gold;
const total = (picks: RaidPick[]) => picks.reduce((sum, p) => sum + p.value, 0);

/** The 3 raids paying a character the most, each at its best difficulty they can enter. */
export function bestPicks(character: Character, tasks: Task[], boundValue: BoundValue): RaidPick[] {
  return goldRaids(tasks)
    .map((task) =>
      task.difficulties
        .filter((d) => d.min_item_level <= character.item_level)
        .map((d) => pick(task, d, boundValue))
        .sort(byValue)[0],
    )
    .filter((p): p is RaidPick => Boolean(p) && p.value > 0)
    .sort(byValue)
    .slice(0, GOLD_RAIDS_PER_WEEK);
}

/** What a character is set up to earn now: their usual raids (best 3), if they're a gold earner. */
export function currentPicks(character: Character, tasks: Task[], boundValue: BoundValue): RaidPick[] {
  if (!character.is_gold_earner) return [];
  return goldRaids(tasks)
    .filter((task) => character.task_ids.includes(task.id))
    .flatMap((task) => {
      const difficulty = difficultyOf(character, task);
      return difficulty ? [pick(task, difficulty, boundValue)] : [];
    })
    .sort(byValue)
    .slice(0, GOLD_RAIDS_PER_WEEK);
}

export type SetupRow = {
  character: Character;
  earnerNow: boolean;
  earnerSuggested: boolean;
  current: RaidPick[];
  suggested: RaidPick[];
  currentValue: number;
  suggestedValue: number;
  /** Anything to change for this character. */
  changed: boolean;
};

export type AccountSetup = { accountId: number; rows: SetupRow[]; currentValue: number; suggestedValue: number };

const sameRaids = (a: RaidPick[], b: RaidPick[]) =>
  a.length === b.length && a.every((p) => b.some((q) => q.difficulty.id === p.difficulty.id));

/** The suggested gold setup for every account, next to the current one. */
export function suggestGoldSetup(characters: Character[], tasks: Task[], boundValue: BoundValue): AccountSetup[] {
  return byAccount(characters).map((roster) => {
    const ranked = roster
      .map((character) => ({ character, best: bestPicks(character, tasks, boundValue) }))
      // Ties keep current earners, then roster order, so nothing changes for no gain.
      .sort(
        (a, b) =>
          total(b.best) - total(a.best) ||
          Number(b.character.is_gold_earner) - Number(a.character.is_gold_earner) ||
          a.character.position - b.character.position ||
          a.character.id - b.character.id,
      );
    const earners = new Set(ranked.filter((r) => total(r.best) > 0).slice(0, MAX_GOLD_EARNERS).map((r) => r.character.id));
    const rows = ranked.map(({ character, best }): SetupRow => {
      const earnerSuggested = earners.has(character.id);
      const current = currentPicks(character, tasks, boundValue);
      const suggested = earnerSuggested ? best : [];
      return {
        character,
        earnerNow: character.is_gold_earner,
        earnerSuggested,
        current,
        suggested,
        currentValue: total(current),
        suggestedValue: total(suggested),
        changed: character.is_gold_earner !== earnerSuggested || (earnerSuggested && !sameRaids(current, best)),
      };
    });
    return {
      accountId: roster[0].account_id,
      rows,
      currentValue: rows.reduce((sum, r) => sum + r.currentValue, 0),
      suggestedValue: rows.reduce((sum, r) => sum + r.suggestedValue, 0),
    };
  });
}

export type Change = { method: "PATCH" | "PUT" | "DELETE"; path: string; body?: object };

/**
 * API calls that apply a row: the gold earner flag, and for an earner, their
 * usual gold raids set to exactly the suggested ones. Non-earners keep their
 * raids (they may still run them).
 */
export function applyChanges(row: SetupRow, tasks: Task[]): Change[] {
  const { character } = row;
  const changes: Change[] = [];
  if (row.earnerNow !== row.earnerSuggested) {
    changes.push({ method: "PATCH", path: `/characters/${character.id}`, body: { is_gold_earner: row.earnerSuggested } });
  }
  if (!row.earnerSuggested) return changes;
  for (const { task, difficulty } of row.suggested) {
    if (difficultyOf(character, task)?.id !== difficulty.id || !character.task_ids.includes(task.id)) {
      changes.push({ method: "PUT", path: `/characters/${character.id}/tasks/${task.id}`, body: { difficulty_id: difficulty.id } });
    }
  }
  for (const task of goldRaids(tasks)) {
    if (character.task_ids.includes(task.id) && !row.suggested.some((p) => p.task.id === task.id)) {
      changes.push({ method: "DELETE", path: `/characters/${character.id}/tasks/${task.id}` });
    }
  }
  return changes;
}

/** The calls that put a row back the way it was (for Undo). */
export function undoChanges(row: SetupRow, tasks: Task[]): Change[] {
  const { character } = row;
  return applyChanges(row, tasks).map((change): Change => {
    if (change.method === "PATCH") {
      return { method: "PATCH", path: change.path, body: { is_gold_earner: row.earnerNow } };
    }
    const taskId = Number(change.path.split("/").at(-1));
    const before = character.difficulty_ids[String(taskId)];
    return character.task_ids.includes(taskId)
      ? { method: "PUT", path: change.path, body: { difficulty_id: before ?? null } }
      : { method: "DELETE", path: change.path };
  });
}
