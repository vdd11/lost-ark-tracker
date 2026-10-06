import { Character } from "./api";

/** Rosters bigger than this get the tracker's "Filter characters" box. */
export const FILTER_FROM = 8;

/**
 * Whether a character matches what's typed in the filter: every word must
 * appear in their name or class ("bard 17" isn't a thing, but "bard alt"
 * finds Alt's Bard). An empty filter matches everyone.
 */
export function matchesFilter(character: Character, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = `${character.name} ${character.class_name}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}
