// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import RaidHeader from "@/components/tracker/RaidHeader";

import { difficulty, task } from "./fixtures";

afterEach(cleanup);

describe("RaidHeader", () => {
  it("shows the catalog values on hover and on keyboard focus", () => {
    const serca = task({ name: "Serca", note: "Shadow Raid", difficulties: [difficulty(1, "Normal", 1710, 32000, { bonus_cost: 11200, bound_percent: 50 })] });
    render(<RaidHeader task={serca} />);
    const name = screen.getByText("Serca");
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.mouseEnter(name);
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toContain("1710");
    expect(tip.textContent).toContain("32,000");
    expect(tip.textContent).toContain("50% roster");
    expect(tip.textContent).toContain("11,200");
    expect(tip.textContent).toContain("Shadow Raid");
    fireEvent.mouseLeave(name);
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.focus(name);
    expect(name.getAttribute("aria-describedby")).toBe(screen.getByRole("tooltip").id);
  });
});
