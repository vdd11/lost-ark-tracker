/** Progress counters the user keeps by hand (tracker widget), as GET /api/counters returns them. */
export type Counter = {
  id: number;
  name: string;
  value: number;
  target: number | null;
  character_id: number | null;
  account_id: number | null;
  position: number;
};

/** Off until turned on under Customize. */
export const COUNTERS_PREFERENCE = "widget-counters";

/** Counters for the account shown (0 = all): that account's, plus ones for everyone. */
export function countersFor(counters: Counter[], accountId: number): Counter[] {
  return counters.filter((c) => !accountId || c.account_id === null || c.account_id === accountId);
}

/** 0..1 toward the target, or null without one. */
export function counterProgress(counter: Counter): number | null {
  if (!counter.target) return null;
  return Math.min(1, counter.value / counter.target);
}
