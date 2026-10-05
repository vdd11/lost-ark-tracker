import { describe, expect, it } from "vitest";

import { seededRandom } from "./random";

describe("seededRandom", () => {
  it("repeats for the same seed", () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("stays in [0, 1)", () => {
    const random = seededRandom(1);
    for (let i = 0; i < 1000; i++) {
      const value = random();
      expect(value >= 0 && value < 1).toBe(true);
    }
  });
});
