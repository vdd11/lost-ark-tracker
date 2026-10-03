import { Character, Task } from "./api";
import { GOLD_RAIDS_PER_WEEK, goldRaidWeek } from "./raids";

/**
 * Gold raids each gold earner left on the table last week: the raids they
 * could have been paid for (their usual ones, else the best they can enter,
 * up to 3) minus the paying clears they made.
 */
export function missedGoldRaids(characters: Character[], tasks: Task[], paid: Record<string, number>) {
  return characters
    .filter((c) => c.is_gold_earner)
    .map((character) => {
      const done = Math.min(paid[String(character.id)] ?? 0, GOLD_RAIDS_PER_WEEK);
      return { character, missed: Math.max(0, goldRaidWeek(character, tasks, []).slots - done) };
    })
    .filter((row) => row.missed > 0);
}
