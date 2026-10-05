// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import AstrogemPanel from "@/components/tools/AstrogemPanel";
import { BUILT_IN_ODDS, newSession, optionsWith, Session } from "@/lib/astrogemSession";

afterEach(cleanup);

const OPTIONS = optionsWith(BUILT_IN_ODDS);

function renderPanel(session: Session) {
  const save = vi.fn();
  const onApply = vi.fn();
  render(<AstrogemPanel session={session} options={OPTIONS} baseCost={900} advice={null} save={save} onApply={onApply} />);
  return { save, onApply };
}

describe("AstrogemPanel", () => {
  it("picks the gem type, which limits the effects and names the points", async () => {
    const { save } = renderPanel({ ...newSession("epic", BUILT_IN_ODDS), gemType: "chaos-distortion" });
    expect(screen.getByLabelText("Chaos Points level")).toBeTruthy();
    const effects = within(screen.getByLabelText("First effect")).getAllByRole("option").map((o) => o.textContent);
    expect(effects).toEqual(["Which effect?", "Attack Power", "Boss Damage", "Ally Damage Enh.", "Ally Attack Power Enh."]);

    await userEvent.selectOptions(screen.getByLabelText("Astrogem type"), "order-immutability");
    expect(save.mock.calls[0][0]).toMatchObject({ gemType: "order-immutability", effects: [null, null] });
  });

  it("sets levels and offered options from dropdowns, greying out options the gem can't get", async () => {
    const { save } = renderPanel(newSession("epic", BUILT_IN_ODDS));
    await userEvent.selectOptions(screen.getByLabelText("Willpower Efficiency level"), "3");
    expect(save.mock.calls[0][0].gem.levels.willpower).toBe(3);

    const slot2 = screen.getByLabelText("Option 2 offered");
    // Every stat is at level 1, so no "-1" can be offered.
    expect((within(slot2).getByRole("option", { name: "Willpower -1" }) as HTMLOptionElement).disabled).toBe(true);
    await userEvent.selectOptions(slot2, "points+2");
    expect(save.mock.calls[1][0].shown).toEqual(["", "points+2"]);
  });

  it("reports which offered option the game applied", async () => {
    const { onApply } = renderPanel({ ...newSession("epic", BUILT_IN_ODDS), shown: ["points+1", "keep", "change1", "willpower+2"] });
    expect((screen.getByLabelText("Option 3 offered") as HTMLSelectElement).value).toBe("change1");
    await userEvent.click(screen.getByRole("button", { name: /Applied \(3\)/ }));
    expect(onApply).toHaveBeenCalledWith(2);
  });
});
