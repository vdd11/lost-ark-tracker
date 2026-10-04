// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import HoningStepsEditor from "@/components/tools/HoningStepsEditor";
import { HoningPlan, newStep } from "@/lib/honing";
import { Price } from "@/lib/prices";

afterEach(cleanup);

const price = (key: string, name: string): Price => ({
  key, name, price: null, per: 1, unit_price: null, hidden: false, builtin: true, tools: ["honing"], updated_at: null,
});
const PRICES = [price("stone", "Stone"), price("leap", "Leapstone")];

function renderEditor(plan: HoningPlan) {
  const onChange = vi.fn();
  render(<HoningStepsEditor plan={plan} prices={PRICES} onChange={onChange} />);
  return onChange;
}

describe("HoningStepsEditor", () => {
  it("edits a step's chance, keeping it at most 100%", () => {
    const onChange = renderEditor({ steps: [{ ...newStep("a"), chance: 50 }], owned: {} });
    fireEvent.change(screen.getByLabelText("Step 1 chance"), { target: { value: "30" } });
    expect(onChange.mock.calls[0][0].steps[0].chance).toBe(30);
    fireEvent.change(screen.getByLabelText("Step 1 chance"), { target: { value: "150" } });
    expect(onChange.mock.calls[1][0].steps[0].chance).toBe(100);
  });

  it("leaves the cap and guarantee empty when cleared", () => {
    const onChange = renderEditor({ steps: [{ ...newStep("a"), chanceCap: 40, guaranteedBy: 5 }], owned: {} });
    fireEvent.change(screen.getByLabelText("Step 1 maximum chance"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Step 1 guaranteed by attempt"), { target: { value: "" } });
    expect(onChange.mock.calls[0][0].steps[0].chanceCap).toBeNull();
    expect(onChange.mock.calls[1][0].steps[0].guaranteedBy).toBeNull();
  });

  it("adds a material column and a step that copies the last one's materials", async () => {
    const user = userEvent.setup();
    const plan = { steps: [{ ...newStep("a"), label: "Armor", materials: { stone: 100 } }], owned: { stone: 50 } };
    const onChange = renderEditor(plan);
    expect(screen.getByLabelText("Stone you already have")).toBeTruthy();

    await user.selectOptions(screen.getByLabelText("Add a material column"), "leap");
    expect(onChange.mock.calls[0][0].owned).toEqual({ stone: 50, leap: 0 });

    await user.click(screen.getByRole("button", { name: "Add step" }));
    const added = onChange.mock.calls[1][0].steps[1];
    expect(added.materials).toEqual({ stone: 100 });
    expect(added.label).toBe("");
  });

  it("removes a material from every step", async () => {
    const user = userEvent.setup();
    const plan = { steps: [{ ...newStep("a"), materials: { stone: 1, leap: 2 } }], owned: { stone: 5 } };
    const onChange = renderEditor(plan);
    await user.click(screen.getByRole("button", { name: "Remove Stone" }));
    expect(onChange.mock.calls[0][0]).toEqual({ steps: [{ ...plan.steps[0], materials: { leap: 2 } }], owned: {} });
  });
});
