import { describe, expect, it } from "vitest";

import { dropsFrom, eventsOn, nextEvent } from "./fieldEvents";

describe("eventsOn", () => {
  it("follows the game day of the daily reset", () => {
    expect(eventsOn("2026-10-04")).toEqual(["Field Boss", "Chaos Gate"]); // Sunday: both
    expect(eventsOn("2026-10-05")).toEqual(["Chaos Gate"]); // Monday
    expect(eventsOn("2026-10-06")).toEqual(["Field Boss"]); // Tuesday
    expect(eventsOn("2026-10-07")).toEqual([]); // Wednesday
  });
});

describe("nextEvent", () => {
  it("says when the next one is on a day with neither", () => {
    expect(nextEvent("2026-10-07")).toEqual({ event: "Chaos Gate", day: "tomorrow" });
    expect(nextEvent("2026-10-06")).toEqual({ event: "Chaos Gate", day: "on Thursday" });
  });
});

describe("dropsFrom", () => {
  it("keeps only filled-in gem levels and whole gold", () => {
    expect(dropsFrom({ 1: "", 2: "3", 3: "0", 4: "1" }, "12,5".replace(",", ""))).toEqual({ gems: { 2: 3, 4: 1 }, gold: 125 });
    expect(dropsFrom({ 1: "", 2: "" }, "")).toEqual({ gems: null, gold: 0 });
  });
});
