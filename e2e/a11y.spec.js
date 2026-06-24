import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("landing has no serious a11y violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .disableRules(["color-contrast"])
    .analyze();
  expect(results.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toEqual([]);
});

test("login page has no serious a11y violations", async ({ page }) => {
  await page.goto("/login");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .disableRules(["color-contrast"])
    .analyze();
  expect(results.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toEqual([]);
});
