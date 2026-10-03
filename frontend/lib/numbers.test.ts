import { describe, expect, it } from "vitest";

import { digitsOnly, withCommas } from "./numbers";

describe("gold inputs", () => {
  it("keeps only digits from what was typed or pasted", () => {
    expect(digitsOnly("12,500")).toBe("12500");
    expect(digitsOnly("1 234 567g")).toBe("1234567");
    expect(digitsOnly("007")).toBe("7");
    expect(digitsOnly("0")).toBe("0");
    expect(digitsOnly("")).toBe("");
  });

  it("groups thousands with commas", () => {
    expect(withCommas("")).toBe("");
    expect(withCommas("950")).toBe("950");
    expect(withCommas("12500")).toBe("12,500");
    expect(withCommas("1234567")).toBe("1,234,567");
  });
});

describe("class names", () => {
  it("matches typed classes to the list, keeping unknown ones", async () => {
    const { normalizeClass, LOST_ARK_CLASSES } = await import("./classes");
    expect(normalizeClass(" sorceress ")).toBe("Sorceress");
    expect(normalizeClass("GUARDIANKNIGHT")).toBe("Guardianknight");
    expect(normalizeClass("New Class")).toBe("New Class");
    expect(new Set(LOST_ARK_CLASSES).size).toBe(LOST_ARK_CLASSES.length);
  });
});
