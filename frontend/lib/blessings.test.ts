import { describe, expect, it } from "vitest";

import { Character } from "./api";
import { blessingActive, chaosRunsPerDay, gameDay } from "./blessings";

const char = (item_level: number, innana_until: string | null, azena_until: string | null = null) =>
  ({ item_level, innana_until, azena_until }) as Character;

describe("blessings", () => {
  it("uses the game day, which starts at the 10:00 UTC reset", () => {
    expect(gameDay(new Date("2026-10-07T09:59:00Z"))).toBe("2026-10-06");
    expect(gameDay(new Date("2026-10-07T10:00:00Z"))).toBe("2026-10-07");
  });

  it("lasts through its end date", () => {
    const c = char(1740, "2026-10-07", "2026-10-01");
    expect(blessingActive(c, "innana", "2026-10-07")).toBe(true);
    expect(blessingActive(c, "innana", "2026-10-08")).toBe(false);
    expect(blessingActive(c, "azena", "2026-10-07")).toBe(false);
    expect(blessingActive(char(1740, null), "innana", "2026-10-07")).toBe(false);
  });

  it("gives a second Chaos Dungeon run with Innana's at 1730+", () => {
    expect(chaosRunsPerDay(char(1740, "2026-12-01"), "2026-10-07")).toBe(2);
    expect(chaosRunsPerDay(char(1720, "2026-12-01"), "2026-10-07")).toBe(1);
    expect(chaosRunsPerDay(char(1740, null), "2026-10-07")).toBe(1);
  });
});
