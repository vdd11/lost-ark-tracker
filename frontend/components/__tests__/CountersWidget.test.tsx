// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import CountersWidget from "@/components/tracker/CountersWidget";
import { api, send } from "@/lib/api";

import { character } from "./fixtures";

const SEEDS = { id: 4, name: "Mokoko seeds", value: 30, target: 120, character_id: null, account_id: null, position: 1 };
const ALT_ONLY = { id: 5, name: "Alt tokens", value: 1, target: null, character_id: null, account_id: 9, position: 2 };

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: vi.fn(() => Promise.resolve([SEEDS, ALT_ONLY])),
  send: vi.fn(() => Promise.resolve()),
}));

afterEach(() => {
  cleanup();
  vi.mocked(send).mockClear();
});

describe("CountersWidget", () => {
  it("shows this account's and shared counters and counts up and down", async () => {
    const user = userEvent.setup();
    render(<CountersWidget characters={[character({ id: 7, name: "Bardy" })]} accountId={1} onError={() => {}} />);
    expect(await screen.findByText("Mokoko seeds")).toBeTruthy();
    expect(screen.queryByText("Alt tokens")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Mokoko seeds plus one" }));
    expect(send).toHaveBeenCalledWith("PATCH", "/counters/4", { add: 1 });
    await user.click(screen.getByRole("button", { name: "Mokoko seeds minus one" }));
    expect(send).toHaveBeenCalledWith("PATCH", "/counters/4", { add: -1 });
    expect(api).toHaveBeenCalledWith("/counters");
  });

  it("adds a counter for a character with a target", async () => {
    const user = userEvent.setup();
    render(<CountersWidget characters={[character({ id: 7, name: "Bardy" })]} accountId={1} onError={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Add / edit" }));
    await user.type(screen.getByLabelText("Counter name"), "Island tokens");
    await user.type(screen.getByLabelText("Counter target"), "50");
    await user.selectOptions(screen.getByLabelText("Counter for"), "7");
    await user.click(screen.getByRole("button", { name: "Add counter" }));
    expect(send).toHaveBeenCalledWith("POST", "/counters", { name: "Island tokens", target: 50, character_id: 7, account_id: null, resets: "never" });
  });
});
