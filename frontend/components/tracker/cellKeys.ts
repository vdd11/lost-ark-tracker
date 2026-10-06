import { TrackerData } from "@/components/tracker/useTrackerData";
import { Character, Task } from "@/lib/api";
import { dailyRunsNeeded } from "@/lib/blessings";
import { bestDifficulty, difficultyOf } from "@/lib/raids";
import { cellLabel } from "@/lib/shortcuts";
import { cellKey, isTiered } from "@/lib/trackerSections";
import { appliesTo } from "@/lib/trackerView";

export type CellKeyboard = {
  label: string;
  /** Space / Enter. */
  toggle?: () => void;
  /** + and − (run counters). */
  increment?: () => void;
  decrement?: () => void;
};

/**
 * What the keyboard does on a tracker cell, and what a screen reader hears.
 * Mirrors what the cell shows: a raid ticks at the difficulty in its dropdown
 * (this week's clear, else the usual one, else the best the character can enter).
 */
export function cellKeyboard(character: Character, task: Task, data: TrackerData, editMode: boolean): CellKeyboard {
  const { actions } = data;
  const key = cellKey(character.id, task.id);
  const run = data.runByCell.get(key);
  const isAssigned = character.task_ids.includes(task.id);
  const label = (tier: string | undefined, status: string) => cellLabel(task.name, tier, character.name, status);

  if (editMode) return { label: label(undefined, isAssigned ? "does it" : "doesn't do it") };

  if (isTiered(task)) {
    if (!appliesTo(character, task)) return { label: label(undefined, "doesn't apply") };
    const usual = isAssigned ? difficultyOf(character, task) : undefined;

    if (task.category === "raid") {
      const otherClear = task.roster_limited
        ? data.runs.find(
            (r) =>
              r.task_id === task.id &&
              r.character_id !== character.id &&
              data.allCharacters.find((c) => c.id === r.character_id)?.account_id === character.account_id,
          )
        : undefined;
      if (otherClear) {
        const by = data.allCharacters.find((c) => c.id === otherClear.character_id)?.name ?? "someone else";
        return { label: label(undefined, `cleared by ${by} this week`) };
      }
      const shown = task.difficulties.find((d) => d.id === run?.difficulty_id) ?? usual ?? bestDifficulty(task, character.item_level);
      return run
        ? { label: label(shown?.name, "done"), toggle: () => actions.toggleRaid(character, task, false, undefined) }
        : { label: label(shown?.name, "not done"), toggle: () => actions.toggleRaid(character, task, true, shown?.id) };
    }

    if (task.counted) {
      // Runs at the character's own unlock (as the cell's +/- count them).
      const own = run?.tier_counts && usual ? (run.tier_counts[String(usual.id)] ?? 0) : (run?.count ?? 0);
      const add = () => actions.updateRun(character, task, { count: own + 1 });
      return {
        label: label(usual ? `${usual.name} unlock` : undefined, `${own} run${own === 1 ? "" : "s"}`),
        toggle: add,
        increment: add,
        decrement: own > 0 ? () => actions.updateRun(character, task, { count: own - 1 }) : undefined,
      };
    }

    return run
      ? { label: label(usual?.name, "done"), toggle: () => actions.updateRun(character, task, null) }
      : { label: label(usual?.name, "not done"), toggle: () => actions.updateRun(character, task, {}) };
  }

  if (!isAssigned) return { label: label(undefined, "doesn't apply") };
  const done = data.completed.has(key);
  const needed = dailyRunsNeeded(character, task, data.tracker?.daily_period);
  const status = done ? "done" : needed > 1 && run ? `${run.count} of ${needed} runs` : "not done";
  return { label: label(undefined, status), toggle: () => actions.toggleCompletion(character, task) };
}
