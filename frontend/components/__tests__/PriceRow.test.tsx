// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import PriceRow from "@/components/tools/PriceRow";
import { Price } from "@/lib/prices";

afterEach(cleanup);

const item = (extra: Partial<Price> = {}): Price => ({
  key: "stone", name: "Stone", price: null, per: 1, unit_price: null, hidden: false, builtin: true, tools: [],
  updated_at: null, ...extra,
});

function renderRow(price: Price) {
  const onChange = vi.fn();
  const onRemove = vi.fn();
  render(
    <table>
      <tbody>
        <PriceRow item={price} now={new Date("2026-10-04T12:00:00Z")} onChange={onChange} onRemove={onRemove} />
      </tbody>
    </table>,
  );
  return { onChange, onRemove };
}

describe("PriceRow", () => {
  it("saves a typed price on Enter", async () => {
    const user = userEvent.setup();
    const { onChange } = renderRow(item());
    await user.type(screen.getByLabelText("Price of Stone"), "1,250{enter}");
    expect(onChange).toHaveBeenCalledWith({ price: 1250 });
  });

  it("ignores junk and unchanged values", async () => {
    const user = userEvent.setup();
    const { onChange } = renderRow(item({ price: 5, unit_price: 5 }));
    const input = screen.getByLabelText("Price of Stone");
    await user.clear(input);
    await user.type(input, "abc{enter}");
    await user.click(input);
    await user.keyboard("{enter}");
    expect(onChange).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe("5");
  });

  it("clearing the price removes it", async () => {
    const user = userEvent.setup();
    const { onChange } = renderRow(item({ price: 5, unit_price: 5 }));
    const input = screen.getByLabelText("Price of Stone");
    await user.clear(input);
    await user.keyboard("{enter}");
    expect(onChange).toHaveBeenCalledWith({ price: null });
  });

  it("built-in items reset; custom ones are renamed and deleted", async () => {
    const user = userEvent.setup();
    const builtin = renderRow(item());
    await user.click(screen.getByRole("button", { name: "Reset Stone" }));
    expect(builtin.onRemove).toHaveBeenCalled();
    cleanup();

    const custom = renderRow(item({ key: "custom-1", name: "Token", builtin: false }));
    const name = screen.getByLabelText("Item name");
    await user.clear(name);
    await user.type(name, "Coin{enter}");
    expect(custom.onChange).toHaveBeenCalledWith({ name: "Coin" });
    expect(screen.getByRole("button", { name: "Delete Token" })).toBeTruthy();
  });
});
