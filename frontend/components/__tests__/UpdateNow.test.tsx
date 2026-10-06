// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UpdateDialog } from "@/components/UpdateNotice";

const api = vi.fn();
const send = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: (...args: unknown[]) => api(...args),
  send: (...args: unknown[]) => send(...args),
}));

afterEach(() => {
  cleanup();
  api.mockReset();
  send.mockReset();
});

const release = (assets: string[]) => ({
  version: "1.19.0",
  url: "https://github.com/vdd11/lost-ark-tracker/releases/tag/v1.19.0",
  notes: "## New\n- Something",
  assets: assets.map((name) => ({ name, url: `https://example.test/${name}` })),
});

describe("Update now", () => {
  it("installs, waits for the new version and reloads the page", async () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload } });
    api.mockImplementation(async (path: string) => (path === "/update/status" ? { supported: true } : { version: "1.19.0" }));
    send.mockResolvedValue({ version: "1.19.0" });

    render(<UpdateDialog release={release(["LostArkTracker-windows.exe", "SHA256SUMS"])} running={{ version: "1.18.0", platform: "windows" }} onClose={() => {}} />);
    await userEvent.click(await screen.findByRole("button", { name: /Update now/ }));
    expect(send).toHaveBeenCalledWith("POST", "/update/install");
    expect(await screen.findByText(/Installed 1.19.0/)).toBeTruthy();
    await waitFor(() => expect(reload).toHaveBeenCalled(), { timeout: 3000 });
    expect(screen.getByText("Or update by hand")).toBeTruthy();
  });

  it("explains a failure and keeps the manual steps", async () => {
    api.mockResolvedValue({ supported: true });
    send.mockRejectedValue(new Error("The download didn't match its checksum, so it wasn't installed."));
    render(<UpdateDialog release={release(["LostArkTracker-windows.exe", "SHA256SUMS"])} running={{ version: "1.18.0", platform: "windows" }} onClose={() => {}} />);
    await userEvent.click(await screen.findByRole("button", { name: /Update now/ }));
    expect(await screen.findByText(/didn't match its checksum/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Download for Windows/ })).toBeTruthy();
  });

  it("isn't offered for a release without checksums, or when running from source", async () => {
    api.mockResolvedValue({ supported: true });
    const { unmount } = render(<UpdateDialog release={release(["LostArkTracker-windows.exe"])} running={{ version: "1.18.0", platform: "windows" }} onClose={() => {}} />);
    await waitFor(() => expect(api).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Update now/ })).toBeNull();
    expect(screen.getByText("How to update")).toBeTruthy();
    unmount();

    api.mockResolvedValue({ supported: false });
    render(<UpdateDialog release={release(["LostArkTracker-windows.exe", "SHA256SUMS"])} running={{ version: "1.18.0", platform: "windows" }} onClose={() => {}} />);
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: /Update now/ })).toBeNull();
  });
});
