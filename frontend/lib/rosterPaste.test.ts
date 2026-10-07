import { describe, expect, it } from "vitest";

import { parseRosterPaste, pickGoldEarners } from "./rosterPaste";

const pick = (text: string, existing: string[] = []) =>
  parseRosterPaste(text, existing).map(({ name, className, itemLevel, problem }) => ({ name, className, itemLevel, problem }));

describe("parseRosterPaste", () => {
  it("reads names, classes and item levels in any order and format", () => {
    const text = [
      "Bardy Bard 1720",
      "Sorcy, sorceress, 1,705.83",
      "1680.5\tPunchy\tStriker",
      "Lv. 70 Gunlancer Tanky 1640",
      "Paintsy - Artist - 1700,5",
    ].join("\n");
    expect(pick(text)).toEqual([
      { name: "Bardy", className: "Bard", itemLevel: 1720, problem: null },
      { name: "Sorcy", className: "Sorceress", itemLevel: 1705.83, problem: null },
      { name: "Punchy", className: "Striker", itemLevel: 1680.5, problem: null },
      { name: "Tanky", className: "Gunlancer", itemLevel: 1640, problem: null },
      { name: "Paintsy", className: "Artist", itemLevel: 1700.5, problem: null },
    ]);
  });

  it("doesn't mistake Artist inside Martial Artist or a name containing a class", () => {
    expect(pick("Bardolph Breaker 1600")[0]).toMatchObject({ name: "Bardolph", className: "Breaker" });
  });

  it("keeps names with accents and skips blank lines", () => {
    expect(pick("\n  Élodie Paladin 1650  \n\n")).toEqual([{ name: "Élodie", className: "Paladin", itemLevel: 1650, problem: null }]);
  });

  it("says what's wrong with a line instead of guessing", () => {
    const rows = pick(["Nobody 1700", "Bard 1700", "Bardy Bard", "Bardy Bard 1710", "Old Paladin 1600"].join("\n"), ["old"]);
    expect(rows.map((r) => r.problem)).toEqual([
      "No class found",
      "No name found",
      null,
      "Listed twice",
      "Already on your roster",
    ]);
    expect(rows[2].itemLevel).toBe(0);
  });
});

describe("parseRosterPaste on a copied roster page", () => {
  it("finds each character among the other text, name before or after the class", () => {
    const page = [
      "lostark.bible",
      "Roster",
      "Bardy",
      "Lv. 70",
      "Bard",
      "1,720.83",
      "Combat Power 1,850",
      "Guild: Some Guild Name",
      "Sorcy",
      "Sorceress",
      "1705.00",
      "Stronghold Lv. 70",
      "Gunlancer",
      "Tanky",
      "1640",
      "Expand",
    ].join("\n");
    expect(pick(page)).toEqual([
      { name: "Bardy", className: "Bard", itemLevel: 1720.83, problem: null },
      { name: "Sorcy", className: "Sorceress", itemLevel: 1705, problem: null },
      { name: "Tanky", className: "Gunlancer", itemLevel: 1640, problem: null },
    ]);
  });

  it("still flags characters already on the roster", () => {
    const page = ["Header text", "Bardy", "Bard", "1720", "Footer", "more text"].join("\n");
    expect(pick(page, ["bardy"])[0].problem).toBe("Already on your roster");
  });
});

describe("pickGoldEarners", () => {
  it("picks the highest item levels up to the slots left", () => {
    const rows = parseRosterPaste(["A Bard 1600", "B Bard 1720", "C Bard 1700", "Bad 1800"].join("\n"));
    expect([...pickGoldEarners(rows, 2)].sort()).toEqual([2, 3]);
    expect(pickGoldEarners(rows, 0).size).toBe(0);
  });
});
