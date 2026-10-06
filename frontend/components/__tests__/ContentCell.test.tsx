// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ContentCell from "@/components/ContentCell";

import { character, difficulty, run, task } from "./fixtures";

afterEach(cleanup);

const first = difficulty(20, "1st", 1640, 0, { reward_gems: { "2": 6 } });
const second = difficulty(21, "2nd", 1680, 0, { reward_gems: { "2": 12 } });
const fourth = difficulty(23, "4th", 1720, 0, { reward_gems: { "2": 22 } });
const cube = task({ name: "Ebony Cube", category: "weekly", counted: true, difficulties: [first, second, fourth] });
const lv1 = difficulty(31, "Lv1", 1730, 0);
const hourglass = task({ name: "Haal's Hourglass", category: "weekly", sand_scaled: true, difficulties: [lv1] });
const bardy = character();

describe("ContentCell: Ebony Cube", () => {
  it("counts runs at the character's own unlock", async () => {
    const onChange = vi.fn();
    render(<ContentCell task={cube} character={bardy} tier={fourth} run={run({ count: 2 })} onChange={onChange} onRemove={() => {}} />);
    expect(screen.getByLabelText(/^2 Ebony Cube for Bardy runs/)).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "One more Ebony Cube for Bardy run" }));
    expect(onChange).toHaveBeenLastCalledWith({ count: 3 });
    await userEvent.click(screen.getByRole("button", { name: "One fewer Ebony Cube for Bardy run" }));
    expect(onChange).toHaveBeenLastCalledWith({ count: 1 });
  });

  it("can't go below zero runs", () => {
    render(<ContentCell task={cube} character={bardy} tier={fourth} run={undefined} onChange={() => {}} onRemove={() => {}} />);
    expect(screen.getByRole("button", { name: "One fewer Ebony Cube for Bardy run" })).toHaveProperty("disabled", true);
  });

  it("shows a ticket chip per unlock the character can enter, with gems per ticket", () => {
    const alt = character({ item_level: 1690 });
    render(<ContentCell task={cube} character={alt} tier={second} run={run({ count: 1, tier_counts: { "21": 1 } })} onChange={() => {}} onRemove={() => {}} />);
    const chips = screen.getAllByRole("button", { name: /unlock tickets/ });
    expect(chips.map((chip) => chip.getAttribute("aria-label"))).toEqual([
      "1st unlock tickets: 0. Add one",
      "2nd unlock tickets: 1. Add one",
    ]);
    expect(chips[1].getAttribute("title")).toBe("2nd unlock (1680, yours): Lv4 + Lv3 in gems per ticket");
  });

  it("logs lower-unlock tickets from their chip, by click or by keyboard", async () => {
    const onChange = vi.fn();
    render(<ContentCell task={cube} character={bardy} tier={fourth} run={run({ count: 1 })} onChange={onChange} onRemove={() => {}} />);
    const chip = screen.getByRole("button", { name: "2nd unlock tickets: 0. Add one" });
    await userEvent.click(chip);
    expect(onChange).toHaveBeenLastCalledWith({ tier_counts: { 21: 1 } });
    expect(screen.getByRole("button", { name: "One fewer 2nd unlock ticket" })).toHaveProperty("disabled", true);

    const outer = vi.fn();
    const { container } = render(
      <div onKeyDown={outer}>
        <ContentCell task={cube} character={bardy} tier={fourth} run={run({ count: 1, tier_counts: { "21": 2, "23": 1 } })} onChange={onChange} onRemove={() => {}} />
      </div>,
    );
    const second2 = container.querySelector('[aria-label="2nd unlock tickets: 2. Add one"]') as HTMLButtonElement;
    fireEvent.keyDown(second2, { key: "-" });
    expect(onChange).toHaveBeenLastCalledWith({ tier_counts: { 21: 1 } });
    fireEvent.keyDown(second2, { key: "+" });
    expect(onChange).toHaveBeenLastCalledWith({ tier_counts: { 21: 3 } });
    // The grid's own + and - (your unlock) don't also fire.
    expect(outer).not.toHaveBeenCalled();
  });

  it("logs lucky rooms under Extras once there's a run", async () => {
    const onChange = vi.fn();
    render(<ContentCell task={cube} character={bardy} tier={fourth} run={run({ count: 1 })} onChange={onChange} onRemove={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /extras/ }));
    await userEvent.click(screen.getByRole("button", { name: "More lucky rooms" }));
    expect(onChange).toHaveBeenLastCalledWith({ lucky_rooms: 1 });
  });
});

describe("ContentCell: Haal's Hourglass", () => {
  it("ticks and unticks the weekly run", async () => {
    const onChange = vi.fn();
    const onRemove = vi.fn();
    const { rerender } = render(
      <ContentCell task={hourglass} character={bardy} tier={lv1} run={undefined} onChange={onChange} onRemove={onRemove} />,
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "Haal's Hourglass for Bardy" }));
    expect(onChange).toHaveBeenCalledWith({});
    rerender(<ContentCell task={hourglass} character={bardy} tier={lv1} run={run()} onChange={onChange} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onRemove).toHaveBeenCalled();
  });

  it("sets Sands of Trial from 0-5 once the run is ticked", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ContentCell task={hourglass} character={bardy} tier={lv1} run={undefined} onChange={onChange} onRemove={() => {}} />);
    expect(screen.getByRole("radio", { name: "3 Sands of Trial" })).toHaveProperty("disabled", true);
    rerender(<ContentCell task={hourglass} character={bardy} tier={lv1} run={run({ sands: 1 })} onChange={onChange} onRemove={() => {}} />);
    expect(screen.getByRole("radio", { name: "1 Sands of Trial" }).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(screen.getByRole("radio", { name: "3 Sands of Trial" }));
    expect(onChange).toHaveBeenLastCalledWith({ sands: 3 });
  });
});
