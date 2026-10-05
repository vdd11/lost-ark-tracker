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
 * This week's raid gold split for the tracker box: tradeable plus
 * roster-bound in one total, and character-bound gold with how many
 * characters it's spread over (it can only be spent by each of them).
 */
export function raidGoldSplit(week: Pick<WeeklyGold, "raid_gold" | "character_bound_gold" | "character_bound">) {
  const spreadOver = Object.values(week.character_bound).filter((c) => c.earned > 0).length;
  return {
    shared: week.raid_gold - week.character_bound_gold,
    characterBound: week.character_bound_gold,
    spreadOver,
  };
}
