import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const url = pathToFileURL(resolve("dist/index.html")).href;
const fake = resolve("tests/e2e/fake-claude.js");

test("without AI, the default KBA mapping fills in, reconciles and can be confirmed", async ({
  page,
}) => {
  await page.goto(url);
  await expect(page.getByText("Live AI isn't available here")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#mapper-run")).toBeDisabled();
  await page
    .locator("#mapper-input")
    .fill("Segment\tNeuzulassungen\nKleinwagen\t312.455\nSUVs\t1.024.310\nWohnmobile\t40.000");
  await expect(page.locator("#mapper-parsed")).toContainText("3 rows read · 3 with volumes");
  await page.locator("#mapper-default").click();
  await expect(page.getByTestId("reconciliation")).toContainText(
    "Volumes add up: 1,376,765 of 1,376,765 (40,000 out of scope).",
  );
  await page.locator("#mapper-confirm").click();
  await expect(page.getByTestId("mapper-confirmed")).toContainText(
    "Mapping confirmed: 3 rows, 0 from Claude",
  );
});

test("with AI, Claude's rows show with badges, the trace records the call, and a bad row blocks confirm", async ({
  page,
}) => {
  await page.addInitScript({ path: fake });
  await page.addInitScript(
    () => ((window as unknown as { __fakeMode: string }).__fakeMode = "bad_weights"),
  );
  await page.goto(url);
  await page.locator("#mapper-example").click();
  await expect(page.locator("#mapper-run")).toBeEnabled();
  await page.locator("#mapper-run").click();
  const table = page.getByTestId("mapping-table");
  await expect(table).toContainText("Oberklasse");
  await expect(table.getByText("AI", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Claude's weights don't sum to 1. Pick a class.")).toBeVisible();
  await expect(page.locator("#mapper-confirm")).toBeDisabled();
  // Fix the bad row by hand: it becomes "Edited" and confirm unlocks.
  await page.getByLabel("Class: Minis").selectOption("small");
  await expect(page.locator("#mapper-confirm")).toBeEnabled();
  await page.locator("#mapper-confirm").click();
  await expect(page.getByTestId("mapper-confirmed")).toContainText(
    "14 rows, 13 from Claude, 1 edited by you",
  );
  await page.locator("#trace-open").click();
  const trace = page.getByTestId("trace").first();
  await expect(trace).toContainText("A4");
  await expect(trace).toContainText("Weights sum to 1 · failed");
  await expect(trace).toContainText("Answer shape · passed");
});

test("a rate limit falls back to the defaults with a clear message", async ({ page }) => {
  await page.addInitScript({ path: fake });
  await page.addInitScript(
    () => ((window as unknown as { __fakeMode: string }).__fakeMode = "rate_limited"),
  );
  await page.goto(url);
  await page.locator("#mapper-example").click();
  await page.locator("#mapper-run").click();
  await expect(page.getByText("Too many AI calls right now.")).toBeVisible();
  await expect(page.getByTestId("mapping-table").getByText("Default").first()).toBeVisible();
});

test("the eval set runs four calls and reports a score", async ({ page }) => {
  await page.addInitScript({ path: fake });
  await page.goto(url);
  await page.locator("#eval-run").click();
  await expect(page.getByTestId("eval-result")).toContainText("rows right", { timeout: 15_000 });
  expect(
    await page.evaluate(() => (window as unknown as { __fakeCalls: number }).__fakeCalls),
  ).toBe(4);
});

for (const scheme of ["light", "dark"] as const) {
  test(`mapper review has no serious accessibility findings (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.addInitScript({ path: fake });
    await page.goto(url);
    await page.locator("#mapper-example").click();
    await page.locator("#mapper-run").click();
    await expect(page.getByTestId("mapping-table")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
}
