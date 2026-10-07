import { LOST_ARK_CLASSES } from "./classes";

/** One pasted line, read as a character (or why it couldn't be). */
export type PastedCharacter = {
  line: number;
  text: string;
  name: string;
  className: string;
  itemLevel: number;
  problem: string | null;
};

// Longest first, so a longer class name wins over one it contains.
const CLASSES_BY_LENGTH = [...LOST_ARK_CLASSES].sort((a, b) => b.length - a.length);
const ITEM_LEVEL = /(?:^|[^\d.,])(\d{1,4}(?:[.,]\d{1,2})?)(?![\d])/g;

function findClass(text: string): { className: string; at: number; length: number } | null {
  const lower = text.toLowerCase();
  for (const className of CLASSES_BY_LENGTH) {
    const pattern = new RegExp(`(^|[^\\p{L}])${className.toLowerCase()}(?=$|[^\\p{L}])`, "u");
    const match = pattern.exec(lower);
    if (match) return { className, at: match.index + match[1].length, length: className.length };
  }
  return null;
}

/**
 * Characters from pasted text, one per line, in any order and with any
 * separators: "Bardy Bard 1720", "Bardy, Bard, 1,720.83", or a row copied
 * from a spreadsheet or a roster page ("Lv. 70 Bard Bardy 1720.83"). The
 * name is the first word that isn't the class or a number; the item level is
 * the largest number. Nothing is fetched: this is for text the user copied.
 */
export function parseRosterPaste(text: string, existingNames: string[] = []): PastedCharacter[] {
  const lines = text.split(/\r?\n/);
  const filled = lines.filter((l) => l.trim());
  const withClass = filled.filter((l) => findClass(l.trim())).length;
  // A whole page copied (lostark.bible's roster, say): each character spread
  // over several lines with other text around it. Read it in blocks instead.
  if (withClass > 0 && withClass * 2 < filled.length) return checkProblems(parseBlocks(lines), existingNames);
  return parseLines(lines, existingNames);
}

function parseLines(lines: string[], existingNames: string[]): PastedCharacter[] {
  const existing = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  const seen = new Set<string>();
  const result: PastedCharacter[] = [];

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const found = findClass(line);
    let rest = found ? line.slice(0, found.at) + " " + line.slice(found.at + found.length) : line;

    const levels = [...rest.matchAll(ITEM_LEVEL)].map((m) => Number(m[1].replace(",", ".")));
    // "1,720" is a thousands separator, not 1.72: treat a comma before 3 digits as one.
    const thousands = [...rest.matchAll(/(?:^|[^\d])(\d),(\d{3}(?:\.\d{1,2})?)(?![\d])/g)].map((m) => Number(m[1] + m[2]));
    const itemLevel = Math.max(0, ...levels, ...thousands);
    rest = rest.replace(/\d[\d.,]*/g, " ");
    // "Lv." / "iLvl" labels are not names.
    const words = rest.split(/[\s,;|\t]+/).map((w) => w.replace(/^[^\p{L}]+|[^\p{L}\d]+$/gu, "")).filter(Boolean);
    const name = words.find((w) => !/^(i?lvl?|level|item|ilevel)\.?$/i.test(w)) ?? "";

    let problem: string | null = null;
    if (!name) problem = "No name found";
    else if (!found) problem = "No class found";
    else if (existing.has(name.toLowerCase())) problem = "Already on your roster";
    else if (seen.has(name.toLowerCase())) problem = "Listed twice";
    if (name) seen.add(name.toLowerCase());

    result.push({ line: index + 1, text: line, name, className: found?.className ?? "", itemLevel, problem });
  });
  return result;
}

// Words on a roster page that are never a character's name.
const NOT_NAMES = new Set([
  "roster", "character", "characters", "level", "lv", "lvl", "item", "ilvl", "combat", "power", "guild", "server",
  "class", "name", "stronghold", "title", "expand", "collapse", "search", "profile", "overview", "region", "na", "eu",
  "west", "east", "central", "online", "offline", "view", "more", "less", "all", "sort", "filter",
]);
const NAME = /^[\p{L}][\p{L}\d]{1,19}$/u;
// Combat power and gear scores aren't item levels.
const NOT_ITEM_LEVEL = /power|combat|\bcp\b|score/i;

function numbersIn(line: string): number[] {
  const thousands = [...line.matchAll(/(?:^|[^\d])(\d),(\d{3}(?:\.\d{1,2})?)(?![\d])/g)].map((m) => Number(m[1] + m[2]));
  const plain = [...line.matchAll(ITEM_LEVEL)].map((m) => Number(m[1].replace(",", ".")));
  return [...thousands, ...plain];
}

/**
 * Characters from a copied page: every line that names a class is one
 * character; their name is the nearest one-word line around it (not a class,
 * a number or a page label), their item level the nearest number from 1000
 * to 2000. Each name and item level line is used once.
 */
function parseBlocks(lines: string[]): PastedCharacter[] {
  const anchors = lines.map((l, i) => (findClass(l.trim()) ? i : -1)).filter((i) => i >= 0);
  const used = new Set<number>();
  const usedLevels = new Set<number>();
  const isName = (i: number) => {
    const word = lines[i].trim();
    return NAME.test(word) && !findClass(word) && !NOT_NAMES.has(word.toLowerCase()) && !used.has(i);
  };
  const levelsIn = (i: number) => (NOT_ITEM_LEVEL.test(lines[i]) ? [] : numbersIn(lines[i]).filter((n) => n >= 1000 && n < 2000));

  return anchors.map((at, k) => {
    const from = k > 0 ? anchors[k - 1] + 1 : 0;
    const to = k + 1 < anchors.length ? anchors[k + 1] - 1 : lines.length - 1;
    const near = Array.from({ length: Math.max(0, to - from + 1) }, (_, j) => from + j)
      .filter((i) => i !== at)
      .sort((a, b) => Math.abs(a - at) - Math.abs(b - at) || a - b);
    const found = findClass(lines[at].trim())!;
    // "Bardy Bard" on one line: the name is right there.
    const own = parseLines([lines[at]], [])[0];
    const nameLine = own?.name ? -1 : (near.find(isName) ?? -1);
    if (nameLine >= 0) used.add(nameLine);
    const name = own?.name || (nameLine >= 0 ? lines[nameLine].trim() : "");
    const levelLine = levelsIn(at).length ? at : near.find((i) => !usedLevels.has(i) && levelsIn(i).length > 0);
    if (levelLine !== undefined) usedLevels.add(levelLine);
    const itemLevel = levelLine !== undefined ? levelsIn(levelLine)[0] : 0;
    return {
      line: at + 1,
      text: [name || "?", found.className, itemLevel || "?"].join(" · "),
      name,
      className: found.className,
      itemLevel,
      problem: null,
    };
  });
}

function checkProblems(characters: PastedCharacter[], existingNames: string[]): PastedCharacter[] {
  const existing = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  const seen = new Set<string>();
  return characters.map((c) => {
    const key = c.name.toLowerCase();
    const problem = !c.name ? "No name found" : existing.has(key) ? "Already on your roster" : seen.has(key) ? "Listed twice" : null;
    if (c.name) seen.add(key);
    return { ...c, problem };
  });
}

/**
 * Which new characters to mark as gold earners: the highest item levels,
 * up to the slots the account has left (6 per account, minus those it has).
 */
export function pickGoldEarners(characters: PastedCharacter[], slotsLeft: number): Set<number> {
  const ok = characters.filter((c) => !c.problem);
  const ranked = [...ok].sort((a, b) => b.itemLevel - a.itemLevel || a.line - b.line);
  return new Set(ranked.slice(0, Math.max(0, slotsLeft)).map((c) => c.line));
}
