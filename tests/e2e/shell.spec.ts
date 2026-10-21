import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// The exact built file, opened offline as the laptop copy would be: no window.claude.
const url = pathToFileURL(resolve("dist/index.html")).href;
// The same file served over http, where the inline web worker is allowed.
const served = "http://localhost:4173/index.html";

test("shell loads offline with no errors and no sideways scroll", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(url);
  await expect(page).toHaveTitle("Tipping Point");
  await expect(page.getByRole("heading", { level: 1, name: "Segment mapper" })).toBeVisible();
  await page.locator("#nav-checks").click();
  // Outside a Claude viewer, live AI must report itself absent, not hang.
  await expect(page.getByText("Not here").first()).toBeVisible();
  await expect(page.locator("#tools-test")).toBeDisabled();
  // Chromium refuses blob: workers on file://, so the offline copy falls back to the main thread
  // and still answers with the same seeded estimate.
  await expect(page.getByTestId("spike-result")).toContainText(
    "Estimate 0.8411 against exact 0.8413",
    { timeout: 15_000 },
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("served over http, the inline worker runs the model off the main thread", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(served);
  await page.locator("#nav-checks").click();
  await expect(page.getByTestId("spike-result")).toContainText(
    "Estimate 0.8411 against exact 0.8413",
    { timeout: 15_000 },
  );
  await expect(page.getByTestId("spike-result")).toContainText("on the worker");
  expect(errors).toEqual([]);
});

test("language toggle switches to German and back", async ({ page }) => {
  await page.goto(url);
  await page.locator("#nav-checks").click();
  await page.locator("#lang-toggle").click();
  await expect(page.getByText("Was diese Ansicht kann")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await page.locator("#lang-toggle").click();
  await expect(page.getByText("What this view can do")).toBeVisible();
});

for (const scheme of ["light", "dark"] as const) {
  test(`no serious accessibility findings (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(url);
    await page.locator("#nav-checks").click();
    await page
      .getByTestId("spike-result")
      .getByText(/against exact/)
      .waitFor({ timeout: 15_000 });
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
}
