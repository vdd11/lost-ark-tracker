import { Account, Character, MAX_GOLD_EARNERS } from "./api";

/** "" = never started, "active" = in the middle of it, "done" = finished or skipped. */
export type FirstRunState = "" | "active" | "done";
export const FIRST_RUN_STATES: FirstRunState[] = ["", "active", "done"];
export const FIRST_RUN_PREFERENCE = "first-run";

/**
 * The setup steps show on an empty tracker, and keep showing once started
 * (adding characters mid-way mustn't make them vanish) until finished.
 */
export function showFirstRun(loaded: boolean, characterCount: number, state: FirstRunState) {
  return loaded && state !== "done" && (characterCount === 0 || state === "active");
}

/** Gold earners per account, for "Main: 4 of 6". */
export function earnersByAccount(characters: Character[], accounts: Account[]) {
  const groups = accounts.length ? accounts : [{ id: null as number | null, name: "Your roster" }];
  return groups.map((account) => {
    const members = characters.filter((c) => account.id === null || c.account_id === account.id);
    return { name: account.name, earners: members.filter((c) => c.is_gold_earner).length, max: MAX_GOLD_EARNERS, characters: members };
  });
}
