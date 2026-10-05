// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CustomizePanel from "@/components/tracker/CustomizePanel";
import { WIDGET_KEYS } from "@/lib/trackerView";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPanel(hidden = new Set<string>()) {
  const handlers = { onSave: vi.fn(), onClose: vi.fn(), onArrange: vi.fn() };
  render(<CustomizePanel tasks={[]} hidden={hidden} {...handlers} />);
  return handlers;
}

describe("CustomizePanel", () => {
  it("changes nothing until Save, then applies the draft", async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = renderPanel();
    await user.click(screen.getByRole("checkbox", { name: "Gold goal" }));
    await user.click(screen.getByRole("checkbox", { name: "Counters you keep by hand" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(localStorage.getItem("lost-ark-tracker:widget-counters")).toBeNull();
    expect(screen.getByText("Unsaved changes")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith(new Set([WIDGET_KEYS.goldGoal]), false);
    expect(localStorage.getItem("lost-ark-tracker:widget-counters")).toBe("true");
    expect(onClose).toHaveBeenCalled();
  });

  it("Cancel discards changes after asking", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { onSave, onClose } = renderPanel();
    await user.click(screen.getByRole("checkbox", { name: "Gold goal" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("Cancel with nothing changed closes without asking, and Esc cancels too", () => {
    const confirm = vi.spyOn(window, "confirm");
    const { onClose } = renderPanel();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(confirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the draft if you decide not to discard", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onClose } = renderPanel();
    await user.click(screen.getByRole("checkbox", { name: "Gold goal" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect((screen.getByRole("checkbox", { name: "Gold goal" }) as HTMLInputElement).checked).toBe(false);
  });
});
