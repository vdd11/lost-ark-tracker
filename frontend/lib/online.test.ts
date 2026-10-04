import { describe, expect, it } from "vitest";

import { updateCheckState } from "./online";

describe("updateCheckState", () => {
  it("follows a saved choice", () => {
    expect(updateCheckState("on", false)).toBe("on");
    expect(updateCheckState("off", true)).toBe("off");
  });

  it("keeps the check for existing users and asks on a new install", () => {
    expect(updateCheckState("", true)).toBe("on");
    expect(updateCheckState("", false)).toBe("ask");
  });
});
