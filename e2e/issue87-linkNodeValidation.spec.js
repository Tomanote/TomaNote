// e2e/issue87-linkNodeValidation.spec.js
// Validates that the link modal produces a real <a> node inside ProseMirror
// with correct href, text content, and visual styling (underline + color).

import { test, expect } from "@playwright/test";
import { waitForAppReady, typeInEditor, selectAllInEditor, clickFormatButton } from "./helpers.js";

test.describe("Link Modal — Node Validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("inserted link has correct href attribute", async ({ page }) => {
    await typeInEditor(page, "visit example");
    await selectAllInEditor(page);

    await clickFormatButton(page, "link");
    await page.waitForTimeout(500);

    const modal = page.locator('[data-testid="link-modal"]');
    await expect(modal).toBeVisible();

    await modal.locator("#link-modal-url").fill("https://example.com");
    await modal.locator(".link-modal__btn--confirm").click();
    await page.waitForTimeout(500);

    const link = page.locator(".ProseMirror a").first();
    await expect(link).toBeAttached();

    const href = await link.getAttribute("href");
    expect(href).toBe("https://example.com");
  });

  test("inserted link has underline decoration from design system", async ({ page }) => {
    await typeInEditor(page, "click here");
    await selectAllInEditor(page);

    await clickFormatButton(page, "link");
    await page.waitForTimeout(500);

    const modal = page.locator('[data-testid="link-modal"]');
    await modal.locator("#link-modal-url").fill("https://example.com");
    await modal.locator(".link-modal__btn--confirm").click();
    await page.waitForTimeout(500);

    const link = page.locator(".ProseMirror a").first();
    await expect(link).toBeAttached();

    const textDecoration = await link.evaluate((el) =>
      window.getComputedStyle(el).textDecorationLine
    );
    expect(textDecoration).toContain("underline");
  });

  test("inserted link has accent color distinct from body text", async ({ page }) => {
    await typeInEditor(page, "styled link");
    await selectAllInEditor(page);

    await clickFormatButton(page, "link");
    await page.waitForTimeout(500);

    const modal = page.locator('[data-testid="link-modal"]');
    await modal.locator("#link-modal-url").fill("https://example.com");
    await modal.locator(".link-modal__btn--confirm").click();
    await page.waitForTimeout(500);

    const link = page.locator(".ProseMirror a").first();
    await expect(link).toBeAttached();

    const linkColor = await link.evaluate((el) =>
      window.getComputedStyle(el).color
    );
    const bodyColor = await page.locator(".ProseMirror").last().evaluate((el) =>
      window.getComputedStyle(el).color
    );
    expect(linkColor).not.toBe(bodyColor);
  });

  test("link text content matches user selection", async ({ page }) => {
    await typeInEditor(page, "my link text");
    await selectAllInEditor(page);

    await clickFormatButton(page, "link");
    await page.waitForTimeout(500);

    const modal = page.locator('[data-testid="link-modal"]');
    await modal.locator("#link-modal-url").fill("https://tomanote.app");
    await modal.locator(".link-modal__btn--confirm").click();
    await page.waitForTimeout(500);

    const link = page.locator(".ProseMirror a").first();
    await expect(link).toBeAttached();

    const text = await link.textContent();
    expect(text).toBe("my link text");
  });
});
