import { Difficulty, Task } from "./api";
import { formatItemLevel, isActiveRaid } from "./raids";

export type RaidTier = {
  /** 0 = the hardest raid tier in the game right now, 1 = the next one down, ... */
  rank: number;
  task: Task;
  difficulty: Difficulty;
};

/**
 * The hardest raid difficulty a character can enter, and how high that is
 * among every item level gate the current raids have (events left out). Ties
 * at the same item level go to the one paying the most gold.
 */
export function bestRaidTier(itemLevel: number, tasks: Task[], today = new Date()): RaidTier | null {
  const entries = tasks
    .filter((t) => isActiveRaid(t, today) && !t.ends_on)
    .flatMap((task) => task.difficulties.map((difficulty) => ({ task, difficulty })));
  const gates = [...new Set(entries.map((e) => e.difficulty.min_item_level))].sort((a, b) => b - a);
  const best = gates.find((gate) => gate <= itemLevel);
  if (best === undefined) return null;
  const atGate = entries
    .filter((e) => e.difficulty.min_item_level === best)
    .sort((a, b) => (b.difficulty.gold ?? 0) - (a.difficulty.gold ?? 0));
  return { rank: gates.indexOf(best), ...atGate[0] };
}

/** Colours like the game's item grades: Relic orange at the top, then Legendary gold, Epic purple, Rare blue. */
export function tierTone(tier: RaidTier | null): string {
  if (!tier) return "text-muted";
  if (tier.rank === 0) return "text-[#d9661f]";
  if (tier.rank <= 2) return "text-accent";
  if (tier.rank <= 4) return "text-[#9b5de5]";
  return "text-series-1";
}

export function tierHint(tier: RaidTier | null): string {
  if (!tier) return "Below every current raid's item level";
  const { task, difficulty } = tier;
  return `Can enter up to ${task.name} ${difficulty.name} (${formatItemLevel(difficulty.min_item_level)})`;
}
