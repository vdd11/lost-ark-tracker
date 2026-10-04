// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import DifficultySelect from "@/components/DifficultySelect";

import { character, difficulty, task } from "./fixtures";

afterEach(cleanup);

const serca = task({
  difficulties: [difficulty(10, "Normal", 1710, 32000), difficulty(11, "Hard", 1730, 44000), difficulty(12, "Nightmare", 1740, null)],
});

describe("DifficultySelect", () => {
  it("lists each difficulty with its gold and the item level still needed", () => {
    render(<DifficultySelect task={serca} character={character()} value={11} onChange={() => {}} label="Serca difficulty" />);
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Normal · 32k", "Hard · 44k", "Nightmare · ? (needs 1740)"]);
    expect(screen.getByRole("combobox", { name: "Serca difficulty" })).toHaveProperty("value", "11");
  });

  it("reports the chosen difficulty, or null for the empty choice", async () => {
    const onChange = vi.fn();
    render(
      <DifficultySelect task={serca} character={character()} value={null} onChange={onChange} noneLabel="Doesn't run" label="Serca" />,
    );
    const select = screen.getByRole("combobox", { name: "Serca" });
    await userEvent.selectOptions(select, "12");
    expect(onChange).toHaveBeenLastCalledWith(12);
    await userEvent.selectOptions(select, "");
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("marks a difficulty above the character's item level", () => {
    render(<DifficultySelect task={serca} character={character({ item_level: 1720 })} value={11} onChange={() => {}} label="Serca" />);
    expect(screen.getByRole("combobox").className).toContain("text-danger");
  });

  it("leaves gold off for non-raid tiers", () => {
    const hourglass = task({ name: "Haal's Hourglass", category: "weekly", difficulties: [difficulty(20, "Lv1", 1730, 0)] });
    render(<DifficultySelect task={hourglass} character={character()} value={20} onChange={() => {}} label="Hourglass" />);
    expect(screen.getByRole("option").textContent).toBe("Lv1");
  });
});
