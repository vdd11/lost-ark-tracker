import { describe, expect, it } from "vitest";

import { shouldRemindCheckIn, shouldShowRecap } from "./banners";

describe("shouldShowRecap", () => {
  const recap = {
    enabled: true, weeklyPeriod: "2026-09-30", dismissedWeek: "", now: new Date("2026-10-02T12:00:00Z"),
    lastWeekGold: 1000, lastWeekGems: 0, paidRaidCharacters: 0,
  };

  it("shows early in the week when last week had activity", () => {
    expect(shouldShowRecap(recap)).toBe(true);
    expect(shouldShowRecap({ ...recap, lastWeekGold: 0 })).toBe(false);
    expect(shouldShowRecap({ ...recap, lastWeekGold: 0, paidRaidCharacters: 1 })).toBe(true);
  });

  it("stays away once dismissed, turned off, or after the weekend", () => {
    expect(shouldShowRecap({ ...recap, dismissedWeek: "2026-09-30" })).toBe(false);
    expect(shouldShowRecap({ ...recap, enabled: false })).toBe(false);
    expect(shouldShowRecap({ ...recap, now: new Date("2026-10-05T12:00:00Z") })).toBe(false);
  });
});

describe("shouldRemindCheckIn", () => {
  const checkIn = { enabled: true, weeklyPeriod: "2026-09-30", dismissedWeek: "", lastCheckIn: null };

  it("reminds when there's no check-in since this week's reset", () => {
    expect(shouldRemindCheckIn(checkIn)).toBe(true);
    expect(shouldRemindCheckIn({ ...checkIn, lastCheckIn: "2026-09-29T20:00:00" })).toBe(true);
    expect(shouldRemindCheckIn({ ...checkIn, lastCheckIn: "2026-09-30T11:00:00" })).toBe(false);
  });

  it("waits for data and respects dismissal", () => {
    expect(shouldRemindCheckIn({ ...checkIn, lastCheckIn: undefined })).toBe(false);
    expect(shouldRemindCheckIn({ ...checkIn, dismissedWeek: "2026-09-30" })).toBe(false);
    expect(shouldRemindCheckIn({ ...checkIn, enabled: false })).toBe(false);
  });
});
