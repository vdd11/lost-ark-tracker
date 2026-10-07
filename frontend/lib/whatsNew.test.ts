import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ICON_FILES, SLOT_GLYPHS } from "./data/icons";
import { highlightParts, versionsToShow, WHATS_NEW, WhatsNewEntry } from "./whatsNew";
import { isNewer } from "./version";

const entry = (version: string): WhatsNewEntry => ({ version, date: "2026-10-06", highlights: [`In ${version}`] });
const entries = [entry("1.21.0"), entry("1.20.0"), entry("1.19.0"), entry("1.18.0")];

describe("versionsToShow", () => {
  it("shows nothing on a first install, or when nothing changed", () => {
    expect(versionsToShow("", "1.20.0", entries)).toEqual([]);
    expect(versionsToShow("1.20.0", "1.20.0", entries)).toEqual([]);
    // Going back to an older copy isn't news.
    expect(versionsToShow("1.21.0", "1.20.0", entries)).toEqual([]);
  });

  it("lists every version skipped, oldest first, up to the one running", () => {
    expect(versionsToShow("1.18.0", "1.20.0", entries).map((e) => e.version)).toEqual(["1.19.0", "1.20.0"]);
    expect(versionsToShow("1.19.0", "1.20.0", entries).map((e) => e.version)).toEqual(["1.20.0"]);
  });
});

describe("whats-new.json", () => {
  it("has an entry for the version being built", () => {
    const versionFile = readFileSync(fileURLToPath(new URL("../../backend/version.py", import.meta.url)), "utf8");
    const appVersion = versionFile.match(/APP_VERSION = "([^"]+)"/)![1];
    expect(WHATS_NEW.map((e) => e.version)).toContain(appVersion);
  });

  it("is newest first, with 3-6 highlights whose icons exist", () => {
    for (let i = 1; i < WHATS_NEW.length; i++) expect(isNewer(WHATS_NEW[i - 1].version, WHATS_NEW[i].version)).toBe(true);
    for (const release of WHATS_NEW) {
      expect(release.highlights.length).toBeGreaterThanOrEqual(3);
      expect(release.highlights.length).toBeLessThanOrEqual(6);
      for (const highlight of release.highlights) {
        const { icon } = highlightParts(highlight);
        expect(icon in ICON_FILES || icon in SLOT_GLYPHS, `${release.version}: icon ${icon}`).toBe(true);
      }
    }
  });
});
