// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import FirstRun from "@/components/tracker/FirstRun";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { TrackerView } from "@/components/tracker/useTrackerView";
import { Character } from "@/lib/api";

import { character } from "./fixtures";

afterEach(cleanup);

function setup(characters: Character[]) {
  const data = {
    allCharacters: characters,
    accounts: [{ id: 1, name: "Main", position: 0, characters: characters.length }],
    tasks: [],
    reload: vi.fn(),
    setError: vi.fn(),
    actions: { setGoldEarner: vi.fn() },
  } as unknown as TrackerData;
  const view = { applyStyle: vi.fn() } as unknown as TrackerView;
  const onStart = vi.fn();
  const onFinish = vi.fn();
  render(<FirstRun data={data} view={view} onStart={onStart} onFinish={onFinish} />);
  return { data, view, onStart, onFinish };
}

describe("FirstRun", () => {
  it("walks from the play style to adding characters, which needs at least one", async () => {
    const { view, onStart } = setup([]);
    expect(screen.getByRole("button", { name: /How much to track/ }).getAttribute("aria-current")).toBe("step");
    await userEvent.click(screen.getByRole("button", { name: /Just raids/ }));
    expect(view.applyStyle).toHaveBeenCalledWith("casual");
    expect(onStart).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Add your characters/ }).getAttribute("aria-current")).toBe("step");
    expect((screen.getByRole("button", { name: "Next: who earns gold" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("lists who was added, then toggles gold earners per account and finishes", async () => {
    const bard = character({ id: 7, name: "Bardy", class_name: "Bard", is_gold_earner: false });
    const sorc = character({ id: 8, name: "Sorcy", class_name: "Sorceress", is_gold_earner: true });
    const { data, onFinish } = setup([bard, sorc]);
    // With characters already added (e.g. after a reload mid-way), it picks up at the roster step.
    expect(screen.getByRole("button", { name: /Add your characters/ }).getAttribute("aria-current")).toBe("step");
    expect(screen.getByRole("list", { name: "Characters added" }).textContent).toContain("Bardy");

    await userEvent.click(screen.getByRole("button", { name: "Next: who earns gold" }));
    expect(screen.getByText("Main: 1 of 6 gold earners")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Bardy/ }));
    expect(data.actions.setGoldEarner).toHaveBeenCalledWith(bard, true);

    await userEvent.click(screen.getByRole("button", { name: "Done: show my tracker" }));
    expect(onFinish).toHaveBeenCalled();
  });
});
