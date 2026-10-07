import data from "./data/whats-new.json";
import { isNewer } from "./version";

/** A highlight: text, with the icon (a GameIcon name) shown beside it. */
export type Highlight = string | { icon: string; text: string };

export type WhatsNewEntry = {
  version: string;
  date: string;
  /** 3-6 player-facing lines, shown after an update. */
  highlights: Highlight[];
  /** The rest, for the full list. */
  sections?: { title: string; items: string[] }[];
};

/** Every release, newest first (lib/data/whats-new.json; each release adds one). */
export const WHATS_NEW = data as WhatsNewEntry[];

/** The last version this browser showed What's new for. */
export const LAST_SEEN_PREFERENCE = "last-seen-version";
/** What 1.19 and earlier stored instead (the version last run), read once so their update still says so. */
export const LEGACY_LAST_RUN_PREFERENCE = "last-run-version";

export function highlightParts(highlight: Highlight) {
  return typeof highlight === "string" ? { icon: "whats-new", text: highlight } : highlight;
}

/**
 * The releases to show after an update, oldest first: those newer than the
 * last one seen, up to the version running. A first install (nothing seen
 * yet) shows nothing.
 */
export function versionsToShow(lastSeen: string, running: string, entries: WhatsNewEntry[] = WHATS_NEW) {
  if (!lastSeen || !running || !isNewer(running, lastSeen)) return [];
  return entries
    .filter((e) => isNewer(e.version, lastSeen) && !isNewer(e.version, running))
    .sort((a, b) => (isNewer(a.version, b.version) ? 1 : -1));
}
