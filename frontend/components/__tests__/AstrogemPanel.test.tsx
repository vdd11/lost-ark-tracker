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
  const onNewGem = vi.fn();
  const onRefresh = vi.fn();
  render(
    <AstrogemPanel
      session={session}
      options={OPTIONS}
      baseCost={900}
      maxAttempts={9}
      maxRefreshes={2}
      advice={null}
      save={save}
      onApply={onApply}
      onNewGem={onNewGem}
      onRefresh={onRefresh}
    />,
  );
  return { save, onApply, onNewGem, onRefresh };
}

describe("AstrogemPanel", () => {
  it("picks the gem type, which limits the effects and names the points", async () => {
    const { save } = renderPanel({ ...newSession("epic", BUILT_IN_ODDS), gemType: "chaos-distortion" });
    expect(screen.getByLabelText("Chaos Points level")).toBeTruthy();
    const effects = within(screen.getByLabelText("First effect")).getAllByRole("option").map((o) => o.textContent);
    expect(effects).toEqual(["Effect 1?", "Attack Power", "Boss Damage", "Ally Damage Enh.", "Ally Attack Power Enh."]);

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

  it("starts a new gem at a grade and counts refreshes, like the game's window", async () => {
    const { onNewGem, onRefresh, save } = renderPanel(newSession("epic", BUILT_IN_ODDS));
    expect(screen.getByRole("heading", { name: "Processing" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Epic (9)" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Rare (7)" }));
    expect(onNewGem).toHaveBeenCalledWith("rare");

    await userEvent.click(screen.getByRole("button", { name: /Refresh \(2\/2\)/ }));
    expect(onRefresh).toHaveBeenCalled();
    await userEvent.selectOptions(screen.getByLabelText("Refreshes left"), "1");
    expect(save.mock.calls[0][0].gem.refreshesLeft).toBe(1);
  });

  it("names a side node's level by its effect once chosen", () => {
    renderPanel({ ...newSession("epic", BUILT_IN_ODDS), gemType: "order-solidity", effects: ["boss", null] });
    expect(screen.getByLabelText("Boss Damage level")).toBeTruthy();
    expect(screen.getByLabelText("Effect 2 level")).toBeTruthy();
  });
});
