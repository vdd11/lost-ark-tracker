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
  const existing = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  const seen = new Set<string>();
  const result: PastedCharacter[] = [];

  text.split(/\r?\n/).forEach((raw, index) => {
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

/**
 * Which new characters to mark as gold earners: the highest item levels,
 * up to the slots the account has left (6 per account, minus those it has).
 */
export function pickGoldEarners(characters: PastedCharacter[], slotsLeft: number): Set<number> {
  const ok = characters.filter((c) => !c.problem);
  const ranked = [...ok].sort((a, b) => b.itemLevel - a.itemLevel || a.line - b.line);
  return new Set(ranked.slice(0, Math.max(0, slotsLeft)).map((c) => c.line));
}
