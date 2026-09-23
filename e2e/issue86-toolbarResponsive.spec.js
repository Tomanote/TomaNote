// e2e/issue86-toolbarResponsive.spec.js
// Issue #86: Formatting toolbar clips buttons on small viewports
// Tests verify toolbar responsiveness at various viewport sizes.

import { test, expect } from "@playwright/test";
import { waitForAppReady, typeInEditor } from "./helpers.js";

/** Seed a deterministic tab so the app never boots into the empty state */
async function seedTab(page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "tabsData",
      JSON.stringify([
        { id: "body-tab-1", name: "E2E Tab", content: "", format: "markdown", isPinned: false, emoji: null, updatedAt: Date.now() },
      ])
    );
  });
}

test.describe("Issue #86 — Toolbar Responsive Layout", () => {
  test("toolbar buttons are visible at 1280x720 (desktop)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await seedTab(page);
    await page.goto("/");
    await waitForAppReady(page);

    const toolbar = page.locator(".tn-formatting-toolbar");
    const buttons = toolbar.locator("button[data-floating-action]");
    const count = await buttons.count();

    // All buttons should be visible
    for (let i = 0; i < count; i++) {
      await expect(buttons.nth(i)).toBeVisible();
    }
  });

  test("toolbar buttons are visible at 1280x400 (reduced height)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 400 });
    await seedTab(page);
    await page.goto("/");
    await waitForAppReady(page);

    const toolbar = page.locator(".tn-formatting-toolbar");
    const buttons = toolbar.locator("button[data-floating-action]");
    const count = await buttons.count();

    // ISSUE #86: Some buttons get clipped at reduced height
    // Count how many are actually visible vs total
    let visibleCount = 0;
    for (let i = 0; i < count; i++) {
      const isVisible = await buttons.nth(i).isVisible().catch(() => false);
      if (isVisible) visibleCount++;
    }

    // At reduced height, all formatting buttons should still be accessible
    // This test will FAIL if buttons are clipped
    expect(visibleCount).toBe(count);
  });

  test("toolbar buttons are accessible at 1280x300 (very small height)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 300 });
    await seedTab(page);
    await page.goto("/");
    await waitForAppReady(page);

    const toolbar = page.locator(".tn-formatting-toolbar");
    const buttons = toolbar.locator("button[data-floating-action]");
    const count = await buttons.count();

    let visibleCount = 0;
    for (let i = 0; i < count; i++) {
      const isVisible = await buttons.nth(i).isVisible().catch(() => false);
      if (isVisible) visibleCount++;
    }

    // Even at very small height, buttons should be accessible
    // either via scroll or reflow
    expect(visibleCount).toBe(count);
  });

  test("toolbar does not overflow outside viewport at small sizes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 350 });
    await seedTab(page);
    await page.goto("/");
    await waitForAppReady(page);

    const toolbar = page.locator(".tn-formatting-toolbar");
    const box = await toolbar.boundingBox();
    const viewport = page.viewportSize();

    if (box && viewport) {
      // Toolbar should not extend beyond viewport width
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 10); // 10px tolerance
    }
  });

  test("toolbar is usable at 1024x600 (small laptop)", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 600 });
    await seedTab(page);
    await page.goto("/");
    await waitForAppReady(page);

    const toolbar = page.locator(".tn-formatting-toolbar");
    const buttons = toolbar.locator("button[data-floating-action]");
    const count = await buttons.count();

    // All buttons should be present in DOM
    expect(count).toBe(12);

    // All should be clickable
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      await expect(btn).toBeAttached();
    }
  });
});
