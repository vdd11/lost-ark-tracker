// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import GameIcon from "@/components/GameIcon";
import { MarkAllButton } from "@/components/tracker/cardParts";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { ICON_FILES } from "@/lib/data/icons";

import { character, task } from "./fixtures";

const BUNDLED = { ...ICON_FILES };

afterEach(() => {
  cleanup();
  for (const key of Object.keys(ICON_FILES)) delete ICON_FILES[key];
  Object.assign(ICON_FILES, BUNDLED);
});

describe("GameIcon", () => {
  it("shows the slot glyph in a tile when there's no file", () => {
    const { container } = render(<GameIcon name="field-boss" size={24} />);
    const tile = container.querySelector(".slot-tile") as HTMLElement;
    expect(tile).not.toBeNull();
    expect(tile.style.width).toBe("24px");
    expect(tile.querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("img", { name: "Field Boss" })).toBeTruthy();
  });

  it("shows just the glyph beside text, and nothing for a name it doesn't know", () => {
    const { container } = render(<GameIcon name="bonus-box" size={12} inline alt="" />);
    expect(container.querySelector(".slot-tile")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
    cleanup();
    expect(render(<GameIcon name="chaos-gate-ticket" />).container.innerHTML).toBe("");
  });

  it("shows the bundled file at a fixed size, framed when asked, and the glyph if it fails to load", () => {
    ICON_FILES.gold = "gold.webp";
    delete ICON_FILES["gold-roster"];
    render(<GameIcon name="gold-roster" size={20} />);
    const image = screen.getByRole("img", { name: "Roster-bound gold" });
    expect(image.getAttribute("src")).toMatch(/\/game-icons\/gold\.webp$/);
    expect([image.getAttribute("width"), image.getAttribute("height")]).toEqual(["20", "20"]);
    fireEvent.error(image);
    expect(screen.queryByRole("img", { name: "Roster-bound gold" })).toBeNull();
    cleanup();

    const { container } = render(<GameIcon name="ebony-cube" size={30} framed />);
    expect(container.querySelector(".slot-tile img")?.getAttribute("width")).toBe("24");
  });
});

describe("the All button", () => {
  const serca = task({ id: 1, name: "Serca" });
  const act4 = task({ id: 2, name: "Act 4" });
  const bard = character({ task_ids: [1, 2] });

  function data(done: string[]) {
    return { completed: new Set(done), actions: { completeAll: vi.fn() } } as unknown as TrackerData;
  }

  it("marks everything left done", () => {
    const tracker = data([]);
    render(<MarkAllButton character={bard} columns={[serca, act4]} what="raids and weeklies" data={tracker} />);
    const button = screen.getByRole("button", { name: "Mark Bardy's remaining raids and weeklies done" });
    expect(button.getAttribute("title")).toBe("Mark Bardy's remaining raids and weeklies done: Serca, Act 4");
    fireEvent.click(button);
    expect(tracker.actions.completeAll).toHaveBeenCalledWith(bard, [serca, act4]);
  });

  it("goes away once they're done", () => {
    const { container } = render(<MarkAllButton character={bard} columns={[serca, act4]} what="raids and weeklies" data={data(["7:1", "7:2"])} />);
    expect(container.innerHTML).toBe("");
  });
});
