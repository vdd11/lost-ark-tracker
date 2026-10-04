// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ContentCell from "@/components/ContentCell";

import { character, difficulty, run, task } from "./fixtures";

afterEach(cleanup);

const second = difficulty(21, "2nd", 1680, 0);
const fourth = difficulty(23, "4th", 1720, 0);
const cube = task({ name: "Ebony Cube", category: "weekly", counted: true, difficulties: [second, fourth] });
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

  it("logs runs at a lower unlock from the details popover", async () => {
    const onChange = vi.fn();
    render(<ContentCell task={cube} character={bardy} tier={fourth} run={run({ count: 1 })} onChange={onChange} onRemove={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /details/ }));
    expect(screen.getByRole("dialog")).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "More 2nd unlock" }));
    expect(onChange).toHaveBeenLastCalledWith({ tier_counts: { 21: 1 } });
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

  it("records Sands of Trial once the run is done", async () => {
    const onChange = vi.fn();
    render(<ContentCell task={hourglass} character={bardy} tier={lv1} run={run()} onChange={onChange} onRemove={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /details/ }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "3");
    expect(onChange).toHaveBeenLastCalledWith({ sands: 3 });
  });
});
