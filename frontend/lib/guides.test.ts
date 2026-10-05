import { describe, expect, it } from "vitest";

import { BUILT_IN_GUIDES, categoriesOf, categorySlug, filterGuides, fromLink, guideById, GUIDES_CHECKED, hostOf } from "./guides";

describe("built-in guides", () => {
  it("have unique ids, https links and a description each", () => {
    const ids = BUILT_IN_GUIDES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const guide of BUILT_IN_GUIDES) {
      expect(guide.url).toMatch(/^https:\/\//);
      expect(guide.description.length).toBeGreaterThan(10);
    }
    expect(GUIDES_CHECKED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("never include sites known to be gone or hijacked", () => {
    expect(BUILT_IN_GUIDES.some((g) => g.url.includes("lostarkmarket.online"))).toBe(false);
  });
});

describe("filterGuides", () => {
  const mine = fromLink({ id: 3, title: "Guild Discord", url: "https://discord.gg/abc", description: null, category: "My links", position: 1 });
  const all = [...BUILT_IN_GUIDES, mine];

  it("matches every typed word anywhere, including tags and the site", () => {
    expect(filterGuides(all, "honing calc", null).every((g) => g.category === "Honing and gear")).toBe(true);
    expect(filterGuides(all, "astrogems", null).map((g) => g.id)).toContain("loseii-astrogems");
    expect(filterGuides(all, "discord", null)).toEqual([mine]);
    expect(filterGuides(all, "maxroll.gg silver", null).map((g) => g.id)).toEqual(["maxroll-gold"]);
  });

  it("narrows to a category", () => {
    expect(filterGuides(all, "", "Lookup").map((g) => g.id)).toEqual(["lostark-bible", "lostark-codex"]);
    expect(filterGuides(all, "", "My links")).toEqual([mine]);
  });
});

describe("categoriesOf", () => {
  it("puts built-in categories in reading order, then the user's own", () => {
    const guides = [
      fromLink({ id: 1, title: "a", url: "https://a.com", description: null, category: "Videos", position: 0 }),
      ...BUILT_IN_GUIDES,
    ];
    expect(categoriesOf(guides)).toEqual(["Start here", "Honing and gear", "Gold and market", "Raids", "Lookup", "Community", "Videos"]);
  });
});

describe("helpers", () => {
  it("shows a link's site", () => {
    expect(hostOf("https://www.reddit.com/r/lostarkgame/")).toBe("reddit.com");
    expect(hostOf("nope")).toBe("nope");
  });

  it("finds a built-in guide by id", () => {
    expect(guideById("maxroll-honing")?.title).toBe("Gear honing system");
    expect(categorySlug("Honing and gear")).toBe("honing-and-gear");
    expect(categorySlug("Gold and market")).toBe("gold-and-market");
    expect(guideById("missing")).toBeUndefined();
  });
});
