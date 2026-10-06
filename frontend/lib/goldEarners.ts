import { Account, Character, MAX_GOLD_EARNERS, WeeklyGold } from "./api";

/** Gold earners per account, for "5/6 gold earners" (only accounts with characters). */
export function goldEarnerCounts(characters: Character[], accounts: Account[]) {
  return accounts
    .map((account) => {
      const mine = characters.filter((c) => c.account_id === account.id);
      return { account, earners: mine.filter((c) => c.is_gold_earner).length, characters: mine.length };
    })
    .filter((row) => row.characters > 0)
    .map((row) => ({ ...row, max: MAX_GOLD_EARNERS, full: row.earners >= MAX_GOLD_EARNERS }));
}

/** Whether a character can be made a gold earner: its account has a free slot. */
export function canBecomeEarner(character: Character, characters: Character[]) {
  if (character.is_gold_earner) return true;
  return characters.filter((c) => c.account_id === character.account_id && c.is_gold_earner).length < MAX_GOLD_EARNERS;
}

/**
 * The tracker's "Gold this week": tradeable + roster-bound gold earned this
 * week, after the bonus boxes those paid for (boxes use a character's own
 * bound gold first, which isn't counted here), split into raids and the gold
 * logged by hand.
 */
export function goldThisWeek(week: Pick<WeeklyGold, "other_gold" | "tradeable_left" | "roster_bound_left">) {
  const total = week.tradeable_left + week.roster_bound_left;
  return { total, raids: Math.max(0, total - week.other_gold), other: week.other_gold };
}
