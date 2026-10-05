// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArrangeableList } from "@/components/tracker/arrange";

afterEach(cleanup);

const ITEMS = [
  { id: 0, key: "stats", label: "Gold boxes", node: <p>stats block</p> },
  { id: 1, key: "week", label: "This week", node: <p>week block</p> },
  { id: 2, key: "widgets", label: "Widgets", node: <p>widgets block</p> },
];

describe("ArrangeableList", () => {
  it("shows just the blocks when not arranging", () => {
    render(<ArrangeableList items={ITEMS} arranging={false} onReorder={() => {}} />);
    expect(screen.getByText("week block")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("moves a block with the buttons", async () => {
    const onReorder = vi.fn();
    render(<ArrangeableList items={ITEMS} arranging onReorder={onReorder} />);
    expect((screen.getByRole("button", { name: "Move Gold boxes up" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Move Gold boxes down" }));
    expect(onReorder).toHaveBeenCalledWith(["week", "stats", "widgets"]);
    await userEvent.click(screen.getByRole("button", { name: "Move Widgets up" }));
    expect(onReorder).toHaveBeenLastCalledWith(["stats", "widgets", "week"]);
  });

  it("moves a block with the arrow keys on its handle, and left/right in a grid", () => {
    const onReorder = vi.fn();
    render(<ArrangeableList items={ITEMS} arranging layout="grid" onReorder={onReorder} />);
    const handle = screen.getByRole("button", { name: /Reorder This week/ });
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(onReorder).toHaveBeenLastCalledWith(["week", "stats", "widgets"]);
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(onReorder).toHaveBeenLastCalledWith(["stats", "widgets", "week"]);
  });
});
