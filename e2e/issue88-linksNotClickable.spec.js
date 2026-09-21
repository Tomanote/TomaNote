// e2e/issue88-linksNotClickable.spec.js
// Issue #88: Inserted links are not clickable
// Tests verify that links in the editor do not open in new tabs
// (the bug) and document expected behavior.

import { test, expect } from "@playwright/test";
import {
  waitForAppReady,
  typeInEditor,
  selectAllInEditor,
  clickFormatButton,
} from "./helpers.js";

test.describe("Issue #88 — Links Not Clickable", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("inserted link renders as <a> element", async ({ page }) => {
    await typeInEditor(page, "click me");
    await selectAllInEditor(page);

    // Custom link modal flow (replaced native prompt in #87)
    await clickFormatButton(page, "link");
    await page.waitForTimeout(500);

    const modal = page.locator('[data-testid="link-modal"]');
    await expect(modal).toBeVisible();
    await modal.locator("#link-modal-url").fill("https://example.com");
    await modal.locator(".link-modal__btn--confirm").click();
    await page.waitForTimeout(500);

    const editor = page.locator(".ProseMirror").last();
    const links = editor.locator("a");
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("link has correct href attribute", async ({ page }) => {
    await typeInEditor(page, "link text");
    await selectAllInEditor(page);

    await clickFormatButton(page, "link");
    await page.waitForTimeout(500);

    // Fill URL in modal
    const customModal = page.locator('[data-testid="link-modal"]');
    const urlInput = customModal.locator("#link-modal-url");
    await urlInput.fill("https://example.com");
    await customModal.locator(".link-modal__btn--confirm").click();
    await page.waitForTimeout(500);

    const editor = page.locator(".ProseMirror").last();
    const link = editor.locator("a").first();
    const href = await link.getAttribute("href");
    expect(href).toBe("https://example.com");
  });

  test("regular click on link does NOT navigate (contenteditable)", async ({ page }) => {
    await typeInEditor(page, "link text");
    await selectAllInEditor(page);

    await clickFormatButton(page, "link");
    await page.waitForTimeout(500);

    // Fill URL in modal
    const customModal = page.locator('[data-testid="link-modal"]');
    const urlInput = customModal.locator("#link-modal-url");
    await urlInput.fill("https://example.com");
    await customModal.locator(".link-modal__btn--confirm").click();
    await page.waitForTimeout(500);

    const initialUrl = page.url();

    const editor = page.locator(".ProseMirror").last();
    const link = editor.locator("a").first();

    // Regular click — should NOT navigate (contenteditable)
    await link.click({ force: true });
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    expect(currentUrl).toBe(initialUrl);
  });

  test("Ctrl+click on link opens in new tab (FIXED)", async ({ page }) => {
    await typeInEditor(page, "external link");
    await selectAllInEditor(page);

    await clickFormatButton(page, "link");
    await page.waitForTimeout(500);

    // Fill URL in modal
    const customModal = page.locator('[data-testid="link-modal"]');
    const urlInput = customModal.locator("#link-modal-url");
    await urlInput.fill("https://example.com");
    await customModal.locator(".link-modal__btn--confirm").click();
    await page.waitForTimeout(500);

    // Listen for new pages (popup/new tab)
    let newPageOpened = false;
    page.context().on("page", () => {
      newPageOpened = true;
    });

    const editor = page.locator(".ProseMirror").last();
    const link = editor.locator("a").first();

    // Ctrl+click should open in new tab
    await link.click({ modifiers: ["Control"] });
    await page.waitForTimeout(1000);

    // After fix: new tab should open
    expect(newPageOpened).toBe(true);
  });

  test("link tooltip appears on hover (this works correctly)", async ({ page }) => {
    await typeInEditor(page, "hover link");
    await selectAllInEditor(page);

    await clickFormatButton(page, "link");
    await page.waitForTimeout(500);

    // Fill URL in modal
    const customModal = page.locator('[data-testid="link-modal"]');
    const urlInput = customModal.locator("#link-modal-url");
    await urlInput.fill("https://example.com");
    await customModal.locator(".link-modal__btn--confirm").click();
    await page.waitForTimeout(500);

    const editor = page.locator(".ProseMirror").last();
    const link = editor.locator("a").first();

    // Hover over the link
    await link.hover();
    await page.waitForTimeout(500);

    // The link should have cursor:pointer (from CSS)
    const cursor = await link.evaluate((el) =>
      window.getComputedStyle(el).cursor
    );
    expect(cursor).toBe("pointer");
  });

  test("link CSS has cursor:pointer (styling works)", async ({ page }) => {
    await typeInEditor(page, "styled link");
    await selectAllInEditor(page);

    await clickFormatButton(page, "link");
    await page.waitForTimeout(500);

    // Fill URL in modal
    const customModal = page.locator('[data-testid="link-modal"]');
    const urlInput = customModal.locator("#link-modal-url");
    await urlInput.fill("https://example.com");
    await customModal.locator(".link-modal__btn--confirm").click();
    await page.waitForTimeout(500);

    const editor = page.locator(".ProseMirror").last();
    const link = editor.locator("a").first();

    const cursor = await link.evaluate((el) =>
      window.getComputedStyle(el).cursor
    );
    expect(cursor).toBe("pointer");
  });
});
