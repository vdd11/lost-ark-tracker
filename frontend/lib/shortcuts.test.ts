import { describe, expect, it } from "vitest";

import { cellLabel, globalShortcut, isTypingTarget, moveFocus, SEQUENCE_MS } from "./shortcuts";

describe("isTypingTarget", () => {
  it("treats text fields as typing but not checkboxes or buttons", () => {
    expect(isTypingTarget({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(isTypingTarget({ tagName: "input" })).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: "INPUT", type: "checkbox" })).toBe(false);
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("moveFocus", () => {
  it("moves with the arrows and stays inside the grid", () => {
    expect(moveFocus({ row: 0, col: 0 }, "ArrowRight", 3, 4)).toEqual({ row: 0, col: 1 });
    expect(moveFocus({ row: 0, col: 0 }, "ArrowUp", 3, 4)).toEqual({ row: 0, col: 0 });
    expect(moveFocus({ row: 2, col: 3 }, "ArrowDown", 3, 4)).toEqual({ row: 2, col: 3 });
    expect(moveFocus({ row: 1, col: 2 }, "Home", 3, 4)).toEqual({ row: 1, col: 0 });
    expect(moveFocus({ row: 1, col: 2 }, "End", 3, 4)).toEqual({ row: 1, col: 3 });
    expect(moveFocus({ row: 1, col: 2 }, "x", 3, 4)).toBeNull();
  });
});

describe("globalShortcut", () => {
  const idle = { pendingSince: null };

  it("jumps to a page after g", () => {
    const first = globalShortcut(idle, "g", 1000);
    expect(first.action).toEqual({ type: "none" });
    expect(globalShortcut(first.state, "m", 1500).action).toEqual({ type: "navigate", path: "/gems/" });
    expect(globalShortcut(first.state, "g", 1500).action).toEqual({ type: "navigate", path: "/gold/" });
  });

  it("forgets the g after a moment, and ignores unknown second keys", () => {
    const first = globalShortcut(idle, "g", 1000);
    expect(globalShortcut(first.state, "t", 1000 + SEQUENCE_MS + 1).action).toEqual({ type: "none" });
    expect(globalShortcut(first.state, "x", 1200)).toEqual({ state: idle, action: { type: "none" } });
  });

  it("opens help with ?", () => {
    expect(globalShortcut(idle, "?", 0).action).toEqual({ type: "help" });
  });
});

describe("cellLabel", () => {
  it("names the task, tier, character and state", () => {
    expect(cellLabel("Serca", "Nightmare", "Alpha", "not done")).toBe("Serca Nightmare – Alpha – not done");
    expect(cellLabel("Chaos Dungeon", undefined, "Bravo", "done")).toBe("Chaos Dungeon – Bravo – done");
  });
});
