// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import RaidGroupsWidget from "@/components/tracker/RaidGroupsWidget";
import { send } from "@/lib/api";

import { character, task } from "./fixtures";

const STATIC = { id: 3, name: "Wed static", task_id: 1, schedule: "Wed 20:00", members: ["Bardy", "Sorcy", "Friendo"], notes: null, position: 1 };

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: vi.fn(() => Promise.resolve([STATIC])),
  send: vi.fn(() => Promise.resolve()),
}));

afterEach(() => {
  cleanup();
  vi.mocked(send).mockClear();
});

const ROSTER = [character({ id: 7, name: "Bardy" }), character({ id: 8, name: "Sorcy" })];

function renderWidget() {
  render(
    <RaidGroupsWidget characters={ROSTER} raids={[task({ id: 1, name: "Serca" })]} isDone={(c) => c === 7} onError={() => {}} />,
  );
}

describe("RaidGroupsWidget", () => {
  it("shows which of your characters in a group still need the raid", async () => {
    renderWidget();
    expect(await screen.findByText("Wed static")).toBeTruthy();
    expect(screen.getByText(/Serca · Wed 20:00/)).toBeTruthy();
    expect(screen.getByTitle("Done this week").textContent).toBe("Bardy");
    expect(screen.getByTitle("Still needs it this week").textContent).toBe("Sorcy");
    expect(screen.getByTitle("Not one of your characters").textContent).toBe("Friendo");
    expect(screen.getByText("1 of yours still needs it this week")).toBeTruthy();
  });

  it("adds a group with its members", async () => {
    const user = userEvent.setup();
    renderWidget();
    await user.click(screen.getByRole("button", { name: "Add group" }));
    await user.type(screen.getByLabelText("Group name"), "Fri pug");
    await user.selectOptions(screen.getByLabelText("Group raid"), "1");
    await user.type(screen.getByLabelText("Group members"), "Bardy, Healy,, Bardy");
    await user.click(screen.getByRole("button", { name: "Save group" }));
    expect(send).toHaveBeenCalledWith("POST", "/raid-groups", { name: "Fri pug", task_id: 1, schedule: null, members: ["Bardy", "Healy"] });
  });
});
