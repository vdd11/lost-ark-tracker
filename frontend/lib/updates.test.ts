import { describe, expect, it } from "vitest";

import { assetFor, justUpdated, parseRelease, releaseNoteLines } from "./updates";

const ASSETS = [
  { name: "LostArkTracker-linux", url: "https://example.test/linux" },
  { name: "LostArkTracker-macos", url: "https://example.test/macos" },
  { name: "LostArkTracker-windows.exe", url: "https://example.test/windows" },
];

describe("parseRelease", () => {
  it("keeps the version, notes and downloads", () => {
    const release = parseRelease({
      tag_name: "v1.14.0",
      html_url: "https://github.com/x/releases/tag/v1.14.0",
      body: "## New\n- Tray icon",
      assets: [{ name: "LostArkTracker-linux", browser_download_url: "https://example.test/linux" }, { name: 3 }],
    });
    expect(release).toEqual({
      version: "1.14.0",
      url: "https://github.com/x/releases/tag/v1.14.0",
      notes: "## New\n- Tray icon",
      assets: [{ name: "LostArkTracker-linux", url: "https://example.test/linux" }],
    });
  });

  it("copes with a release that has no notes or assets", () => {
    expect(parseRelease({ tag_name: "v2.0.0", body: null })).toMatchObject({ notes: "", assets: [] });
  });
});

describe("assetFor", () => {
  it("picks the download for this platform", () => {
    expect(assetFor(ASSETS, "windows")?.url).toBe("https://example.test/windows");
    expect(assetFor(ASSETS, "macos")?.url).toBe("https://example.test/macos");
  });

  it("has nothing to offer for an unknown platform or a missing build", () => {
    expect(assetFor(ASSETS, null)).toBeNull();
    expect(assetFor(ASSETS.slice(0, 1), "windows")).toBeNull();
  });
});

describe("releaseNoteLines", () => {
  it("turns markdown into plain headings, items and text", () => {
    const notes = [
      "## What's new",
      "",
      "- **Tray icon** instead of a console ([docs](https://example.test))",
      "* Weekly history by @vdd11 in https://github.com/x/pull/12",
      "Thanks for playing!",
      "",
      "**Full Changelog**: https://github.com/x/compare/v1.13.0...v1.14.0",
    ].join("\n");
    expect(releaseNoteLines(notes)).toEqual([
      { kind: "heading", text: "What's new" },
      { kind: "item", text: "Tray icon instead of a console (docs)" },
      { kind: "item", text: "Weekly history" },
      { kind: "text", text: "Thanks for playing!" },
    ]);
  });

  it("is empty when the notes are only the changelog link", () => {
    expect(releaseNoteLines("**Full Changelog**: https://github.com/x/compare/a...b")).toEqual([]);
  });
});

describe("justUpdated", () => {
  it("is true once the running version is newer than the last one seen", () => {
    expect(justUpdated("1.13.0", "1.14.0")).toBe(true);
    expect(justUpdated("1.14.0", "1.14.0")).toBe(false);
    expect(justUpdated("1.15.0", "1.14.0")).toBe(false);
  });

  it("says nothing on a fresh install", () => {
    expect(justUpdated("", "1.14.0")).toBe(false);
  });
});
