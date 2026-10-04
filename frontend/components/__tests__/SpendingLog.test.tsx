// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import SpendingLog from "@/components/SpendingLog";
import { api, send } from "@/lib/api";

import { character } from "./fixtures";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: vi.fn(() => Promise.resolve([])),
  send: vi.fn(() => Promise.resolve()),
}));

afterEach(() => {
  cleanup();
  vi.mocked(send).mockClear();
  vi.mocked(api).mockClear();
});

function renderLog() {
  const onChanged = vi.fn();
  render(<SpendingLog characters={[character({ id: 7, name: "Bardy" })]} accountId={2} onChanged={onChanged} onError={() => {}} />);
  return onChanged;
}

describe("SpendingLog", () => {
  it("logs honing for a character, paid with bound gold first", async () => {
    const user = userEvent.setup();
    const onChanged = renderLog();
    await user.type(screen.getByLabelText("Gold spent"), "25000");
    await user.selectOptions(screen.getByLabelText("Character"), "7");
    await user.type(screen.getByLabelText("Note"), "+12 helmet");
    await user.click(screen.getByRole("button", { name: "Log spending" }));
    expect(send).toHaveBeenCalledWith("POST", "/spending", {
      category: "honing", amount: 25000, paid_from: "bound_first", character_id: 7, account_id: null, note: "+12 helmet",
    });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("market purchases can only be paid with tradeable gold", async () => {
    const user = userEvent.setup();
    renderLog();
    await user.selectOptions(screen.getByLabelText("Category"), "market");
    const paidWith = screen.getByLabelText("Paid with") as HTMLSelectElement;
    expect(paidWith.disabled).toBe(true);
    expect(paidWith.value).toBe("tradeable");
    await user.type(screen.getByLabelText("Gold spent"), "900");
    await user.click(screen.getByRole("button", { name: "Log spending" }));
    expect(send).toHaveBeenCalledWith("POST", "/spending", expect.objectContaining({ category: "market", paid_from: "tradeable", account_id: 2 }));
  });

  it("loads the account's spending", () => {
    renderLog();
    expect(api).toHaveBeenCalledWith("/spending?limit=200&account_id=2");
  });
});
