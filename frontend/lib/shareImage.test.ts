import { describe, expect, it } from "vitest";

import { Character, Task } from "./api";
import { IMAGE_WIDTH, layoutWhatsLeftImage } from "./shareImage";
import { LeftGroup } from "./whatsLeft";

// Every character is 7px wide.
const measure = (text: string) => text.length * 7;
const task = (id: number, name: string) => ({ id, name, category: "raid" }) as Task;
const item = (id: number, name: string, gold: number) => ({ task: task(id, name), gold, paying: gold > 0, unknownGold: false });

describe("layoutWhatsLeftImage", () => {
  it("draws a line per character and wraps their chips inside the image", () => {
    const main = { id: 1, name: "Main", class_name: "Bard" } as Character;
    const items = Array.from({ length: 8 }, (_, i) => item(i, `Raid number ${i}`, 10000));
    const groups: LeftGroup[] = [{ character: main, items, gold: 80000 }];
    const layout = layoutWhatsLeftImage(groups, "8 tasks", measure);

    const texts = layout.ops.flatMap((op) => (op.kind === "text" ? [op.text] : []));
    expect(texts).toContain("Main");
    expect(texts).toContain("80,000 gold");
    expect(texts).toContain("Raid number 0 · 10,000");

    const chips = layout.ops.filter((op) => op.kind === "chip");
    expect(chips).toHaveLength(8);
    for (const chip of chips) expect(chip.x + chip.w).toBeLessThanOrEqual(IMAGE_WIDTH - 24);
    // 8 chips of ~172px don't fit on one 672px line.
    expect(new Set(chips.map((c) => c.y)).size).toBeGreaterThan(1);
    expect(layout.height).toBeGreaterThan(Math.max(...chips.map((c) => c.y + c.h)));
  });
});
