// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { appearanceAttributes, applyAppearance } from "./appearance";

describe("appearance", () => {
  it("only sets attributes for non-default choices", () => {
    expect(appearanceAttributes("default", "comfortable")).toEqual({ "data-text-size": null, "data-density": null });
    expect(appearanceAttributes("large", "compact")).toEqual({ "data-text-size": "large", "data-density": "compact" });
  });

  it("applies and clears them on the root element", () => {
    const root = document.createElement("html");
    applyAppearance("small", "compact", root);
    expect(root.getAttribute("data-text-size")).toBe("small");
    expect(root.getAttribute("data-density")).toBe("compact");
    applyAppearance("default", "comfortable", root);
    expect(root.hasAttribute("data-text-size")).toBe(false);
    expect(root.hasAttribute("data-density")).toBe(false);
  });
});
