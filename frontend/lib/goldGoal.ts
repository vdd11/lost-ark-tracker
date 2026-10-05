import { WeeklyGold } from "./api";

/** What counts toward the gold goal. */
export type GoalMode = "tradeable" | "roster" | "character";

export const GOAL_MODES: { key: GoalMode; label: string }[] = [
  { key: "tradeable", label: "Tradeable only" },
  { key: "roster", label: "Tradeable + roster-bound" },
  { key: "character", label: "A character's total" },
];

export type OnHand = { tradeable: number; roster_bound: number };

/**
 * A week's gold toward the goal (after bonus chests): tradeable; plus
 * roster-bound; or, for one character, plus that character's bound gold.
 */
export function weeklyToward(week: WeeklyGold, mode: GoalMode, characterId: number | null): number {
  const shared = week.tradeable_left + (mode === "tradeable" ? 0 : week.roster_bound_left);
  if (mode !== "character" || characterId === null) return shared;
  return shared + (week.character_bound[String(characterId)]?.left ?? 0);
}

/** Gold on hand toward the goal, or null without a check-in. */
export function onHandToward(onHand: OnHand | null, mode: GoalMode, characterBound: number | null): number | null {
  if (!onHand) return null;
  const shared = onHand.tradeable + (mode === "tradeable" ? 0 : onHand.roster_bound);
  return mode === "character" ? shared + (characterBound ?? 0) : shared;
}
