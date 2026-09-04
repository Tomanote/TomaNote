// e2e/helpers.js
// Shared helpers for TomaNote E2E tests

import { expect } from "@playwright/test";

/** Wait for the app to fully initialize (tabs + editor ready) */
export async function waitForAppReady(page) {
  // Wait for the main app structure
  await page.waitForSelector("main", { timeout: 10_000 });

  // Wait for the tab list container
  await page.waitForSelector(".tab-list", { timeout: 10_000 });

  // Check if any tab already exists
  let tabCount = await page.locator(".tab-list__item").count();

  if (tabCount === 0) {
    // No tabs — click "New tab" button to create one
    const newTabBtn = page.locator("#create-tab");
    if (await newTabBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newTabBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // Wait for the ProseMirror editor to be ready inside the active/visible tab
  // After restoreTabs(), the radio may not be checked — click the first tab to activate it
  try {
    await page.waitForSelector(".ProseMirror", { timeout: 10_000 });
  } catch {
    // No ProseMirror yet — tabs may be restored but radio not checked
    // Click the first tab label to activate it
    const firstLabel = page.locator(".tab-list__item label").first();
    if (await firstLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstLabel.click();
      await page.waitForSelector(".ProseMirror", { timeout: 15_000 });
    }
  }

  // Small delay for async initialization to settle
  await page.waitForTimeout(500);
}

/** Get the active/visible tab's ProseMirror editor */
export async function getActiveEditor(page) {
  return page.locator(".tab-list__item--content .ProseMirror").last();
}

/** Create a new tab by clicking the create-tab button */
export async function createNewTab(page) {
  const countBefore = await page.locator(".tab-list__item").count();
  await page.click("#create-tab");
  // Wait for new tab to appear
  await page.waitForTimeout(500);
  const countAfter = await page.locator(".tab-list__item").count();
  expect(countAfter).toBe(countBefore + 1);
}

/** Type text into the ProseMirror editor (the last/active one) */
export async function typeInEditor(page, text) {
  const editor = page.locator(".ProseMirror").last();
  await editor.click();
  await page.keyboard.type(text, { delay: 10 });
}

/** Select all text in the editor */
export async function selectAllInEditor(page) {
  const editor = page.locator(".ProseMirror").last();
  await editor.click();
  await page.keyboard.press("Control+A");
}

/** Get text content from the active editor */
export async function getEditorText(page) {
  const editor = page.locator(".ProseMirror").last();
  return editor.textContent();
}

/** Clear the editor content */
export async function clearEditor(page) {
  await selectAllInEditor(page);
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(100);
}

/** Click a floating menu button by its data-floating-action attribute */
export async function clickFormatButton(page, action) {
  await page.click(`button[data-floating-action="${action}"]`);
  await page.waitForTimeout(200);
}

/** Get the current localStorage value for tabs */
export async function getStoredTabs(page) {
  return page.evaluate(() => {
    const data = localStorage.getItem("tabsData");
    return data ? JSON.parse(data) : null;
  });
}

/** Set localStorage value for tabs */
export async function setStoredTabs(page, tabsData) {
  await page.evaluate((data) => {
    localStorage.setItem("tabsData", JSON.stringify(data));
  }, tabsData);
}

/** Clear all localStorage */
export async function clearLocalStorage(page) {
  await page.evaluate(() => localStorage.clear());
}

/** Wait for auto-save to complete (debounced 300ms + buffer) */
export async function waitForAutoSave(page) {
  await page.waitForTimeout(600);
}

/** Get the number of tabs */
export async function getTabCount(page) {
  return page.locator(".tab-list__item").count();
}

/** Click on a tab by its label text */
export async function clickTabByLabel(page, labelText) {
  const label = page.locator(".tab-list__item label", { hasText: labelText });
  await label.click();
  await page.waitForTimeout(300);
}
