// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import RaidCell from "@/components/RaidCell";

import { character, difficulty, run, task } from "./fixtures";

afterEach(cleanup);

const finalDay = task({
  name: "The Final Day",
  difficulties: [
    difficulty(10, "Normal", 1710, 32000, { bonus_cost: 10240 }),
    difficulty(11, "Hard", 1730, 48000, { bonus_cost: 15360 }),
  ],
});
// Usually runs Hard.
const bardy = character({ task_ids: [1], difficulty_ids: { "1": 11 } });

function setup(props: Partial<Parameters<typeof RaidCell>[0]> = {}) {
  const handlers = { onToggle: vi.fn(), onDifficulty: vi.fn(), onBonus: vi.fn() };
  render(<RaidCell task={finalDay} character={bardy} isAssigned run={undefined} clearedBy={undefined} {...handlers} {...props} />);
  return handlers;
}

describe("RaidCell", () => {
  it("ticks a raid at the character's usual difficulty", async () => {
    const { onToggle } = setup();
    const box = screen.getByRole("checkbox", { name: "The Final Day cleared by Bardy" });
    expect(box).toHaveProperty("checked", false);
    await userEvent.click(box);
    expect(onToggle).toHaveBeenCalledWith(true, 11);
  });

  it("unticks a clear, and offers the bonus box only once cleared", async () => {
    const { onToggle, onBonus } = setup({ run: run({ difficulty_id: 11 }) });
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith(false, 11);
    const bonus = screen.getByRole("button", { name: "Bought the The Final Day bonus box on Bardy" });
    expect(bonus.textContent).toBe("Bonus box");
    await userEvent.click(bonus);
    expect(onBonus).toHaveBeenCalledWith(true);
  });

  it("has no bonus box before the raid is cleared", () => {
    setup();
    expect(screen.queryByRole("button", { name: /bonus box/ })).toBeNull();
  });

  it("shows what a bought bonus box cost", () => {
    setup({ run: run({ difficulty_id: 11, bought_bonus: true, bonus_spent: 15360 }) });
    expect(screen.getByRole("button", { name: /bonus box/ }).textContent).toBe("Bought −15.4k");
  });

  it("changes difficulty, telling the caller whether this week's clear is done", async () => {
    const { onDifficulty } = setup();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "The Final Day difficulty for Bardy" }), "10");
    expect(onDifficulty).toHaveBeenCalledWith(10, false);
  });

  it("shows who cleared a once-per-roster raid instead of a checkbox", () => {
    setup({ clearedBy: "Slayer" });
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText("Slayer")).not.toBeNull();
  });

  it("swaps the dropdown for a label in compact mode, but not for an extra raid", () => {
    setup({ compact: true });
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("Hard · 48k")).not.toBeNull();
    cleanup();
    setup({ compact: true, isAssigned: false, character: character() });
    expect(screen.getByRole("combobox")).not.toBeNull();
  });
});
