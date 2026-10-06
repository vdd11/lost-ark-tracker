import { describe, expect, it } from "vitest";

import { Character } from "./api";
import { matchesFilter } from "./characterFilter";

const char = (name: string, class_name: string) => ({ name, class_name }) as Character;

describe("matchesFilter", () => {
  it("matches name or class, every word, ignoring case", () => {
    expect(matchesFilter(char("Bardy", "Bard"), "")).toBe(true);
    expect(matchesFilter(char("Bardy", "Bard"), "BAR")).toBe(true);
    expect(matchesFilter(char("Main", "Sorceress"), "sorc")).toBe(true);
    expect(matchesFilter(char("Altbard", "Bard"), "bard alt")).toBe(true);
    expect(matchesFilter(char("Main", "Bard"), "bard alt")).toBe(false);
  });
});
