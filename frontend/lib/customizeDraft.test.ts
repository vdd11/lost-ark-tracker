import { describe, expect, it } from "vitest";

import { CustomizeDraft, draftChanged, isItemShown, toggleItem } from "./customizeDraft";

const saved: CustomizeDraft = { hidden: new Set(["task:Guardian Raid"]), optIn: { news: false, counters: true }, styleChosen: true };

describe("customize draft", () => {
  it("toggles hidden items and opt-in widgets without touching what's saved", () => {
    let draft = toggleItem(saved, "task:Guardian Raid", true);
    draft = toggleItem(draft, "widget:gems", false);
    draft = toggleItem(draft, "news", true);
    expect(isItemShown(draft, "task:Guardian Raid")).toBe(true);
    expect(isItemShown(draft, "widget:gems")).toBe(false);
    expect(isItemShown(draft, "news")).toBe(true);
    expect(saved.hidden.has("task:Guardian Raid")).toBe(true);
    expect(saved.optIn.news).toBe(false);
  });

  it("knows when there's something to lose", () => {
    expect(draftChanged(saved, saved)).toBe(false);
    expect(draftChanged(saved, toggleItem(saved, "news", true))).toBe(true);
    expect(draftChanged(saved, toggleItem(saved, "widget:gems", false))).toBe(true);
    // Toggled back: nothing changed.
    expect(draftChanged(saved, toggleItem(toggleItem(saved, "widget:gems", false), "widget:gems", true))).toBe(false);
  });
});
