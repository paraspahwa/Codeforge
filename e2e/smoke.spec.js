import { test, expect } from "@playwright/test";

test("landing loads with marketing shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".marketing-shell, .marketing-main").first()).toBeVisible();
});

test("login page loads", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator(".minimal-shell")).toBeVisible();
  await expect(page.getByText("CodeForge")).toBeVisible();
});

test("app shell redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
});

test("code route redirects unauthenticated users", async ({ page }) => {
  await page.goto("/code");
  await expect(page).toHaveURL(/\/login/);
});
