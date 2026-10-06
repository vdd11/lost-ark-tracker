// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import FieldDrops from "@/components/tracker/FieldDrops";
import { TrackerData } from "@/components/tracker/useTrackerData";

import { character } from "./fixtures";

const send = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  send: (...args: unknown[]) => send(...args),
}));

afterEach(() => {
  cleanup();
  send.mockReset();
});

function setup(dailyPeriod: string) {
  const data = {
    tracker: { daily_period: dailyPeriod },
    characters: [character({ id: 7, name: "Bardy" })],
    loadWeeklyGold: vi.fn(),
    setError: vi.fn(),
  } as unknown as TrackerData;
  render(<FieldDrops data={data} />);
  return data;
}

describe("FieldDrops", () => {
  it("names the next event on a day without one", () => {
    setup("2026-10-07"); // Wednesday
    expect(screen.getByText(/No Field Boss or Chaos Gate today; Chaos Gate tomorrow/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Log drops" })).toBeNull();
  });

  it("logs the gems and the gold from selling, for a character", async () => {
    send.mockResolvedValueOnce({ id: 11 }).mockResolvedValueOnce({ id: 12 });
    const data = setup("2026-10-04"); // Sunday: both
    expect(screen.getAllByRole("button", { name: "Log drops" })).toHaveLength(2);

    await userEvent.click(screen.getAllByRole("button", { name: "Log drops" })[1]); // Chaos Gate
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true); // nothing entered yet
    await userEvent.selectOptions(screen.getByLabelText("Chaos Gate character"), "7");
    await userEvent.type(screen.getByLabelText("Chaos Gate Lv3 gems"), "2");
    await userEvent.type(screen.getByLabelText("Chaos Gate gold from selling"), "5000");
    await userEvent.click(save);

    expect(send).toHaveBeenNthCalledWith(1, "POST", "/gem-entries", { source: "Chaos Gate", gems: { 3: 2 }, character_id: 7 });
    expect(send).toHaveBeenNthCalledWith(2, "POST", "/gold-entries", { source: "Chaos Gate", amount: 5000, character_id: 7 });
    expect(data.loadWeeklyGold).toHaveBeenCalled();
    expect(screen.getByText("logged 2× Lv3, 5,000 gold")).toBeTruthy();
  });
});
