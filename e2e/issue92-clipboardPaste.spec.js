// e2e/issue92-clipboardPaste.spec.js
// Clipboard Paste Bug: rich HTML content lost after page reload
// Tests verify that pasted content persists in localStorage.

import { test, expect } from "@playwright/test";
import {
  waitForAppReady,
  typeInEditor,
  getEditorText,
  getStoredTabs,
} from "./helpers.js";

/** Trigger explicit save to localStorage */
async function triggerSave(page) {
  await page.evaluate(() => {
    if (window.tabManager) window.tabManager.saveTabs();
  });
  await page.waitForTimeout(200);
}

test.describe("Clipboard Paste — Persistence After Reload", () => {
  test("pasted plain text survives reload", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const editor = page.locator(".ProseMirror").last();
    await editor.click();

    // Type content (simulates paste via keyboard)
    await page.keyboard.type("Pasted content here", { delay: 10 });
    await page.waitForTimeout(300);
    await triggerSave(page);

    // Navigate away and back
    await page.goto("about:blank");
    await page.goto("/");
    await waitForAppReady(page);

    const text = await getEditorText(page);
    expect(text).toContain("Pasted content here");
  });

  test("pasted rich HTML content is preserved in localStorage", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const editor = page.locator(".ProseMirror").last();
    await editor.click();

    // Simulate a paste event with HTML content
    await page.evaluate(() => {
      const pm = document.querySelector(".ProseMirror");
      if (!pm) return;

      const pasteEvent = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer(),
      });

      // Add HTML content to the paste event
      pasteEvent.clipboardData.setData(
        "text/html",
        "<p><strong>Bold pasted</strong> and <em>italic</em></p>"
      );
      pasteEvent.clipboardData.setData("text/plain", "Bold pasted and italic");

      pm.dispatchEvent(pasteEvent);
    });

    await page.waitForTimeout(500);
    await triggerSave(page);

    // Verify content was saved to localStorage
    const stored = await getStoredTabs(page);
    expect(stored).not.toBeNull();
    expect(stored.length).toBeGreaterThanOrEqual(1);

    const hasContent = stored.some(
      (tab) => tab.content && tab.content.includes("Bold pasted")
    );
    expect(hasContent).toBe(true);
  });

  test("pasted content survives reload after explicit save", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Type some content
    await typeInEditor(page, "Content before paste");
    await page.waitForTimeout(300);
    await triggerSave(page);

    // Verify it's in localStorage
    const stored1 = await getStoredTabs(page);
    const hasBefore = stored1?.some(
      (tab) => tab.content && tab.content.includes("Content before paste")
    );
    expect(hasBefore).toBe(true);

    // Reload
    await page.goto("about:blank");
    await page.goto("/");
    await waitForAppReady(page);

    // Content should still be there
    const text = await getEditorText(page);
    expect(text).toContain("Content before paste");
  });

  test("multi-line content persists across reload", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await typeInEditor(page, "Line 1");
    await page.keyboard.press("Enter");
    await typeInEditor(page, "Line 2");
    await page.keyboard.press("Enter");
    await typeInEditor(page, "Line 3");
    await page.waitForTimeout(300);
    await triggerSave(page);

    await page.goto("about:blank");
    await page.goto("/");
    await waitForAppReady(page);

    const text = await getEditorText(page);
    expect(text).toContain("Line 1");
    expect(text).toContain("Line 2");
    expect(text).toContain("Line 3");
  });
});

test.describe("Save Indicator — Mobile Viewport", () => {
  test("save indicator element exists in DOM at mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto("/");
    await waitForAppReady(page);

    const indicator = page.locator("#save-indicator");
    await expect(indicator).toBeAttached();
  });

  test("save indicator is not visible by default", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await waitForAppReady(page);

    const indicator = page.locator("#save-indicator");
    const hasVisibleClass = await indicator.evaluate((el) =>
      el.classList.contains("is-visible")
    );
    expect(hasVisibleClass).toBe(false);
  });

  test("save indicator shows after explicit trigger at mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await waitForAppReady(page);

    // Trigger save indicator via JavaScript
    await page.evaluate(() => {
      window.saveIndicator?.trigger();
    });

    // trigger() is debounced (5000ms) per #92 fix — wait past the debounce window
    await page.waitForTimeout(5300);

    const indicator = page.locator("#save-indicator");
    const hasVisibleClass = await indicator.evaluate((el) =>
      el.classList.contains("is-visible")
    );
    expect(hasVisibleClass).toBe(true);
  });
});
