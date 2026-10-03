import { describe, expect, it } from "vitest";

import { Task } from "./api";
import { Character } from "./api";
import {
  DEFAULT_HIDDEN,
  isFinished,
  matchingStyle,
  PAGE_KEYS,
  parseHidden,
  SECTION_KEYS,
  sectionOf,
  serializeHidden,
  STAT_KEYS,
  styleHidden,
  viewKey,
  WIDGET_KEYS,
} from "./trackerView";

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
    const hidden = parseHidden("section:today|task:x");
    expect(serializeHidden(hidden)).toBe("section:today|task:x");
    expect(parseHidden("").size).toBe(0);
  });

  it("turns the old gold-summary switch into the separate gold boxes", () => {
    const hidden = parseHidden("section:gold|task:x");
    expect(hidden.has(SECTION_KEYS.gold)).toBe(false);
    expect(Object.values(STAT_KEYS).every((key) => hidden.has(key))).toBe(true);
  });
});

describe("play styles", () => {
  const tasks = [
    task({ id: 1, category: "raid", name: "Serca" }),
    task({ id: 2, category: "weekly", name: "Haal's Hourglass" }),
    task({ id: 3, category: "daily", name: "Chaos Dungeon" }),
  ];

  it("keeps casual to raids", () => {
    const hidden = styleHidden("casual", tasks);
    expect(hidden.has("task:Haal's Hourglass")).toBe(true);
    expect(hidden.has("task:Serca")).toBe(false);
    expect(hidden.has(SECTION_KEYS.today)).toBe(true);
    expect(hidden.has(STAT_KEYS.raidsLeft)).toBe(false);
    expect(hidden.has(PAGE_KEYS.gems)).toBe(true);
    expect(hidden.has(WIDGET_KEYS.gems)).toBe(true);
    expect(styleHidden("regular", tasks).has(WIDGET_KEYS.goldMonth)).toBe(false);
    expect(styleHidden("everything", tasks).size).toBe(0);
  });

  it("recognizes a style until something is changed by hand", () => {
    expect(matchingStyle(new Set(DEFAULT_HIDDEN), tasks)).toBe("regular");
    expect(matchingStyle(styleHidden("casual", tasks), tasks)).toBe("casual");
    expect(matchingStyle(new Set(["task:Serca"]), tasks)).toBeNull();
  });
});

describe("finished characters", () => {
  const raidA = task({ id: 1, category: "raid", name: "A" });
  const raidB = task({ id: 2, category: "raid", name: "B" });
  const who = { task_ids: [1, 2], item_level: 1700 } as Character;

  it("needs every counted task done", () => {
    expect(isFinished(who, [raidA, raidB], (t) => t.id === 1)).toBe(false);
    expect(isFinished(who, [raidA, raidB], () => true)).toBe(true);
    expect(isFinished({ ...who, task_ids: [] }, [raidA], () => true)).toBe(false);
  });
});
