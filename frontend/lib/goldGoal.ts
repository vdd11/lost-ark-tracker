import { WeeklyGold } from "./api";

/** What counts toward the gold goal. */
export type GoalMode = "tradeable" | "roster";

export const GOAL_MODES: { key: GoalMode; label: string }[] = [
  { key: "tradeable", label: "Tradeable only" },
  { key: "roster", label: "Tradeable + roster-bound" },
];

export type OnHand = { tradeable: number; roster_bound: number };

/** A week's gold toward the goal (after bonus chests): tradeable, plus roster-bound if counted. */
export function weeklyToward(week: WeeklyGold, mode: GoalMode): number {
  return week.tradeable_left + (mode === "tradeable" ? 0 : week.roster_bound_left);
}

/** Gold on hand toward the goal, or null without a check-in. */
export function onHandToward(onHand: OnHand | null, mode: GoalMode): number | null {
  if (!onHand) return null;
  return onHand.tradeable + (mode === "tradeable" ? 0 : onHand.roster_bound);
}
