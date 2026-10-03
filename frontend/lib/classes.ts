/** Lost Ark classes, grouped by archetype, for the class picker. */
export const CLASS_GROUPS: { archetype: string; classes: string[] }[] = [
  { archetype: "Warrior", classes: ["Berserker", "Destroyer", "Gunlancer", "Paladin", "Slayer", "Valkyrie", "Guardianknight"] },
  { archetype: "Martial Artist", classes: ["Breaker", "Glaivier", "Scrapper", "Soulfist", "Striker", "Wardancer"] },
  { archetype: "Gunner", classes: ["Artillerist", "Deadeye", "Gunslinger", "Machinist", "Sharpshooter"] },
  { archetype: "Mage", classes: ["Arcanist", "Bard", "Sorceress", "Summoner"] },
  { archetype: "Assassin", classes: ["Deathblade", "Reaper", "Shadowhunter", "Souleater"] },
  { archetype: "Specialist", classes: ["Aeromancer", "Artist", "Dimensionalist", "Wildsoul"] },
];

export const LOST_ARK_CLASSES = CLASS_GROUPS.flatMap((group) => group.classes).sort();

/**
 * The picker's list for what's typed: classes containing it, or every class
 * when it's empty or already a full class name (so reopening shows all).
 */
export function classOptions(query: string) {
  const typed = query.trim().toLowerCase();
  const exact = LOST_ARK_CLASSES.some((c) => c.toLowerCase() === typed);
  return CLASS_GROUPS.map((group) => ({
    archetype: group.archetype,
    classes: [...group.classes]
      .sort()
      .filter((c) => !typed || exact || c.toLowerCase().includes(typed) || group.archetype.toLowerCase().includes(typed)),
  })).filter((group) => group.classes.length > 0);
}

/** Match a typed class to the list's spelling ("sorc" stays, "sorceress" -> "Sorceress"). */
export function normalizeClass(name: string) {
  const trimmed = name.trim();
  return LOST_ARK_CLASSES.find((c) => c.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
}
