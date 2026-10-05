import { describe, expect, it } from "vitest";

import { dropIndex, mergeOrder, moveItem, nearestIndex, renumber } from "./order";

describe("reordering", () => {
  it("moves an item up or down and clamps to the ends", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
    expect(moveItem(["a", "b", "c"], 1, 9)).toEqual(["a", "c", "b"]);
    const same = ["a", "b"];
    expect(moveItem(same, 1, 1)).toBe(same);
  });

  it("renumbers and only reports rows whose position changed", () => {
    const items = [
      { id: 1, position: 0 },
      { id: 3, position: 0 },
      { id: 2, position: 2 },
    ];
    const { ordered, changed } = renumber(items);
    expect(ordered.map((i) => i.position)).toEqual([0, 1, 2]);
    expect(changed).toEqual([{ id: 3, position: 1 }]);
  });

  it("finds the drop slot from the pointer", () => {
    const middles = [10, 30, 50, 70];
    expect(dropIndex(middles, 0, 5)).toBe(0);
    expect(dropIndex(middles, 0, 55)).toBe(2);
    expect(dropIndex(middles, 3, 20)).toBe(1);
    expect(dropIndex(middles, 1, 100)).toBe(3);
  });
});

describe("nearestIndex", () => {
  it("picks the tile nearest the pointer in two dimensions", () => {
    const grid = [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 100, y: 300 }, { x: 300, y: 300 }];
    expect(nearestIndex(grid, { x: 290, y: 120 })).toBe(1);
    expect(nearestIndex(grid, { x: 120, y: 280 })).toBe(2);
    expect(nearestIndex(grid, { x: 900, y: 900 })).toBe(3);
  });
});

describe("mergeOrder", () => {
  it("keeps the saved order, drops gone keys and slots new ones in", () => {
    expect(mergeOrder(["c", "a", "b"], ["a", "b", "c"])).toEqual(["c", "a", "b"]);
    expect(mergeOrder(["c", "gone", "a"], ["a", "b", "c"])).toEqual(["c", "a", "b"]);
    expect(mergeOrder(["b", "a"], ["new", "a", "b"])).toEqual(["new", "b", "a"]);
    expect(mergeOrder([], ["a", "b"])).toEqual(["a", "b"]);
    expect(mergeOrder(["a", "a", "b"], ["a", "b"])).toEqual(["a", "b"]);
  });
});
