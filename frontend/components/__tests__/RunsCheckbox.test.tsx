// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import RunsCheckbox from "@/components/RunsCheckbox";

afterEach(cleanup);

describe("RunsCheckbox", () => {
  it("is empty, half and full as runs are done, and clicks once per run", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<RunsCheckbox runs={0} needed={2} label="Chaos Dungeon done by Alpha" onClick={onClick} />);
    const box = screen.getByRole("checkbox", { name: "Chaos Dungeon done by Alpha (0 of 2 runs)" });
    expect(box.getAttribute("aria-checked")).toBe("false");

    await userEvent.click(box);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<RunsCheckbox runs={1} needed={2} label="Chaos Dungeon done by Alpha" onClick={onClick} />);
    expect(screen.getByRole("checkbox", { name: /1 of 2 runs/ }).getAttribute("aria-checked")).toBe("mixed");

    rerender(<RunsCheckbox runs={2} needed={2} label="Chaos Dungeon done by Alpha" onClick={onClick} />);
    expect(screen.getByRole("checkbox", { name: /2 of 2 runs/ }).getAttribute("aria-checked")).toBe("true");
  });
});
