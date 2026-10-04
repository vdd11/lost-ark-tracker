// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import RestGauge from "@/components/RestGauge";

import { rest, task } from "./fixtures";

afterEach(cleanup);

const chaos = task({ name: "Chaos Dungeon", category: "daily", rest_max: 200, rest_gain: 20, rest_cost: 40 });
const label = "Chaos Dungeon rest bonus for Bardy";

describe("RestGauge", () => {
  it("steps by a day's rest and stays within the gauge", async () => {
    const onSet = vi.fn();
    render(<RestGauge task={chaos} state={rest({ value: 190 })} characterName="Bardy" onSet={onSet} />);
    await userEvent.click(screen.getByRole("button", { name: `More ${label}` }));
    expect(onSet).toHaveBeenLastCalledWith(200);
    await userEvent.click(screen.getByRole("button", { name: `Less ${label}` }));
    expect(onSet).toHaveBeenLastCalledWith(170);
  });

  it("can't go below empty or past full", () => {
    const { rerender } = render(<RestGauge task={chaos} state={rest({ value: 0 })} characterName="Bardy" onSet={() => {}} />);
    expect(screen.getByRole("button", { name: `Less ${label}` })).toHaveProperty("disabled", true);
    rerender(<RestGauge task={chaos} state={rest({ value: 200 })} characterName="Bardy" onSet={() => {}} />);
    expect(screen.getByRole("button", { name: `More ${label}` })).toHaveProperty("disabled", true);
  });

  it("takes the exact value from the game when typed, and Escape cancels", async () => {
    const onSet = vi.fn();
    render(<RestGauge task={chaos} state={rest({ value: 40 })} characterName="Bardy" onSet={onSet} />);
    await userEvent.click(screen.getByRole("button", { name: `${label}: 40 of 200. Click to edit` }));
    const input = screen.getByRole("spinbutton", { name: label });
    await userEvent.clear(input);
    await userEvent.type(input, "125{Enter}");
    expect(onSet).toHaveBeenCalledTimes(1);
    expect(onSet).toHaveBeenLastCalledWith(125);

    await userEvent.click(screen.getByRole("button", { name: /Click to edit/ }));
    await userEvent.type(screen.getByRole("spinbutton"), "9{Escape}");
    expect(onSet).toHaveBeenCalledTimes(1);
  });

  it("shows the Rested badge only when today's run gets the bonus", () => {
    const { rerender } = render(
      <RestGauge task={chaos} state={rest({ rested_run_available: true })} characterName="Bardy" onSet={() => {}} />,
    );
    expect(screen.queryByText("Rested")).not.toBeNull();
    rerender(<RestGauge task={chaos} state={rest({ value: 10, rested_run_available: false })} characterName="Bardy" onSet={() => {}} />);
    expect(screen.queryByText("Rested")).toBeNull();
  });
});
