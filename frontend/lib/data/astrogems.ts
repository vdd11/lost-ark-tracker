/**
 * Astrogem processing rules and odds. Every value is editable in the app
 * (Tools → Astrogems → Odds), with "Reset to built-in".
 *
 * Sources (checked 2026-10-04):
 * - Option weights and when each can't appear, and "one of the 4 shown
 *   options is applied, 25% each": Smilegate's official probability
 *   disclosure (Korea), "젬 가공, 젬 융합", last updated 2025-08-20:
 *   https://m-lostark.game.onstove.com/Probability/젬 가공, 젬 융합
 * - Refreshes by grade (Uncommon 0, Rare 1, Epic 2) and grade thresholds
 *   (Legendary 4-15, Relic 16-18, Ancient 19+): official NA release notes,
 *   "Day of Prophecy", 2025-11-19:
 *   https://www.playlostark.com/en-us/game/releases/day-of-prophecy
 * - Attempts by grade (5 / 7 / 9) and 900 gold per attempt: Maxroll's Ark Grid
 *   guide (community), updated 2026-06-13:
 *   https://maxroll.gg/lost-ark/resources/ark-grid-system-guide
 * - The 4 options shown each turn are all different: a Korean community
 *   summary of the official rules (Inven, 2025-08). Assumed to be drawn by
 *   weight among the options that can appear, without repeats.
 *
 * Assumptions not covered by a source (shown in the app): refreshing costs no
 * gold; "Processing cost +100% / -100%" moves a modifier between -100% and
 * +100% that applies to every later attempt.
 */

export type StatKey = "willpower" | "points" | "effect1" | "effect2";

export type OptionEffect =
  | { kind: "stat"; stat: StatKey; change: number }
  | { kind: "changeEffect"; which: 1 | 2 }
  | { kind: "cost"; change: 1 | -1 }
  | { kind: "keep" }
  | { kind: "refresh"; add: number };

export type ProcessingOption = { key: string; label: string; weight: number; effect: OptionEffect };

export const STATS: { key: StatKey; label: string; short: string }[] = [
  { key: "willpower", label: "Willpower Efficiency", short: "Willpower" },
  { key: "points", label: "Order / Chaos Points", short: "Points" },
  { key: "effect1", label: "First effect", short: "Effect 1" },
  { key: "effect2", label: "Second effect", short: "Effect 2" },
];

/** Weights in percent, as published (they add up to 100). */
const STAT_STEPS: [number, number][] = [
  [1, 11.65],
  [2, 4.4],
  [3, 1.75],
  [4, 0.45],
  [-1, 3.0],
];

export const BUILT_IN_OPTIONS: ProcessingOption[] = [
  ...STATS.flatMap(({ key, short }) =>
    STAT_STEPS.map(([change, weight]) => ({
      key: `${key}${change > 0 ? "+" : ""}${change}`,
      label: `${short} ${change > 0 ? "+" : ""}${change}`,
      weight,
      effect: { kind: "stat" as const, stat: key, change },
    })),
  ),
  { key: "change1", label: "Change effect 1", weight: 3.25, effect: { kind: "changeEffect", which: 1 } },
  { key: "change2", label: "Change effect 2", weight: 3.25, effect: { kind: "changeEffect", which: 2 } },
  { key: "cost+", label: "Cost +100%", weight: 1.75, effect: { kind: "cost", change: 1 } },
  { key: "cost-", label: "Cost −100%", weight: 1.75, effect: { kind: "cost", change: -1 } },
  { key: "keep", label: "No change", weight: 1.75, effect: { kind: "keep" } },
  { key: "refresh+1", label: "Refresh +1", weight: 2.5, effect: { kind: "refresh", add: 1 } },
  { key: "refresh+2", label: "Refresh +2", weight: 0.75, effect: { kind: "refresh", add: 2 } },
];

export type Grade = "uncommon" | "rare" | "epic";

export const BUILT_IN_GRADES: Record<Grade, { label: string; attempts: number; refreshes: number }> = {
  uncommon: { label: "Uncommon", attempts: 5, refreshes: 0 },
  rare: { label: "Rare", attempts: 7, refreshes: 1 },
  epic: { label: "Epic", attempts: 9, refreshes: 2 },
};

export const BUILT_IN_COST = 900;

/** Finished gem grade by total points (the 4 levels added up). */
export const RESULT_GRADES = [
  { label: "Ancient", min: 19 },
  { label: "Relic", min: 16 },
  { label: "Legendary", min: 4 },
];

export const ODDS_CHECKED = "2026-10-04";

/**
 * Astrogem types and the side-node effects each can roll.
 * - Names and willpower cost: Maxroll's Ark Grid guide (community, 2026-06-13).
 * - Effects per type (each of the 4 at 25%): Smilegate's official probability
 *   disclosure (Korea, 2025-08-20), "젬 가공: 사용 (분배)", matched to NA names
 *   (안정 Stability, 견고 Solidity, 불변 Immutability, 침식 Corrosion,
 *   왜곡 Distortion, 붕괴 Destruction).
 * Checked 2026-10-04.
 */
export const EFFECTS = {
  attack: "Attack Power",
  additional: "Additional Damage",
  boss: "Boss Damage",
  allyDamage: "Ally Damage Enh.",
  brand: "Brand Power",
  allyAttack: "Ally Attack Power Enh.",
} as const;
export type EffectKey = keyof typeof EFFECTS;

export type GemType = { key: string; family: "Order" | "Chaos"; name: string; willpower: number; effects: EffectKey[] };

const STABLE: EffectKey[] = ["attack", "additional", "allyDamage", "brand"];
const SOLID: EffectKey[] = ["attack", "boss", "allyDamage", "allyAttack"];
const IMMUTABLE: EffectKey[] = ["additional", "boss", "brand", "allyAttack"];

export const GEM_TYPES: GemType[] = [
  { key: "order-stability", family: "Order", name: "Stability", willpower: 8, effects: STABLE },
  { key: "order-solidity", family: "Order", name: "Solidity", willpower: 9, effects: SOLID },
  { key: "order-immutability", family: "Order", name: "Immutability", willpower: 10, effects: IMMUTABLE },
  { key: "chaos-corrosion", family: "Chaos", name: "Corrosion", willpower: 8, effects: STABLE },
  { key: "chaos-distortion", family: "Chaos", name: "Distortion", willpower: 9, effects: SOLID },
  { key: "chaos-destruction", family: "Chaos", name: "Destruction", willpower: 10, effects: IMMUTABLE },
];
