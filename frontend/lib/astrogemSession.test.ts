import { describe, expect, it } from "vitest";

import { applyOption } from "./astrogems";
import {
  applied,
  BUILT_IN_ODDS,
  Effects,
  finish,
  newSession,
  optionsWith,
  parseOdds,
  refreshed,
  Session,
  sessionTotals,
  undo,
} from "./astrogemSession";
import { BUILT_IN_OPTIONS } from "./data/astrogems";

const option = (key: string) => BUILT_IN_OPTIONS.find((o) => o.key === key)!;

describe("a cutting session", () => {
  it("pays for attempts, refreshes, undoes and finishes gems", () => {
    let s = newSession("epic", BUILT_IN_ODDS);
    expect(s.gem.attemptsLeft).toBe(9);
    expect(s.gem.refreshesLeft).toBe(2);

    s = { ...s, shown: ["points+2", "keep", "cost+", "change1"] };
    s = applied(s, option("cost+"), applyOption, 900);
    expect(s.gold).toBe(900);
    expect(s.gem.costStep).toBe(1);
    expect(s.shown).toEqual([]);

    s = applied(s, option("points+2"), applyOption, 900);
    expect(s.gold).toBe(900 + 1800);
    expect(s.gem.levels.points).toBe(3);

    s = refreshed(s);
    expect(s.gem.refreshesLeft).toBe(1);
    s = undo(s);
    expect(s.gem.refreshesLeft).toBe(2);
    s = undo(s);
    expect(s.gem.levels.points).toBe(1);
    expect(s.gold).toBe(900);

    s = finish(s, BUILT_IN_ODDS);
    expect(s.finished).toEqual([{ points: 4, grade: "Legendary", gold: 900, levels: { willpower: 1, points: 1, effect1: 1, effect2: 1 } }]);
    expect(s.gold).toBe(0);
    expect(s.gem.attemptsLeft).toBe(9);
    expect(sessionTotals(s)).toEqual({ gems: 1, gold: 900, unlogged: 900 });
    expect(sessionTotals({ ...s, logged: 900 }).unlogged).toBe(0);
  });

  it("does nothing without attempts or refreshes left", () => {
    const s = newSession("uncommon", BUILT_IN_ODDS);
    expect(refreshed(s)).toBe(s);
    const spent = { ...s, gem: { ...s.gem, attemptsLeft: 0 } };
    expect(applied(spent, option("keep"), applyOption, 900)).toBe(spent);
  });
});

describe("odds settings", () => {
  it("fall back to built-in values for anything bad", () => {
    expect(parseOdds("")).toEqual(BUILT_IN_ODDS);
    const parsed = parseOdds(JSON.stringify({ weights: { keep: 5, nope: 3, "cost+": -1 }, grades: { rare: { attempts: 8, refreshes: 1 }, epic: { attempts: 0, refreshes: 2 } }, baseCost: 1000 }));
    expect(parsed.weights.keep).toBe(5);
    expect(parsed.weights["cost+"]).toBe(1.75);
    expect("nope" in parsed.weights).toBe(false);
    expect(parsed.grades.rare.attempts).toBe(8);
    expect(parsed.grades.epic.attempts).toBe(9);
    expect(parsed.baseCost).toBe(1000);
  });

  it("apply the user's weights to the options", () => {
    const odds = parseOdds(JSON.stringify({ weights: { keep: 50 } }));
    expect(optionsWith(odds).find((o) => o.key === "keep")!.weight).toBe(50);
  });
});

describe("gem type and effects", () => {
  it("forgets an effect the game just changed, and undo brings it back", () => {
    let s: Session = { ...newSession("epic", BUILT_IN_ODDS), gemType: "order-stability", effects: ["attack", "brand"] };
    s = applied(s, option("change2"), applyOption, 900);
    expect(s.effects).toEqual(["attack", null]);
    s = applied(s, option("points+1"), applyOption, 900);
    expect(s.effects).toEqual(["attack", null]);
    s = undo(undo(s));
    expect(s.effects).toEqual(["attack", "brand"]);
  });

  it("keeps the gem type for the next gem but not its effects", () => {
    const s = finish({ ...newSession("rare", BUILT_IN_ODDS), gemType: "chaos-distortion", effects: ["boss", "attack"] as Effects }, BUILT_IN_ODDS);
    expect(s.gemType).toBe("chaos-distortion");
    expect(s.effects).toEqual([null, null]);
  });
});
