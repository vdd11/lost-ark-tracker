// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import PasteRoster from "@/components/settings/PasteRoster";
import { send } from "@/lib/api";

import { character } from "./fixtures";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  send: vi.fn(() => Promise.resolve()),
}));

afterEach(() => {
  cleanup();
  vi.mocked(send).mockClear();
});

describe("PasteRoster", () => {
  it("previews the pasted lines and adds only the good ones", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(
      <PasteRoster
        accounts={[{ id: 1, name: "Main", position: 0, characters: 1 }]}
        characters={[character({ name: "Bardy" })]}
        raids={[]}
        onDone={onDone}
        onError={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: /paste a roster/i }));
    await user.type(screen.getByLabelText("Characters to add"), "Sorcy Sorceress 1720{enter}Bardy Bard 1700{enter}Nobody 1600");

    expect(screen.getByText("Sorcy")).toBeTruthy();
    expect(screen.getByText(/already on your roster/i)).toBeTruthy();
    expect(screen.getByText(/no class found/i)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Add 1 character" }));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("POST", "/characters", expect.objectContaining({ name: "Sorcy", class_name: "Sorceress", item_level: 1720, is_gold_earner: true, account_id: 1 }));
    expect(onDone).toHaveBeenCalled();
  });
});

describe("PasteRoster from a page without classes", () => {
  it("asks for each class, and adds a character once it's picked", async () => {
    const user = userEvent.setup();
    render(<PasteRoster accounts={[{ id: 1, name: "Main", position: 0, characters: 0 }]} characters={[]} raids={[]} onDone={() => {}} onError={() => {}} />);
    await user.click(screen.getByRole("button", { name: /paste a roster/i }));
    await user.type(screen.getByLabelText("Characters to add"), "Lfsorakagf{enter}1776.67{enter}5912.65{enter}Last updated 55 minutes ago");

    expect((screen.getByRole("button", { name: "Add 0 characters" }) as HTMLButtonElement).disabled).toBe(true);
    await user.selectOptions(screen.getByRole("combobox", { name: "Class for Lfsorakagf" }), "Sorceress");
    await user.click(screen.getByRole("button", { name: "Add 1 character" }));
    expect(send).toHaveBeenCalledWith("POST", "/characters", expect.objectContaining({ name: "Lfsorakagf", class_name: "Sorceress", item_level: 1776.67 }));
  });
});
