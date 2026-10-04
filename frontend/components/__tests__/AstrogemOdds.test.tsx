// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import AstrogemOdds from "@/components/tools/AstrogemOdds";
import { BUILT_IN_ODDS, parseOdds } from "@/lib/astrogemSession";

afterEach(cleanup);

describe("AstrogemOdds", () => {
  it("edits a weight and the attempts, keeping the rest built-in", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AstrogemOdds raw="" odds={BUILT_IN_ODDS} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /show the odds/i }));
    expect(screen.getByText(/official probability disclosure/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("No change weight"), { target: { value: "5" } });
    const edited = parseOdds(onChange.mock.calls[0][0]);
    expect(edited.weights.keep).toBe(5);
    expect(edited.weights["points+1"]).toBe(11.65);

    fireEvent.change(screen.getByLabelText("Epic attempts"), { target: { value: "10" } });
    expect(parseOdds(onChange.mock.calls[1][0]).grades.epic.attempts).toBe(10);
  });

  it("resets edited odds to built-in", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const raw = JSON.stringify({ ...BUILT_IN_ODDS, baseCost: 1000 });
    render(<AstrogemOdds raw={raw} odds={parseOdds(raw)} onChange={onChange} />);
    expect(screen.getByText("edited")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Reset to built-in" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
