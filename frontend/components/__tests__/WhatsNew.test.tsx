// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import WhatsNewDialog from "@/components/WhatsNew";
import { WhatsNewEntry } from "@/lib/whatsNew";

afterEach(cleanup);

const entries: WhatsNewEntry[] = [
  { version: "1.19.0", date: "2026-10-06", highlights: [{ icon: "gold", text: "Simpler gold boxes" }, "Blessings"] },
  {
    version: "1.20.0",
    date: "2026-10-20",
    highlights: ["What's new after an update"],
    sections: [{ title: "Fixes", items: ["Lighter load"] }],
  },
];

describe("WhatsNewDialog", () => {
  it("after an update: says so, lists each new release's highlights, newest first, and links the notes", () => {
    render(<WhatsNewDialog entries={entries} updatedTo="1.20.0" onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: "What's new" })).toBeTruthy();
    expect(screen.getByText("Updated to 1.20.0")).toBeTruthy();
    const versions = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(versions).toEqual(["Version 1.20.0", "Version 1.19.0"]);
    expect(screen.getByText("Simpler gold boxes")).toBeTruthy();
    // Highlights only: the full notes are a link away.
    expect(screen.queryByText("Lighter load")).toBeNull();
    const links = screen.getAllByRole("link", { name: /Full release notes/ }).map((a) => a.getAttribute("href"));
    expect(links).toContain("https://github.com/vdd11/lost-ark-tracker/releases/tag/v1.20.0");
  });

  it("opened by hand: every section, no 'Updated to'", () => {
    render(<WhatsNewDialog entries={entries} onClose={() => {}} />);
    expect(screen.queryByText(/Updated to/)).toBeNull();
    expect(screen.getByText("Lighter load")).toBeTruthy();
  });

  it("starts on its button, keeps Tab inside, and closes with Esc or the button", async () => {
    const onClose = vi.fn();
    render(<WhatsNewDialog entries={entries} updatedTo="1.20.0" onClose={onClose} />);
    const gotIt = screen.getByRole("button", { name: "Got it" });
    expect(document.activeElement).toBe(gotIt);

    // Tab from the last control wraps to the first (Close), and back.
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(gotIt);

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(gotIt);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
