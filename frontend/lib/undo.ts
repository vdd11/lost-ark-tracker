import { BalanceCheck, GemEntry, GoldEntry, Run } from "./api";

/**
 * Request bodies that put back what an action removed, for the Undo toast.
 * A restored clear gets a new timestamp and its gold is snapshotted again, so
 * it can differ if other clears changed in between (e.g. a 4th raid); a
 * restored entry gets a new id. Otherwise it's the same row.
 */

/** PUT body that recreates a cleared run with its details. */
export function restoreRunBody(run: Run) {
  const body: Record<string, unknown> = { difficulty_id: run.difficulty_id };
  if (run.bought_bonus) body.bought_bonus = true;
  if (run.sands) body.sands = run.sands;
  if (run.lucky_rooms) body.lucky_rooms = run.lucky_rooms;
  if (run.mega_rooms) body.mega_rooms = run.mega_rooms;
  if (run.fate_embers) body.fate_embers = run.fate_embers;
  if (run.blessed_embers) body.blessed_embers = run.blessed_embers;
  if (run.tier_counts && Object.keys(run.tier_counts).length) body.tier_counts = run.tier_counts;
  else if (run.count > 1) body.count = run.count;
  return body;
}

export function goldEntryBody(entry: GoldEntry) {
  return {
    source: entry.source,
    amount: entry.amount,
    character_id: entry.character_id,
    account_id: entry.account_id,
    note: entry.note,
    earned_at: entry.earned_at,
  };
}

export function gemEntryBody(entry: GemEntry) {
  return {
    source: entry.source,
    character_id: entry.character_id,
    gems: entry.gems,
    note: entry.note,
    earned_at: entry.earned_at,
  };
}

export function checkInBody(check: BalanceCheck) {
  return {
    tradeable: check.actual.tradeable,
    roster_bound: check.actual.roster_bound,
    character_bound: check.actual.character_bound,
    note: check.note,
    checked_at: check.checked_at,
    account_id: check.account_id,
  };
}
