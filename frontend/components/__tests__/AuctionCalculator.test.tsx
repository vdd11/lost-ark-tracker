// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import AuctionCalculator from "@/components/AuctionCalculator";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("AuctionCalculator", () => {
  it("shows the bid for the price, party size and whether you'll resell", async () => {
    render(<AuctionCalculator />);
    await userEvent.type(screen.getByRole("textbox", { name: "Market price" }), "10000");
    // 8 players, resell: 10,000 × 0.95 × 7/8 = 8,312 break-even; ÷ 1.1 = 7,556.
    expect(screen.getByText("7,556")).not.toBeNull();
    expect(screen.getByText("8,312")).not.toBeNull();

    await userEvent.click(screen.getByRole("radio", { name: "4" }));
    expect(screen.getByText("7,125")).not.toBeNull();

    await userEvent.click(screen.getByRole("checkbox", { name: /sell it/ }));
    expect(screen.getByText("7,500")).not.toBeNull();
  });
});
