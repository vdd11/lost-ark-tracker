import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LOST_ARK_CLASSES } from "../classes";
import { classIconName, ICON_FILES, iconLabel, iconSrc, slug, sourceIconName, taskIconName } from "./icons";

const FOLDER = join(__dirname, "..", "..", "public", "game-icons");

describe("icon names", () => {
  it("maps built-in tasks by key and others by name", () => {
    expect(taskIconName({ catalog_key: "ebony-cube", name: "Ebony Cube", category: "weekly" })).toBe("ebony-cube");
    expect(taskIconName({ catalog_key: null, name: "Chaos Dungeon", category: "daily" })).toBe("chaos-dungeon");
    expect(taskIconName({ catalog_key: "haals-hourglass", name: "My hourglass", category: "weekly" })).toBe("haals-hourglass");
    // Every raid shares the Endgame Content badge.
    expect(taskIconName({ catalog_key: "kazeros-denouement", name: "The Final Day", category: "raid" })).toBe("endgame-content");
    expect(sourceIconName("Field Boss")).toBe("field-boss");
    expect(slug("Haal's Hourglass")).toBe("haals-hourglass");
  });

  it("names every class", () => {
    for (const name of LOST_ARK_CLASSES) expect(iconLabel(classIconName(name)).toLowerCase()).toBe(name.toLowerCase());
  });

  it("has no image for an unknown name, so the fallback shows", () => {
    expect(iconSrc("not-an-icon")).toBeNull();
  });
});

describe("bundled files", () => {
  const sources = readFileSync(join(FOLDER, "SOURCES.md"), "utf8");

  it("exist and are listed in SOURCES.md", () => {
    for (const file of Object.values(ICON_FILES)) {
      expect(existsSync(join(FOLDER, file)), file).toBe(true);
      expect(sources, file).toContain(`| ${file} |`);
    }
  });

  it("carry the trademark notice", () => {
    expect(sources.replace(/\s+/g, " ")).toContain("trademarks and property of Smilegate RPG / Amazon Games");
  });
});
