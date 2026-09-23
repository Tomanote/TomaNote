// e2e/issue87-linkModal.spec.js
// Issue #87: Link insertion uses native browser prompt() instead of custom TomaNote modal
// Tests verify the current behavior (native prompt) and document the expected behavior.

import { test, expect } from "@playwright/test";
import {
  waitForAppReady,
  typeInEditor,
  selectAllInEditor,
  clickFormatButton,
  clearEditor,
} from "./helpers.js";

test.describe("Issue #87 — Link Modal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("link button opens custom TomaNote modal (FIXED)", async ({ page }) => {
    await typeInEditor(page, "click here");
    await selectAllInEditor(page);

    await clickFormatButton(page, "link");
    await page.waitForTimeout(500);

    // After fix: custom modal appears instead of native prompt
    const customModal = page.locator('[data-testid="link-modal"]');
    await expect(customModal).toBeVisible();
  });

  test("custom modal has URL input and confirm/cancel buttons", async ({ page }) => {
    await typeInEditor(page, "test link");
    await selectAllInEditor(page);

    await clickFormatButton(page, "link");
    await page.waitForTimeout(500);

    const customModal = page.locator('[data-testid="link-modal"]');
    await expect(customModal).toBeVisible();

    // Modal should have URL input
    const urlInput = customModal.locator("#link-modal-url");
    await expect(urlInput).toBeVisible();

    // Modal should have confirm and cancel buttons
    const confirmBtn = customModal.locator(".link-modal__btn--confirm");
    const cancelBtn = customModal.locator(".link-modal__btn--cancel");
    await expect(confirmBtn).toBeVisible();
    await expect(cancelBtn).toBeVisible();
  });

  test("link button applies the link mark correctly after modal", async ({ page }) => {
    await typeInEditor(page, "link text");
    await selectAllInEditor(page);

    await clickFormatButton(page, "link");
    await page.waitForTimeout(500);

    // Fill in URL and confirm
    const customModal = page.locator('[data-testid="link-modal"]');
    const urlInput = customModal.locator("#link-modal-url");
    await urlInput.fill("https://example.com");
    await customModal.locator(".link-modal__btn--confirm").click();
    await page.waitForTimeout(500);

    const editor = page.locator(".ProseMirror").last();
    const linkCount = await editor.locator("a").count();
    expect(linkCount).toBeGreaterThanOrEqual(1);
  });

  test("link insertion with no selection opens modal for URL and text", async ({ page }) => {
    await clearEditor(page);
    const editor = page.locator(".ProseMirror").last();
    await editor.click();

    await clickFormatButton(page, "link");
    await page.waitForTimeout(500);

    // Modal should appear with both URL and text fields
    const customModal = page.locator('[data-testid="link-modal"]');
    await expect(customModal).toBeVisible();

    const urlInput = customModal.locator("#link-modal-url");
    const textInput = customModal.locator("#link-modal-text");
    await expect(urlInput).toBeVisible();
    await expect(textInput).toBeVisible();
  });

  test("custom modal closes on Escape key", async ({ page }) => {
    await typeInEditor(page, "test");
    await selectAllInEditor(page);

    await clickFormatButton(page, "link");
    await page.waitForTimeout(500);

    const customModal = page.locator('[data-testid="link-modal"]');
    await expect(customModal).toBeVisible();

    // Press Escape to close
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // Modal should be gone
    const isVisible = await customModal.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });
});
