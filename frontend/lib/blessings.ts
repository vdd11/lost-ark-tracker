import { Character } from "./api";

export type Blessing = "azena" | "innana";

export const BLESSINGS: { id: Blessing; field: "azena_until" | "innana_until"; label: string; help: string }[] = [
  { id: "azena", field: "azena_until", label: "Azena's", help: "Blessed embers can drop from Chaos Dungeon and Guardian Raid" },
  { id: "innana", field: "innana_until", label: "Innana's", help: "A second Chaos Dungeon (Chaos Rift, 1730+) run each day" },
];

/** Innana's extra daily run is for Chaos Rift, which starts at this item level. */
export const CHAOS_RIFT_ITEM_LEVEL = 1730;

/** The game day (dailies reset at 10:00 UTC), as YYYY-MM-DD. */
export function gameDay(now: Date) {
  return new Date(now.getTime() - 10 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Whether a blessing is on for the given game day: it lasts through its end date. */
export function blessingActive(character: Pick<Character, "azena_until" | "innana_until">, blessing: Blessing, day: string) {
  const until = blessing === "azena" ? character.azena_until : character.innana_until;
  return Boolean(until && until >= day);
}

/** Chaos Dungeon runs a character has each day: two with Innana's at Chaos Rift item level. */
export function chaosRunsPerDay(character: Character, day: string) {
  return blessingActive(character, "innana", day) && character.item_level >= CHAOS_RIFT_ITEM_LEVEL ? 2 : 1;
}
