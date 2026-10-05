/** The cutting companion's session state: the gem on screen, what it cost, and the gems finished. */
import { attemptCost, GemState, total } from "./astrogems";
import { BUILT_IN_COST, EffectKey, BUILT_IN_GRADES, BUILT_IN_OPTIONS, Grade, ProcessingOption, RESULT_GRADES } from "./data/astrogems";

export type OddsSettings = {
  /** Option key -> weight (percent). */
  weights: Record<string, number>;
  grades: Record<Grade, { attempts: number; refreshes: number }>;
  baseCost: number;
};

export const BUILT_IN_ODDS: OddsSettings = {
  weights: Object.fromEntries(BUILT_IN_OPTIONS.map((o) => [o.key, o.weight])),
  grades: {
    uncommon: { attempts: BUILT_IN_GRADES.uncommon.attempts, refreshes: BUILT_IN_GRADES.uncommon.refreshes },
    rare: { attempts: BUILT_IN_GRADES.rare.attempts, refreshes: BUILT_IN_GRADES.rare.refreshes },
    epic: { attempts: BUILT_IN_GRADES.epic.attempts, refreshes: BUILT_IN_GRADES.epic.refreshes },
  },
  baseCost: BUILT_IN_COST,
};

/** The built-in options with the user's weights. */
export function optionsWith(odds: OddsSettings): ProcessingOption[] {
  return BUILT_IN_OPTIONS.map((o) => ({ ...o, weight: odds.weights[o.key] ?? o.weight }));
}

/** Stored odds, falling back to built-in for anything missing or malformed. */
export function parseOdds(raw: string): OddsSettings {
  try {
    const stored = JSON.parse(raw) as Partial<OddsSettings>;
    const weights = { ...BUILT_IN_ODDS.weights };
    for (const [key, value] of Object.entries(stored.weights ?? {})) {
      if (key in weights && typeof value === "number" && value >= 0) weights[key] = value;
    }
    const grades = { ...BUILT_IN_ODDS.grades };
    for (const grade of Object.keys(grades) as Grade[]) {
      const g = stored.grades?.[grade];
      if (g && Number.isInteger(g.attempts) && g.attempts > 0 && Number.isInteger(g.refreshes) && g.refreshes >= 0) grades[grade] = g;
    }
    const baseCost = typeof stored.baseCost === "number" && stored.baseCost >= 0 ? stored.baseCost : BUILT_IN_ODDS.baseCost;
    return { weights, grades, baseCost };
  } catch {
    return BUILT_IN_ODDS;
  }
}

export type Session = {
  grade: Grade;
  gem: GemState;
  /** Option keys on screen this turn (up to 4). */
  shown: string[];
  /** Gold spent on the gem on screen. */
  gold: number;
  /** Earlier states of this gem, for Undo. */
  history: { gem: GemState; shown: string[]; gold: number; effects?: Effects }[];
  /** Gems finished this session. */
  finished: { points: number; grade: string; gold: number; levels: GemState["levels"] }[];
  /** Gold of finished gems already sent to the spending log. */
  logged: number;
  /** The gem type (GEM_TYPES key), remembered for the next gem. */
  gemType?: string;
  /** The two side-node effects; null when unknown (e.g. just changed). */
  effects?: Effects;
};

export type Effects = [EffectKey | null, EffectKey | null];
const NO_EFFECTS: Effects = [null, null];

export function newGem(grade: Grade, odds: OddsSettings): GemState {
  return {
    levels: { willpower: 1, points: 1, effect1: 1, effect2: 1 },
    attemptsLeft: odds.grades[grade].attempts,
    refreshesLeft: odds.grades[grade].refreshes,
    costStep: 0,
  };
}

export function newSession(grade: Grade, odds: OddsSettings): Session {
  return { grade, gem: newGem(grade, odds), shown: [], gold: 0, history: [], finished: [], logged: 0 };
}

const remember = (s: Session) => [...s.history, { gem: s.gem, shown: s.shown, gold: s.gold, effects: s.effects }].slice(-50);

/** After "Change effect N", that effect is unknown until the user picks what the game rolled. */
function effectsAfter(effects: Effects | undefined, option: ProcessingOption): Effects | undefined {
  if (option.effect.kind !== "changeEffect") return effects;
  const next: Effects = [...(effects ?? NO_EFFECTS)];
  next[option.effect.which - 1] = null;
  return next;
}

/** The game applied the option in slot `index`: pay for the attempt and change the gem. */
export function applied(session: Session, option: ProcessingOption, apply: (gem: GemState, o: ProcessingOption) => GemState, baseCost: number): Session {
  if (session.gem.attemptsLeft <= 0) return session;
  return {
    ...session,
    history: remember(session),
    gold: session.gold + attemptCost(session.gem, baseCost),
    gem: apply(session.gem, option),
    effects: effectsAfter(session.effects, option),
    shown: [],
  };
}

/** A refresh was used: new options come up. */
export function refreshed(session: Session): Session {
  if (session.gem.refreshesLeft <= 0) return session;
  return { ...session, history: remember(session), gem: { ...session.gem, refreshesLeft: session.gem.refreshesLeft - 1 }, shown: [] };
}

export function undo(session: Session): Session {
  const last = session.history.at(-1);
  if (!last) return session;
  return { ...session, ...last, history: session.history.slice(0, -1) };
}

/** Finish the gem on screen (it goes in the session log) and start a fresh one. */
export function finish(session: Session, odds: OddsSettings): Session {
  const points = total(session.gem);
  const grade = RESULT_GRADES.find((g) => points >= g.min)?.label ?? "";
  return {
    ...session,
    finished: [...session.finished, { points, grade, gold: session.gold, levels: session.gem.levels }],
    gem: newGem(session.grade, odds),
    effects: NO_EFFECTS,
    shown: [],
    gold: 0,
    history: [],
  };
}

export function sessionTotals(session: Session) {
  const gold = session.finished.reduce((s, g) => s + g.gold, 0);
  return { gems: session.finished.length, gold, unlogged: Math.max(0, gold - session.logged) };
}
