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
  const handlers = { onToggle: vi.fn(), onGate: vi.fn(), onDifficulty: vi.fn(), onBonus: vi.fn() };
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

  it("shows no gold for a character who doesn't earn it, and their chests as free", () => {
    const spare = character({ name: "Spare", is_gold_earner: false, task_ids: [1], difficulty_ids: { "1": 11 } });
    setup({ character: spare, run: run({ difficulty_id: 11, bought_bonus: true, bonus_spent: 0 }) });
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options.every((text) => !/\d+k/.test(text ?? ""))).toBe(true);
    expect(screen.getByRole("button", { name: /bonus box/i }).textContent).toBe("Free");
  });

  it("still shows a gold earner's gold and what the chest cost", () => {
    setup({ run: run({ difficulty_id: 11, bought_bonus: true, bonus_spent: 15360 }) });
    expect(screen.getAllByRole("option").some((o) => o.textContent?.includes("48k"))).toBe(true);
    expect(screen.getByRole("button", { name: /bonus box/i }).textContent).toContain("15.4k");
  });
});

describe("RaidCell gates", () => {
  const gated = task({
    name: "Serca",
    gate_count: 2,
    difficulties: [
      difficulty(10, "Normal", 1710, 32000, { gate_gold: [13000, 19000] }),
      difficulty(11, "Hard", 1730, 44000, { gate_gold: [17500, 26500] }),
    ],
  });

  function gatedSetup(props: Partial<Parameters<typeof RaidCell>[0]> = {}) {
    const handlers = { onToggle: vi.fn(), onGate: vi.fn(), onDifficulty: vi.fn(), onBonus: vi.fn() };
    render(<RaidCell task={gated} character={bardy} isAssigned run={undefined} clearedBy={undefined} {...handlers} {...props} />);
    return handlers;
  }

  it("clears one gate at the shown difficulty, with that gate's gold in its tooltip", async () => {
    const { onGate } = gatedSetup();
    const gate1 = screen.getByRole("button", { name: "Serca gate 1 cleared by Bardy" });
    expect(gate1.getAttribute("aria-pressed")).toBe("false");
    expect(gate1.getAttribute("title")).toBe("Gate 1 (Hard): 17,500 gold");
    await userEvent.click(gate1);
    expect(onGate).toHaveBeenCalledWith(1, 11);
  });

  it("shows a partial clear as 1/2, un-clears a gate, and the checkbox finishes the rest", async () => {
    const { onGate, onToggle } = gatedSetup({ run: run({ difficulty_id: 10, gates: { "1": 10 } }) });
    const box = screen.getByRole("checkbox", { name: "Serca cleared by Bardy (1 of 2 gates)" }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(box.indeterminate).toBe(true);
    expect(screen.getByText("1/2")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Serca gate 1 cleared by Bardy" }).getAttribute("title")).toBe("Gate 1 (Normal): 13,000 gold");

    await userEvent.click(screen.getByRole("button", { name: "Serca gate 1 cleared by Bardy" }));
    expect(onGate).toHaveBeenCalledWith(1, null);
    await userEvent.click(box);
    expect(onToggle).toHaveBeenCalledWith(true, 10);
  });

  it("says when a gate's gold isn't known", () => {
    const unknown = task({ name: "Serca", gate_count: 2, difficulties: [difficulty(11, "Hard", 1730, 44000)] });
    render(<RaidCell task={unknown} character={bardy} isAssigned run={undefined} clearedBy={undefined} onToggle={vi.fn()} onGate={vi.fn()} onDifficulty={vi.fn()} onBonus={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Serca gate 2 cleared by Bardy" }).getAttribute("title")).toBe("Gate 2 (Hard): gold per gate unknown");
  });
});
