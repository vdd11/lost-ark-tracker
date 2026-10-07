// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import LimitCounter from "@/components/LimitCounter";
import TaskLibrary from "@/components/settings/TaskLibrary";

afterEach(cleanup);

describe("LimitCounter", () => {
  it("counts up and down within the limit, and takes a typed number", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<LimitCounter value={0} limit={5} label="Elysian for Bardy" onChange={onChange} />);
    expect(screen.getByRole("group", { name: "Elysian for Bardy: 0 of 5" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "One fewer for Elysian for Bardy" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "One more for Elysian for Bardy" }));
    expect(onChange).toHaveBeenLastCalledWith(1);

    rerender(<LimitCounter value={5} limit={5} label="Elysian for Bardy" onChange={onChange} />);
    expect((screen.getByRole("button", { name: "One more for Elysian for Bardy" }) as HTMLButtonElement).disabled).toBe(true);

    // Typing more than the limit stops at the limit.
    rerender(<LimitCounter value={20} limit={300} label="Milestone Missions for Bardy" onChange={onChange} />);
    const field = screen.getByRole("textbox", { name: "Milestone Missions for Bardy count" });
    await userEvent.clear(field);
    await userEvent.type(field, "450{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(300);
  });
});

describe("TaskLibrary", () => {
  it("adds a confirmed entry as a task with its limit, and marks ones already there", async () => {
    const onAddTask = vi.fn();
    render(<TaskLibrary taskNames={["Milestone Missions"]} onAddTask={onAddTask} onAddCounter={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Add Elysian" }));
    expect(onAddTask).toHaveBeenCalledWith({ name: "Elysian", category: "weekly", run_limit: 5 });
    expect((screen.getByRole("button", { name: "Milestone Missions is added" }) as HTMLButtonElement).disabled).toBe(true);
    // Entries not confirmed by official notes aren't offered.
    expect(screen.queryByText("Daily Una's Tasks")).toBeNull();
  });
});
