import { formatGold } from "./api";
import { itemName, LeftGroup } from "./whatsLeft";

export type Font = "title" | "name" | "body" | "small";

/** One thing to draw: text, or a rounded box behind a chip. */
export type DrawOp =
  | { kind: "text"; x: number; y: number; text: string; font: Font; color: "fg" | "muted" | "accent"; align?: "left" | "right" }
  | { kind: "chip"; x: number; y: number; w: number; h: number };

export type ImageLayout = { width: number; height: number; ops: DrawOp[] };

export const IMAGE_WIDTH = 720;
const PAD = 24;
const CHIP_H = 26;
const CHIP_PAD = 9;
const GAP = 6;

/** The text on one chip: "Serca Nightmare · 32,000", like the What's left card. */
export function chipText(item: LeftGroup["items"][number]) {
  const gold = item.unknownGold ? " · ? gold" : item.gold > 0 ? ` · ${formatGold(item.gold)}` : "";
  return `${itemName(item)}${gold}${item.suggested ? " (suggested)" : ""}`;
}

/**
 * Lays out the "Copy as image" picture of What's left: a title line, then per
 * character their name, class and gold, and their tasks as chips that wrap.
 * `measure(text, font)` gives a text's width, so this stays testable without
 * a canvas.
 */
export function layoutWhatsLeftImage(
  groups: LeftGroup[],
  subtitle: string,
  measure: (text: string, font: Font) => number,
): ImageLayout {
  const ops: DrawOp[] = [];
  let y = PAD;
  ops.push({ kind: "text", x: PAD, y, text: "What's left", font: "title", color: "fg" });
  ops.push({ kind: "text", x: IMAGE_WIDTH - PAD, y: y + 4, text: subtitle, font: "small", color: "muted", align: "right" });
  y += 40;

  for (const group of groups) {
    ops.push({ kind: "text", x: PAD, y, text: group.character.name, font: "name", color: "fg" });
    const nameWidth = measure(group.character.name, "name");
    ops.push({ kind: "text", x: PAD + nameWidth + 8, y: y + 2, text: group.character.class_name, font: "small", color: "muted" });
    if (group.gold > 0) {
      ops.push({ kind: "text", x: IMAGE_WIDTH - PAD, y: y + 2, text: `${formatGold(group.gold)} gold`, font: "small", color: "accent", align: "right" });
    }
    y += 26;

    let x = PAD;
    for (const item of group.items) {
      const text = chipText(item);
      const w = Math.min(measure(text, "body") + CHIP_PAD * 2, IMAGE_WIDTH - PAD * 2);
      if (x > PAD && x + w > IMAGE_WIDTH - PAD) {
        x = PAD;
        y += CHIP_H + GAP;
      }
      ops.push({ kind: "chip", x, y, w, h: CHIP_H });
      ops.push({ kind: "text", x: x + CHIP_PAD, y: y + 6, text, font: "body", color: "fg" });
      x += w + GAP;
    }
    y += CHIP_H + 18;
  }

  ops.push({ kind: "text", x: PAD, y, text: "Lost Ark Tracker", font: "small", color: "muted" });
  return { width: IMAGE_WIDTH, height: y + 16 + PAD, ops };
}
