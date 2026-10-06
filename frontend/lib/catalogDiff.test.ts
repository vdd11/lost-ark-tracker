import { describe, expect, it } from "vitest";

import { CatalogReference } from "./api";
import { catalogChanges, parseSnapshot, snapshotOf } from "./catalogDiff";

const reference = (serca: Partial<CatalogReference["raids"][0]["difficulties"][0]>, extra: CatalogReference["raids"] = []): CatalogReference => ({
  reviewed: "2026-10-04",
  raids: [
    {
      name: "Serca",
      note: null,
      difficulties: [
        { name: "Hard", item_level: 1730, gold: 44000, bound_percent: 0, bound_kind: "roster", bonus_cost: 14080, ...serca },
        { name: "Nightmare", item_level: 1740, gold: 54000, bound_percent: 0, bound_kind: "roster", bonus_cost: 17280 },
      ],
    },
    ...extra,
  ],
});

describe("catalogChanges", () => {
  it("is empty when nothing changed", () => {
    expect(catalogChanges(snapshotOf(reference({})), snapshotOf(reference({})))).toEqual([]);
  });

  it("describes changed values, new difficulties and removed ones", () => {
    const before = snapshotOf(reference({}));
    const after = snapshotOf(
      reference({ gold: 46000, item_level: 1735, bound_percent: 50 }, [
        { name: "Act 5", note: null, difficulties: [{ name: "Normal", item_level: 1760, gold: null, bound_percent: 0, bound_kind: "roster", bonus_cost: null }] },
      ]),
    );
    delete after["Serca · Nightmare"];
    expect(catalogChanges(before, after)).toEqual([
      "Serca · Hard: item level 1730 → 1735, gold 44,000 → 46,000, bound none → 50% roster",
      "New: Act 5 · Normal (1760, ? gold)",
      "Removed: Serca · Nightmare",
    ]);
  });

  it("reads back what it stored, and ignores junk", () => {
    const snapshot = snapshotOf(reference({}));
    expect(parseSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(parseSnapshot("")).toBeNull();
    expect(parseSnapshot("[1]")).toBeNull();
  });
});
