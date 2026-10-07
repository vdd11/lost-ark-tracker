import { expect, test } from "@playwright/test";

// A 375x812 phone: the first raid checkbox shows without scrolling.
test.use({ viewport: { width: 375, height: 812 } });

test.beforeAll(async ({ request }) => {
  const characters = await (await request.get("/api/characters")).json();
  if (!characters.some((c: { task_ids: number[] }) => c.task_ids.length > 0)) {
    const tasks: { id: number; name: string }[] = await (await request.get("/api/tasks")).json();
    const serca = tasks.find((t) => t.name === "Serca")!;
    await request.post("/api/characters", { data: { name: "Phoney", class_name: "Bard", item_level: 1735, raids: [{ task_id: serca.id }] } });
  }
});

test("the first character's raid checkboxes are on the first screen", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("lost-ark-tracker:first-run", JSON.stringify("done"));
    localStorage.setItem("lost-ark-tracker:style-chosen", JSON.stringify(true));
    // What's new would cover the page on a first visit after an update.
    localStorage.removeItem("lost-ark-tracker:last-seen-version");
  });
  await page.goto("/");
  const firstRaid = page.getByRole("checkbox", { name: /cleared by/ }).first();
  await expect(firstRaid).toBeVisible();

  const box = (await firstRaid.boundingBox())!;
  const bottomBar = (await page.getByRole("navigation").getByLabel("Pages").boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(bottomBar.y);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  // One row of icon buttons, each still named for screen readers.
  for (const name of ["What's left", "Customize", "Edit who does what"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  // Nothing sticks out sideways.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
