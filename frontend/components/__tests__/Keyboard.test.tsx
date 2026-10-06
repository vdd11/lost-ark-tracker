// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import TaskTable from "@/components/tracker/TaskTable";
import { Character, Task } from "@/lib/api";

import { character, task } from "./fixtures";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeAll(() => {
  // The wide (table) layout.
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  push.mockClear();
});

const CHARACTERS = [character({ id: 1, name: "Bardy" }), character({ id: 2, name: "Sorcy" })];
const TASKS = [task({ id: 10, name: "Serca" }), task({ id: 11, name: "Act 4" }), task({ id: 12, name: "Cube" })];

function renderGrid() {
  const calls = { toggle: vi.fn(), increment: vi.fn(), decrement: vi.fn(), all: vi.fn() };
  render(
    <KeyboardShortcuts>
      <button>before</button>
      <TaskTable
        characters={CHARACTERS}
        columns={TASKS}
        onItemLevel={() => {}}
        renderCell={(c: Character, t: Task) => <input type="checkbox" aria-label={`${t.name} box for ${c.name}`} onChange={() => {}} />}
        cellKeyboard={(c: Character, t: Task) => ({
          label: `${t.name} – ${c.name}`,
          toggle: () => calls.toggle(c.name, t.name),
          increment: () => calls.increment(c.name, t.name),
          decrement: () => calls.decrement(c.name, t.name),
        })}
        onRowAll={(c: Character) => calls.all(c.name)}
      />
    </KeyboardShortcuts>,
  );
  return calls;
}

const focused = () => document.activeElement?.getAttribute("aria-label");

/** Tab from the button before the table until focus reaches the grid (past the character's own controls). */
async function tabIntoGrid(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("before"));
  for (let i = 0; i < 6 && !(focused() ?? "").includes(" – "); i++) await user.tab();
}

describe("tracker grid keyboard", () => {
  it("shows each character's class icon beside the name", () => {
    renderGrid();
    const icons = [...document.querySelectorAll("tbody img")].map((img) => img.getAttribute("src") ?? "");
    expect(icons.length).toBe(2);
    expect(icons.every((src) => /\/game-icons\/class-[a-z]+\.webp$/.test(src))).toBe(true);
  });

  it("is one Tab stop, and arrows, Home and End move between cells", async () => {
    const user = userEvent.setup();
    renderGrid();
    await tabIntoGrid(user);
    expect(focused()).toBe("Serca – Bardy");
    await user.keyboard("{ArrowRight}");
    expect(focused()).toBe("Act 4 – Bardy");
    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe("Act 4 – Sorcy");
    await user.keyboard("{End}");
    expect(focused()).toBe("Cube – Sorcy");
    await user.keyboard("{Home}");
    expect(focused()).toBe("Serca – Sorcy");
    await user.keyboard("{ArrowUp}");
    expect(focused()).toBe("Serca – Bardy");
  });

  it("Space ticks the focused cell once; +, - and a act on it", async () => {
    const user = userEvent.setup();
    const calls = renderGrid();
    await tabIntoGrid(user);
    await user.keyboard(" ");
    expect(calls.toggle).toHaveBeenCalledTimes(1);
    expect(calls.toggle).toHaveBeenCalledWith("Bardy", "Serca");
    await user.keyboard("{ArrowRight}{ArrowRight}+-");
    expect(calls.increment).toHaveBeenCalledWith("Bardy", "Cube");
    expect(calls.decrement).toHaveBeenCalledWith("Bardy", "Cube");
    await user.keyboard("a");
    expect(calls.all).toHaveBeenCalledWith("Bardy");
  });

  it("keeps working after a click puts focus on the checkbox inside a cell", async () => {
    const user = userEvent.setup();
    const calls = renderGrid();
    await user.click(screen.getByRole("checkbox", { name: "Serca box for Sorcy" }));
    expect(focused()).toBe("Serca box for Sorcy");
    // Space belongs to the checkbox itself: the cell doesn't toggle it a second time.
    await user.keyboard(" ");
    expect(calls.toggle).not.toHaveBeenCalled();
    await user.keyboard("{ArrowRight}");
    expect(focused()).toBe("Act 4 – Sorcy");
    await user.click(screen.getByRole("checkbox", { name: "Act 4 box for Bardy" }));
    await user.keyboard("a");
    expect(calls.all).toHaveBeenCalledWith("Bardy");
  });
});

describe("global shortcuts", () => {
  it("g then a letter goes to a page, from the grid too", async () => {
    const user = userEvent.setup();
    renderGrid();
    await user.click(screen.getByRole("checkbox", { name: "Serca box for Bardy" }));
    await user.keyboard("go");
    expect(push).toHaveBeenCalledWith("/tools/");
  });

  it("? opens the cheat sheet and Esc closes it", async () => {
    const user = userEvent.setup();
    renderGrid();
    await user.click(screen.getByText("before"));
    await user.keyboard("?");
    expect(screen.getByRole("dialog", { name: /keyboard shortcuts/i })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
