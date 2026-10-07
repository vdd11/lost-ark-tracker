import { describe, expect, it } from "vitest";

import { ICON_FILES, SLOT_GLYPHS } from "./icons";
import { libraryOffers, TASK_LIBRARY } from "./taskLibrary";

describe("task library", () => {
  it("offers only confirmed entries, marking ones already added", () => {
    const offers = libraryOffers(["elysian", "Chaos Dungeon"]);
    expect(offers.map((o) => [o.name, o.added])).toEqual([
      ["Elysian", true],
      ["Milestone Missions", false],
    ]);
    expect(offers.every((o) => o.confirmed)).toBe(true);
  });

  it("has a source, a check date and a known icon for every entry", () => {
    for (const entry of TASK_LIBRARY) {
      expect(entry.source.url).toMatch(/^https:\/\//);
      expect(entry.source.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.icon in ICON_FILES || entry.icon in SLOT_GLYPHS, entry.id).toBe(true);
    }
  });
});
