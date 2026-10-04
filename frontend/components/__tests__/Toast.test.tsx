// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider, useUndo } from "@/components/Toast";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** A button that offers an undo, like a tick in the tracker does. */
function Offer({ message, undo }: { message: string; undo: () => Promise<void> }) {
  const offerUndo = useUndo();
  return <button onClick={() => offerUndo(message, undo)}>{`do ${message}`}</button>;
}

function setup(undo: () => Promise<void> = vi.fn(() => Promise.resolve())) {
  render(
    <ToastProvider>
      <Offer message="Serca done on Bardy" undo={undo} />
      <Offer message="Act 4 done on Bardy" undo={undo} />
    </ToastProvider>,
  );
  return undo;
}

const toast = () => screen.queryByRole("status");

describe("Undo toast", () => {
  it("offers undo, runs it, then confirms", async () => {
    const undo = setup();
    fireEvent.click(screen.getByText("do Serca done on Bardy"));
    expect(toast()?.textContent).toContain("Serca done on Bardy");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    });
    expect(undo).toHaveBeenCalledTimes(1);
    expect(toast()?.textContent).toContain("Undone");
  });

  it("goes away after a few seconds, but not while hovered", () => {
    setup();
    fireEvent.click(screen.getByText("do Serca done on Bardy"));
    fireEvent.mouseEnter(toast()!);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(toast()).not.toBeNull();
    fireEvent.mouseLeave(toast()!);
    act(() => {
      vi.advanceTimersByTime(6_100);
    });
    expect(toast()).toBeNull();
  });

  it("shows only the newest action", () => {
    setup();
    fireEvent.click(screen.getByText("do Serca done on Bardy"));
    fireEvent.click(screen.getByText("do Act 4 done on Bardy"));
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(toast()?.textContent).toContain("Act 4 done on Bardy");
  });

  it("says so when the undo fails", async () => {
    setup(vi.fn(() => Promise.reject(new Error("offline"))));
    fireEvent.click(screen.getByText("do Serca done on Bardy"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    });
    expect(toast()?.textContent).toContain("Couldn't undo that");
  });
});
