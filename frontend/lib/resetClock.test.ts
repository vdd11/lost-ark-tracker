import { describe, expect, it } from "vitest";

import { countdown, describeReset } from "./resetClock";

describe("countdown", () => {
  const now = new Date("2026-10-04T12:00:00Z");
  it("shows days and hours, hours and minutes, or minutes", () => {
    expect(countdown(new Date("2026-10-07T00:30:00Z"), now)).toBe("2d 12h");
    expect(countdown(new Date("2026-10-04T17:12:00Z"), now)).toBe("5h 12m");
    expect(countdown(new Date("2026-10-04T12:08:00Z"), now)).toBe("8m");
    expect(countdown(new Date("2026-10-04T11:00:00Z"), now)).toBe("0m");
  });
});

describe("describeReset", () => {
  it("gives the reset in the viewer's zone and in UTC", () => {
    // Wednesday 10:00 UTC is 6:00 AM in New York (EDT, UTC-4) on that date.
    const reset = describeReset("2026-10-07T10:00:00", new Date("2026-10-04T12:00:00Z"), "America/New_York");
    expect(reset).toEqual({ local: "Wed 6:00 AM", utc: "Wed 10:00 AM", countdown: "2d 22h" });
  });

  it("accepts times that already say they're UTC", () => {
    expect(describeReset("2026-10-05T10:00:00Z", new Date("2026-10-05T09:00:00Z"), "UTC").countdown).toBe("1h 0m");
  });
});
