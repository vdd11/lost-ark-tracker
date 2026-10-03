import { describe, expect, it } from "vitest";

import { Task } from "./api";
import { DEFAULT_HIDDEN, parseHidden, sectionOf, serializeHidden, viewKey } from "./trackerView";

const task = (extra: Partial<Task>) =>
  ({ id: 1, name: "X", category: "weekly", counted: false, catalog_key: null, difficulties: [], ...extra }) as Task;

describe("tracker sections", () => {
  it("puts things where they reset", () => {
    expect(sectionOf(task({ category: "daily", name: "Chaos Dungeon" }))).toBe("today");
    expect(sectionOf(task({ category: "raid", name: "Serca" }))).toBe("week");
    expect(sectionOf(task({ category: "weekly", name: "Haal's Hourglass" }))).toBe("week");
    expect(sectionOf(task({ category: "weekly", name: "Ebony Cube", counted: true }))).toBe("anytime");
  });

  it("keys built-in tasks by catalog key and others by name", () => {
    expect(viewKey(task({ catalog_key: "shadow-serca", name: "Serca" }))).toBe("task:shadow-serca");
    expect(viewKey(task({ name: "Guardian Raid" }))).toBe("task:Guardian Raid");
  });

  it("hides Guardian Raid until turned on, and round-trips choices", () => {
    expect(DEFAULT_HIDDEN).toContain(viewKey(task({ name: "Guardian Raid" })));
    const hidden = parseHidden("section:gold|task:x");
    expect(serializeHidden(hidden)).toBe("section:gold|task:x");
    expect(parseHidden("").size).toBe(0);
  });
});
