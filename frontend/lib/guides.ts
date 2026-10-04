import data from "./data/guides.json";

/** A built-in Guides link (lib/data/guides.json) or one the user added. */
export type Guide = {
  id: string;
  title: string;
  url: string;
  description: string;
  category: string;
  kind: "guide" | "tool" | "database" | "news" | "community" | "mine";
  tags: string[];
  /** Set for the user's own links: the database id. */
  linkId?: number;
};

/** A link the user added, as GET /api/guides returns it. */
export type GuideLink = { id: number; title: string; url: string; description: string | null; category: string; position: number };

export const BUILT_IN_GUIDES = data.guides as Guide[];
/** When the built-in links were last opened and found working. */
export const GUIDES_CHECKED = data.checked;

export const MY_LINKS = "My links";
const CATEGORY_ORDER = ["Start here", "Honing and gear", "Gold and market", "Raids", "Lookup", "Community"];

export function fromLink(link: GuideLink): Guide {
  return {
    id: `link-${link.id}`,
    title: link.title,
    url: link.url,
    description: link.description ?? "",
    category: link.category || MY_LINKS,
    kind: "mine",
    tags: [],
    linkId: link.id,
  };
}

/** Categories in reading order: the built-in ones first, then the user's own. */
export function categoriesOf(guides: Guide[]): string[] {
  const present = new Set(guides.map((g) => g.category));
  const known = CATEGORY_ORDER.filter((c) => present.has(c));
  const extra = [...present].filter((c) => !CATEGORY_ORDER.includes(c)).sort((a, b) => a.localeCompare(b));
  return [...known, ...extra];
}

/**
 * Links matching every word typed (in the title, description, category,
 * tags or site), and the chosen category if any.
 */
export function filterGuides(guides: Guide[], query: string, category: string | null): Guide[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return guides.filter((guide) => {
    if (category && guide.category !== category) return false;
    const haystack = [guide.title, guide.description, guide.category, hostOf(guide.url), ...guide.tags].join(" ").toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/** "maxroll.gg" from "https://maxroll.gg/lost-ark", for showing where a link goes. */
export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function guideById(id: string): Guide | undefined {
  return BUILT_IN_GUIDES.find((g) => g.id === id);
}
