import { expect, Page, test } from "@playwright/test";

// One roster for the whole file: a 1735 Bard who runs Serca (Hard, the
// hardest they can enter) and a 1705 Sorceress, on a fresh database.
test.describe.configure({ mode: "serial" });

type Task = { id: number; name: string; category: string };

test.beforeAll(async ({ request }) => {
  const tasks: Task[] = await (await request.get("/api/tasks")).json();
  const serca = tasks.find((t) => t.name === "Serca");
  expect(serca, "Serca is in the raid catalog").toBeTruthy();
  for (const character of [
    { name: "Alpha", class_name: "Bard", item_level: 1735, raids: [{ task_id: serca!.id }] },
    { name: "Bravo", class_name: "Sorceress", item_level: 1705 },
  ]) {
    const response = await request.post("/api/characters", { data: character });
    expect(response.status()).toBe(201);
  }
});

test.beforeEach(async ({ page }) => {
  // Skip the welcome steps and style chooser: straight to the tracker.
  await page.addInitScript(() => {
    localStorage.setItem("lost-ark-tracker:first-run", JSON.stringify("done"));
    localStorage.setItem("lost-ark-tracker:style-chosen", JSON.stringify(true));
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
});

const sercaDone = (page: Page) => page.getByRole("checkbox", { name: "Serca cleared by Alpha" });

test("ticking a raid saves it", async ({ page }) => {
  await expect(sercaDone(page)).not.toBeChecked();
  await sercaDone(page).click();
  await expect(sercaDone(page)).toBeChecked();
  await page.reload();
  await expect(sercaDone(page)).toBeChecked();
  await sercaDone(page).click();
  await expect(sercaDone(page)).not.toBeChecked();
});

test("changing a raid's difficulty saves it", async ({ page }) => {
  const difficulty = page.getByRole("combobox", { name: "Serca difficulty for Alpha" });
  await expect(difficulty).toHaveValue(/.+/);
  // Options read like "Normal · 32k".
  const normal = await difficulty.locator("option", { hasText: /^Normal/ }).getAttribute("value");
  await difficulty.selectOption(normal!);
  await expect(difficulty.locator("option:checked")).toHaveText(/^Normal/);
  await page.reload();
  await expect(difficulty.locator("option:checked")).toHaveText(/^Normal/);
});

test("Customize only applies on Save", async ({ page }) => {
  const chaos = page.getByRole("checkbox", { name: "Chaos Dungeon done by Alpha" });
  await expect(chaos).toBeVisible();
  const panel = page.locator("section", { hasText: "Customize the tracker" });
  const option = panel.getByRole("checkbox", { name: "Chaos Dungeon", exact: true });

  await page.getByRole("button", { name: "Customize" }).click();
  await option.uncheck();
  // Cancel asks before throwing changes away.
  const asked = page.waitForEvent("dialog").then(async (dialog) => {
    const message = dialog.message();
    await dialog.accept();
    return message;
  });
  await panel.getByRole("button", { name: "Cancel" }).click();
  expect(await asked).toBe("Discard your Customize changes?");
  await expect(panel).toBeHidden();
  await expect(chaos).toBeVisible();

  await page.getByRole("button", { name: "Customize" }).click();
  await option.uncheck();
  await panel.getByRole("button", { name: "Save", exact: true }).click();
  await expect(chaos).toBeHidden();

  // Put it back for the other tests.
  await page.getByRole("button", { name: "Customize" }).click();
  await option.check();
  await panel.getByRole("button", { name: "Save", exact: true }).click();
  await expect(chaos).toBeVisible();
});

test("the grid works from the keyboard", async ({ page }) => {
  const done = page.getByRole("checkbox", { name: "Chaos Dungeon done by Bravo" });
  await page.getByRole("group", { name: "Chaos Dungeon – Alpha – not done" }).focus();
  await page.keyboard.press("ArrowDown");
  const below = page.getByRole("group", { name: /^Chaos Dungeon – Bravo – / });
  await expect(below).toBeFocused();
  await page.keyboard.press("Space");
  await expect(done).toBeChecked();
  await expect(below).toBeFocused();
  await page.keyboard.press("Space");
  await expect(done).not.toBeChecked();
});

test("Ebony Cube runs and unlock tickets count up and down", async ({ page }) => {
  const cell = page.getByRole("group", { name: /^Ebony Cube .*– Alpha – / });
  await cell.getByRole("button", { name: "One more Ebony Cube for Alpha run" }).click();
  await expect(cell).toHaveAccessibleName(/– 1 run$/);

  const tickets = cell.getByRole("group", { name: "Ebony Cube for Alpha: tickets by unlock" });
  await tickets.getByRole("button", { name: "2nd unlock tickets: 0. Add one" }).click();
  await expect(tickets.getByRole("button", { name: "2nd unlock tickets: 1. Add one" })).toBeVisible();

  await page.reload();
  await expect(cell).toHaveAccessibleName(/– 1 run$/);
  await expect(tickets.getByRole("button", { name: "2nd unlock tickets: 1. Add one" })).toBeVisible();

  await tickets.getByRole("button", { name: "One fewer 2nd unlock ticket" }).click();
  await expect(tickets.getByRole("button", { name: "2nd unlock tickets: 0. Add one" })).toBeVisible();
  await cell.getByRole("button", { name: "One fewer Ebony Cube for Alpha run" }).click();
  await expect(cell).toHaveAccessibleName(/– 0 runs$/);
});

test("a raid can be cleared gate by gate", async ({ page }) => {
  const gate = (n: number) => page.getByRole("button", { name: `Serca gate ${n} cleared by Alpha` });
  const box = page.getByRole("checkbox", { name: /^Serca cleared by Alpha/ });
  await gate(1).click();
  await expect(gate(1)).toHaveAttribute("aria-pressed", "true");
  await expect(box).toHaveAccessibleName("Serca cleared by Alpha (1 of 2 gates)");
  await expect(box).not.toBeChecked();

  await page.reload();
  await expect(gate(1)).toHaveAttribute("aria-pressed", "true");
  await expect(gate(2)).toHaveAttribute("aria-pressed", "false");

  // The checkbox finishes the gates left; ticking it again clears the raid.
  await box.click();
  await expect(box).toBeChecked();
  await expect(gate(2)).toHaveAttribute("aria-pressed", "true");
  await box.click();
  await expect(box).not.toBeChecked();
  await expect(gate(1)).toHaveAttribute("aria-pressed", "false");
});
