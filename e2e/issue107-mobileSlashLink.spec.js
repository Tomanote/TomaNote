// e2e/issue107-mobileSlashLink.spec.js
// Issue #107: Mobile layout has no RightSidebar — typing " / " (slash + space)
// in the editor must open the custom Link Insertion Modal.

import { test, expect } from "@playwright/test";
import { waitForAppReady } from "./helpers.js";

test.describe("Issue #107 — Mobile slash command opens Link Insertion Modal", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  /**
   * Mobile layout has no visible "New tab" button (part of the issue context),
   * so the editor is set up through the app's own TabManager API — tab creation
   * is not the behavior under test.
   */
  async function openMobileEditor(page) {
    await page.goto("/");
    await page.waitForFunction(
      () => typeof window.tabManager !== "undefined" && typeof window.milkdownEditor !== "undefined",
      null,
      { timeout: 30_000 }
    );
    await page.evaluate(() => window.tabManager.createTab());
    await page.waitForSelector(".ProseMirror", { timeout: 15_000 });
    // Settle the double-rAF editor mounts before interacting
    await page.waitForTimeout(1500);
  }

  /** Focus the ACTIVE tab's own ProseMirror surface (avoid stale mount ghosts) */
  async function focusActiveEditor(page) {
    await page.evaluate(() => {
      const pm = document
        .querySelector('.tab-list input[type="radio"]:checked')
        ?.closest(".tab-list__item")
        ?.querySelector(".ProseMirror");
      pm?.focus();
    });
    await page.waitForFunction(
      () => document.activeElement?.classList?.contains("ProseMirror"),
      null,
      { timeout: 5000 }
    );
  }

  test("typing slash+space opens the link insertion modal", async ({ page }) => {
    await openMobileEditor(page);
    await focusActiveEditor(page);

    await page.keyboard.type("/", { delay: 50 });
    await page.keyboard.press("Space");
    await page.waitForTimeout(500);

    const modal = page.locator('[data-testid="link-modal"]');
    await expect(modal).toBeVisible({ timeout: 3000 });
  });

  test("the ' / ' trigger characters are removed from the document", async ({ page }) => {
    await openMobileEditor(page);
    await focusActiveEditor(page);

    await page.keyboard.type("/", { delay: 50 });
    await page.keyboard.press("Space");
    await page.waitForTimeout(500);

    const text = await page.evaluate(
      () =>
        document
          .querySelector('.tab-list input[type="radio"]:checked')
          ?.closest(".tab-list__item")
          ?.querySelector(".ProseMirror")?.textContent || ""
    );
    expect(text).not.toContain("/");
  });

  test("double trigger is guarded: modal opens only once", async ({ page }) => {
    await openMobileEditor(page);
    await focusActiveEditor(page);

    await page.keyboard.type("/", { delay: 50 });
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
    // Second trigger attempt while the modal is open
    await page.keyboard.type("/", { delay: 50 });
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);

    const modalCount = await page.locator('[data-testid="link-modal"]').count();
    expect(modalCount).toBe(1);
  });
});

test.describe("Issue #107 — Desktop must stay unaffected", () => {
  test.use({ viewport: { width: 1280, height: 720 }, hasTouch: false, isMobile: false });

  test("desktop: slash+space does not open the modal", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const editor = page.locator(".ProseMirror").last();
    await editor.click();
    await page.keyboard.type("/", { delay: 50 });
    await page.keyboard.press("Space");
    await page.waitForTimeout(500);

    const modalCount = await page.locator('[data-testid="link-modal"]').count();
    expect(modalCount).toBe(0);
  });
});
