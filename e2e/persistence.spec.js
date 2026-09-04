// e2e/persistence.spec.js
// E2E tests for TomaNote data persistence
// Covers: auto-save, localStorage, reload persistence, multi-tab persistence

import { test, expect } from "@playwright/test";
import {
  waitForAppReady,
  typeInEditor,
  createNewTab,
  getEditorText,
  waitForAutoSave,
  getStoredTabs,
  getTabCount,
} from "./helpers.js";

/** Trigger explicit save to localStorage for Milkdown tabs */
async function triggerSave(page) {
  await page.evaluate(() => {
    if (window.tabManager) {
      window.tabManager.saveTabs();
    }
  });
  await page.waitForTimeout(200);
}

test.describe("Persistence — Auto-Save & localStorage", () => {
  test("content is saved to localStorage after typing", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await typeInEditor(page, "Persist me");
    await waitForAutoSave(page);
    await triggerSave(page);

    const stored = await getStoredTabs(page);
    expect(stored).not.toBeNull();
    expect(Array.isArray(stored)).toBe(true);
    expect(stored.length).toBeGreaterThanOrEqual(1);

    const hasContent = stored.some(
      (tab) => tab.content && tab.content.includes("Persist me")
    );
    expect(hasContent).toBe(true);
  });

  test("content survives page reload", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await typeInEditor(page, "Reload proof content");
    await waitForAutoSave(page);
    await triggerSave(page);

    await page.goto("about:blank");
    await page.goto("/");
    await waitForAppReady(page);

    const text = await getEditorText(page);
    expect(text).toContain("Reload proof content");
  });

  test("multiple lines survive reload", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await typeInEditor(page, "Line A");
    await page.keyboard.press("Enter");
    await typeInEditor(page, "Line B");
    await page.keyboard.press("Enter");
    await typeInEditor(page, "Line C");
    await waitForAutoSave(page);
    await triggerSave(page);

    await page.goto("about:blank");
    await page.goto("/");
    await waitForAppReady(page);

    const text = await getEditorText(page);
    expect(text).toContain("Line A");
    expect(text).toContain("Line B");
    expect(text).toContain("Line C");
  });
});

test.describe("Persistence — Multi-Document Tabs", () => {
  test("creating multiple tabs persists all of them", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await typeInEditor(page, "First document");
    await waitForAutoSave(page);
    await triggerSave(page);

    await createNewTab(page);
    await typeInEditor(page, "Second document");
    await waitForAutoSave(page);
    await triggerSave(page);

    await createNewTab(page);
    await typeInEditor(page, "Third document");
    await waitForAutoSave(page);
    await triggerSave(page);

    const stored = await getStoredTabs(page);
    expect(stored).not.toBeNull();
    expect(stored.length).toBe(3);
  });

  test("multi-tab content survives reload", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await typeInEditor(page, "Tab one content");
    await waitForAutoSave(page);
    await triggerSave(page);

    await createNewTab(page);
    await typeInEditor(page, "Tab two content");
    await waitForAutoSave(page);
    await triggerSave(page);

    await page.goto("about:blank");
    await page.goto("/");
    await waitForAppReady(page);

    const tabCount = await getTabCount(page);
    expect(tabCount).toBe(2);

    // First tab content
    const firstLabel = page.locator(".tab-list__item label").first();
    await firstLabel.click();
    await page.waitForTimeout(500);
    const text1 = await getEditorText(page);
    expect(text1).toContain("Tab one content");

    // Second tab content
    const secondLabel = page.locator(".tab-list__item label").nth(1);
    await secondLabel.click();
    await page.waitForTimeout(500);
    const text2 = await getEditorText(page);
    expect(text2).toContain("Tab two content");
  });

  test("tab count persists after reload", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await typeInEditor(page, "First");
    await waitForAutoSave(page);
    await triggerSave(page);

    await createNewTab(page);
    await typeInEditor(page, "Second");
    await waitForAutoSave(page);
    await triggerSave(page);

    await createNewTab(page);
    await typeInEditor(page, "Third");
    await waitForAutoSave(page);
    await triggerSave(page);

    await page.goto("about:blank");
    await page.goto("/");
    await waitForAppReady(page);

    const labels = page.locator(".tab-list__item label");
    const count = await labels.count();
    expect(count).toBe(3);
  });
});

test.describe("Persistence — Markdown Content Recovery", () => {
  test("bold formatting persists across reload", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await typeInEditor(page, "bold text");
    const editor = page.locator(".ProseMirror").last();
    await editor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Control+B");
    await waitForAutoSave(page);
    await triggerSave(page);

    await page.goto("about:blank");
    await page.goto("/");
    await waitForAppReady(page);

    const editorAfter = page.locator(".ProseMirror").last();
    const hasStrong = await editorAfter.locator("strong").count();
    expect(hasStrong).toBeGreaterThanOrEqual(1);
  });

  test("heading formatting persists across reload", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await typeInEditor(page, "My Heading");
    const editor = page.locator(".ProseMirror").last();
    await editor.click();
    await page.keyboard.press("Control+A");

    await page.click('button[data-floating-action="heading1"]');
    await waitForAutoSave(page);
    await triggerSave(page);

    await page.goto("about:blank");
    await page.goto("/");
    await waitForAppReady(page);

    const editorAfter = page.locator(".ProseMirror").last();
    const hasH1 = await editorAfter.locator("h1").count();
    expect(hasH1).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Persistence — Fresh Start (No Existing Data)", () => {
  test("app creates a tab when navigating to empty state", async ({ page }) => {
    // Navigate to app with empty state
    await page.goto("/");
    await waitForAppReady(page);

    // Tab should exist (either restored or created)
    const tabCount = await getTabCount(page);
    expect(tabCount).toBeGreaterThanOrEqual(1);

    // Editor should be present and editable
    const editor = page.locator(".ProseMirror").last();
    await expect(editor).toBeVisible();
  });
});
