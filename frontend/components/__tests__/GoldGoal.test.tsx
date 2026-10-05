// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import BoundGoldNote from "@/components/tracker/BoundGoldNote";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { GoldGoalWidget } from "@/components/tracker/Widgets";
import { WeeklyGold } from "@/lib/api";
import { GoalMode } from "@/lib/goldGoal";

import { character, difficulty, task } from "./fixtures";

afterEach(cleanup);

const week = (tradeable: number, roster: number, bound: number) =>
  ({ tradeable_left: tradeable, roster_bound_left: roster, character_bound: { "7": { earned: bound, spent: 0, left: bound } } }) as unknown as WeeklyGold;
// Four finished weeks of 70k tradeable, 70k roster-bound and 70k bound to Bardy, then this week.
const WEEKS = [week(70000, 70000, 70000), week(70000, 70000, 70000), week(70000, 70000, 70000), week(70000, 70000, 70000), week(0, 0, 0)];

function renderGoal(mode: GoalMode, goal = 1_000_000) {
  const handlers = { onMode: vi.fn(), onGoal: vi.fn() };
  render(
    <GoldGoalWidget
      weeks={WEEKS}
      daysIntoWeek={0}
      onHand={{ tradeable: 100000, roster_bound: 50000 }}
      mode={mode}
      goal={goal}
      {...handlers}
    />,
  );
  return handlers;
}

describe("GoldGoalWidget", () => {
  it("counts what each mode allows", () => {
    renderGoal("tradeable");
    expect(screen.getByText(/100,000 of 1,000,000 tradeable on hand/)).toBeTruthy();
    cleanup();
    renderGoal("roster");
    expect(screen.getByText(/150,000 of 1,000,000 tradeable \+ roster-bound on hand/)).toBeTruthy();
    // Only the two modes are offered.
    const modes = [...(screen.getByLabelText("What counts toward the goal") as HTMLSelectElement).options].map((o) => o.value);
    expect(modes).toEqual(["tradeable", "roster"]);
  });

  it("switches mode", async () => {
    const { onMode } = renderGoal("roster");
    await userEvent.selectOptions(screen.getByLabelText("What counts toward the goal"), "tradeable");
    expect(onMode).toHaveBeenCalledWith("tradeable");
  });
});

describe("BoundGoldNote", () => {
  const cathedral = task({ id: 3, name: "Horizon Cathedral", difficulties: [difficulty(30, "Lv3", 1750, 50000, { bound_percent: 100, bound_kind: "character" })] });
  const data = (bound: Record<string, number | null>, setBoundGold = vi.fn()) =>
    ({ tasks: [cathedral], boundGold: bound, actions: { setBoundGold } }) as unknown as TrackerData;

  it("shows tracked bound gold and saves what's typed", async () => {
    const setBoundGold = vi.fn();
    const bardy = character({ id: 7, name: "Bardy", task_ids: [], difficulty_ids: {} });
    render(<BoundGoldNote character={bardy} data={data({ "7": 12300 }, setBoundGold)} />);
    await userEvent.click(screen.getByRole("button", { name: "Set Bardy's character-bound gold" }));
    const input = screen.getByLabelText("Bardy's character-bound gold");
    await userEvent.clear(input);
    await userEvent.type(input, "20000{enter}");
    expect(setBoundGold).toHaveBeenCalledWith(bardy, 20000);
  });

  it("offers to set it for characters whose raids pay it, and stays out of the way otherwise", () => {
    const runsCathedral = character({ id: 7, name: "Bardy", task_ids: [3], difficulty_ids: { "3": 30 } });
    render(<BoundGoldNote character={runsCathedral} data={data({})} />);
    expect(screen.getByRole("button", { name: "Set Bardy's character-bound gold" }).textContent).toContain("set");
    cleanup();
    const other = character({ id: 8, name: "Other", task_ids: [], difficulty_ids: {} });
    const { container } = render(<BoundGoldNote character={other} data={data({})} />);
    expect(container.textContent).toBe("");
  });
});
