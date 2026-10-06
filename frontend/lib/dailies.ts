import { Character, Task } from "./api";
import { countsForProgress } from "./trackerView";

export type DailyCount = { task: Task; done: number; total: number };

/**
 * The "Dailies today" box: per daily the tracker shows, how many of the
 * characters who do it are done today, and the sum.
 */
export function dailiesToday(columns: Task[], characters: Character[], isDone: (character: Character, task: Task) => boolean) {
  const perTask: DailyCount[] = columns
    .map((task) => {
      const doers = characters.filter((c) => countsForProgress(c, task));
      return { task, done: doers.filter((c) => isDone(c, task)).length, total: doers.length };
    })
    .filter((count) => count.total > 0);
  return {
    perTask,
    done: perTask.reduce((sum, c) => sum + c.done, 0),
    total: perTask.reduce((sum, c) => sum + c.total, 0),
  };
}
