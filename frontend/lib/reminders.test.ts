import { describe, expect, it } from "vitest";

import { Character, RestState, Task } from "./api";
import { dailyReminder, fullRestItems, weeklyReminder } from "./reminders";
import { cellKey } from "./trackerSections";

const reset = new Date("2026-10-07T10:00:00Z");
const at = (hoursBefore: number) => new Date(reset.getTime() - hoursBefore * 3600_000);
const weekly = { nextReset: reset, leadHours: 3, lastNotifiedFor: "", items: [{ name: "Bravo", left: 2 }] };

describe("weeklyReminder", () => {
  it("reminds within the lead time when gold raids are left", () => {
    expect(weeklyReminder({ ...weekly, now: at(2.5) })).toEqual({
      resetKey: reset.toISOString(),
      title: "Gold raids left this week",
      body: "2 gold raids left, weekly reset in 2h 30m: Bravo 2.",
    });
  });

  it("stays quiet with nothing left, too early, after the reset, or once already sent", () => {
    expect(weeklyReminder({ ...weekly, now: at(1), items: [] })).toBeNull();
    expect(weeklyReminder({ ...weekly, now: at(4) })).toBeNull();
    expect(weeklyReminder({ ...weekly, now: at(-0.1) })).toBeNull();
    expect(weeklyReminder({ ...weekly, now: at(1), lastNotifiedFor: reset.toISOString() })).toBeNull();
  });
});

describe("full rest", () => {
  const chaos = { id: 1, name: "Chaos Dungeon", category: "daily", rest_max: 200 } as Task;
  const who = (id: number, name: string) => ({ id, name, task_ids: [1] }) as Character;
  const rest = (id: number, value: number): RestState => ({ character_id: id, task_id: 1, value, rested_run_available: true });

  it("counts full gauges on characters who haven't run it today", () => {
    const items = fullRestItems(
      [who(1, "Alpha"), who(2, "Bravo"), who(3, "Charlie")],
      [chaos],
      [rest(1, 200), rest(2, 200), rest(3, 120)],
      new Set([cellKey(2, 1)]),
    );
    expect(items).toEqual([{ task: "Chaos Dungeon", names: ["Alpha"] }]);
    expect(dailyReminder({ nextReset: reset, leadHours: 2, lastNotifiedFor: "", now: at(1), items })?.body).toBe(
      "Chaos Dungeon rest is full on 1 character (Alpha): run it before the daily reset in 1h 0m or that day's rest is lost.",
    );
    expect(dailyReminder({ nextReset: reset, leadHours: 2, lastNotifiedFor: "", now: at(1), items: [] })).toBeNull();
  });
});
