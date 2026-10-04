import { byPosition, Character, Task } from "./api";
import { isActiveRaid } from "./raids";
import { appliesTo, countsForProgress, FINISHED_ROWS_KEY, isFinished, Section, sectionOf, viewKey } from "./trackerView";

/** Key for a tracker cell (a character's task), used for completions, runs and rest. */
export const cellKey = (characterId: number, taskId: number) => `${characterId}:${taskId}`;

/** Tasks split into tiers: raid difficulties or cube unlocks. */
export function isTiered(task: Task) {
  return task.difficulties.length > 0;
}

/** "2d 5h" until a reset, or "3h 12m" on the last day. */
export function formatCountdown(target: Date, now: Date) {
  const minutes = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes % 60}m`;
}

export type SectionData = {
  columns: Task[];
  /** Characters shown in the card (finished ones tucked away). */
  rows: Character[];
  done: number;
  total: number;
  /** Characters hidden for having finished everything in the card. */
  finished: Character[];
};

/**
 * A tracker card's columns and rows. Outside edit mode, only tasks that apply
 * to someone, and only characters they apply to.
 */
export function buildSection(
  section: Section,
  {
    tasks,
    roster,
    completed,
    hidden,
    editMode,
  }: { tasks: Task[]; roster: Character[]; completed: Set<string>; hidden: Set<string>; editMode: boolean },
): SectionData {
  const columns = tasks
    .filter((t) => sectionOf(t) === section && !hidden.has(viewKey(t)))
    .filter((t) => t.category !== "raid" || isActiveRaid(t))
    .filter((t) => editMode || roster.some((c) => appliesTo(c, t)))
    .sort(byPosition);
  const everyone = editMode ? roster : roster.filter((c) => columns.some((t) => appliesTo(c, t)));
  let done = 0;
  let total = 0;
  for (const character of everyone) {
    for (const task of columns) {
      if (!countsForProgress(character, task)) continue;
      total += 1;
      if (completed.has(cellKey(character.id, task.id))) done += 1;
    }
  }
  // Ebony Cube is run whenever there are tickets, so nobody is ever "done" with it.
  const tuckFinished = !editMode && section !== "anytime" && hidden.has(FINISHED_ROWS_KEY);
  const finished = tuckFinished
    ? everyone.filter((c) => isFinished(c, columns, (t) => completed.has(cellKey(c.id, t.id))))
    : [];
  const rows = everyone.filter((c) => !finished.includes(c));
  return { columns, rows, done, total, finished };
}
