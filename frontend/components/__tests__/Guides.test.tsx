// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import GuideCard from "@/components/guides/GuideCard";
import GuideLinkForm from "@/components/guides/GuideLinkForm";
import { BUILT_IN_GUIDES } from "@/lib/guides";

afterEach(cleanup);

describe("GuideCard", () => {
  it("opens the link in a new tab without giving it access to the app", () => {
    render(<GuideCard guide={BUILT_IN_GUIDES[0]} onHide={() => {}} />);
    const link = screen.getByRole("link", { name: new RegExp(BUILT_IN_GUIDES[0].title) });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByRole("button", { name: `Hide ${BUILT_IN_GUIDES[0].title}` })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Delete/ })).toBeNull();
  });
});

describe("GuideLinkForm", () => {
  it("adds a link to My links by default and clears itself", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => Promise.resolve(true));
    render(<GuideLinkForm categories={["My links"]} onSave={onSave} onCancel={() => {}} />);
    await user.type(screen.getByLabelText("Link title"), " Guild ");
    await user.type(screen.getByLabelText("Link address"), "discord.gg/abc");
    await user.click(screen.getByRole("button", { name: "Add link" }));
    expect(onSave).toHaveBeenCalledWith({ title: "Guild", url: "discord.gg/abc", description: null, category: "My links" });
    expect((screen.getByLabelText("Link title") as HTMLInputElement).value).toBe("");
  });

  it("keeps what was typed when saving fails", async () => {
    const user = userEvent.setup();
    render(<GuideLinkForm categories={[]} onSave={() => Promise.resolve(false)} onCancel={() => {}} />);
    await user.type(screen.getByLabelText("Link title"), "Bad");
    await user.type(screen.getByLabelText("Link address"), "javascript:alert(1)");
    await user.click(screen.getByRole("button", { name: "Add link" }));
    expect((screen.getByLabelText("Link title") as HTMLInputElement).value).toBe("Bad");
  });

  it("edits an existing link", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => Promise.resolve(true));
    const link = { id: 1, title: "Guild", url: "https://discord.gg/abc", description: "chat", category: "Friends", position: 1 };
    render(<GuideLinkForm link={link} categories={["Friends"]} onSave={onSave} onCancel={() => {}} />);
    const title = screen.getByLabelText("Link title");
    await user.clear(title);
    await user.type(title, "Guild chat");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith({ title: "Guild chat", url: "https://discord.gg/abc", description: "chat", category: "Friends" });
  });
});
