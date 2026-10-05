// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Coins } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import GameIcon from "@/components/GameIcon";
import { MarkAllButton } from "@/components/tracker/cardParts";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { ICON_FILES } from "@/lib/data/icons";

import { character, task } from "./fixtures";

afterEach(() => {
  cleanup();
  for (const key of Object.keys(ICON_FILES)) delete ICON_FILES[key];
});

describe("GameIcon", () => {
  it("falls back to the Lucide icon when there's no file", () => {
    const { container } = render(<GameIcon name="gold" fallback={Coins} />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders nothing without a file or a fallback", () => {
    const { container } = render(<GameIcon name="class-bard" />);
    expect(container.innerHTML).toBe("");
  });

  it("shows the bundled file at a fixed size, and falls back if it fails to load", () => {
    ICON_FILES.gold = "gold.webp";
    render(<GameIcon name="gold-roster" size={20} fallback={Coins} />);
    const image = screen.getByRole("img", { name: "Roster-bound gold" });
    expect(image.getAttribute("src")).toMatch(/\/game-icons\/gold\.webp$/);
    expect([image.getAttribute("width"), image.getAttribute("height")]).toEqual(["20", "20"]);

    fireEvent.error(image);
    expect(screen.queryByRole("img", { name: "Roster-bound gold" })).toBeNull();
  });
});

describe("the class icon button", () => {
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
    expect(button.getAttribute("title")).toBe("Mark all done: Serca, Act 4");
    fireEvent.click(button);
    expect(tracker.actions.completeAll).toHaveBeenCalledWith(bard, [serca, act4]);
  });

  it("stays as a plain icon once they're done", () => {
    render(<MarkAllButton character={bard} columns={[serca, act4]} what="raids and weeklies" data={data(["7:1", "7:2"])} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByTitle("Bardy is done")).toBeTruthy();
  });

  it("shows nothing for a character with nothing to count in the card", () => {
    const alt = character({ task_ids: [] });
    const { container } = render(<MarkAllButton character={alt} columns={[serca]} what="raids and weeklies" data={data([])} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector("[title]")).toBeNull();
  });
});
