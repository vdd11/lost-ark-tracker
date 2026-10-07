import { expect, Page, test } from "@playwright/test";

// What's new after an update: once, from the notes bundled with the app.
test.describe.configure({ mode: "serial" });

let running = "";

test.beforeAll(async ({ request }) => {
  running = (await (await request.get("/api/")).json()).version;
  // It only shows once there's a roster (never over first-run setup).
  if ((await (await request.get("/api/characters")).json()).length === 0) {
    await request.post("/api/characters", { data: { name: "Newsy", class_name: "Bard", item_level: 1700 } });
  }
});

/** Storage as a browser that last ran `stored` would have it; set once, so reloads keep what the app saved. */
async function asIfLastSeen(page: Page, stored: Record<string, string>) {
  await page.addInitScript((values) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.clear();
    localStorage.setItem("lost-ark-tracker:first-run", JSON.stringify("done"));
    localStorage.setItem("lost-ark-tracker:style-chosen", JSON.stringify(true));
    for (const [key, value] of Object.entries(values)) localStorage.setItem(`lost-ark-tracker:${key}`, JSON.stringify(value));
  }, stored);
}

const dialog = (page: Page) => page.getByRole("dialog", { name: "What's new" });

/** The nav shows the version once /api/ has answered, which is when What's new decides. */
async function settled(page: Page) {
  await expect(page.getByRole("button", { name: `v${running}` })).toBeVisible();
  await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
}

test("shows once after an update, then never again for that version", async ({ page }) => {
  await asIfLastSeen(page, { "last-seen-version": "1.0.0" });
  await page.goto("/");
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByText(`Updated to ${running}`)).toBeVisible();
  await expect(dialog(page).getByRole("region", { name: `Version ${running}` })).toBeVisible();
  await dialog(page).getByRole("button", { name: "Got it" }).click();
  await expect(dialog(page)).toBeHidden();

  await page.reload();
  await settled(page);
  await expect(dialog(page)).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("lost-ark-tracker:last-seen-version"))).toBe(JSON.stringify(running));
});

test("an update from 1.19 or earlier (which stored last-run-version) still shows it", async ({ page }) => {
  await asIfLastSeen(page, { "last-run-version": "1.0.0" });
  await page.goto("/");
  await expect(dialog(page)).toBeVisible();
});

test("a first install shows nothing and just remembers the version", async ({ page }) => {
  await asIfLastSeen(page, {});
  await page.goto("/");
  await settled(page);
  await expect(dialog(page)).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("lost-ark-tracker:last-seen-version")))
    .toBe(JSON.stringify(running));
});

test("the version in the nav opens every release's notes", async ({ page }) => {
  await asIfLastSeen(page, { "last-seen-version": running });
  await page.goto("/");
  await settled(page);
  await page.getByRole("button", { name: `v${running}` }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByText(/Updated to/)).toBeHidden();
  expect(await dialog(page).getByRole("region").count()).toBeGreaterThan(1);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
});
