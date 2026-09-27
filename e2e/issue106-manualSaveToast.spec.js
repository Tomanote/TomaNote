// e2e/issue106-manualSaveToast.spec.js
// Issue #106: Ctrl+S / Cmd+S must execute the manual localStorage save backup
// AND show the exact same visual success toast used by the autosave routine.

import { test, expect } from "@playwright/test";
import { waitForAppReady, typeInEditor } from "./helpers.js";

test.describe("Issue #106 — Manual save shortcut shows visual confirmation", () => {
  test("Ctrl+S persists tabsData and shows the save indicator immediately", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await typeInEditor(page, "Manual save content");

    // Milkdown's auto-save syncs typed content into tabsData (memory) after its
    // ~300ms debounce; saveTabs() then serializes that state to localStorage.
    await page.waitForTimeout(700);

    await page.keyboard.press("Control+S");
    await page.waitForTimeout(200);

    // 1. Manual save executed: localStorage backup written with the typed content
    const storedAfter = await page.evaluate(() => localStorage.getItem("tabsData"));
    expect(storedAfter).toBeTruthy();
    expect(storedAfter).toContain("Manual save content");

    // 2. Visual confirmation: the SAME toast used by autosave is visible now
    const toastVisible = await page.evaluate(() => {
      const el = document.getElementById("save-indicator");
      return el ? el.classList.contains("is-visible") : false;
    });
    expect(toastVisible).toBe(true);
  });

  test("Cmd+S (macOS meta variant) also triggers save + toast", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await typeInEditor(page, "Meta save content");
    await page.waitForTimeout(700);

    await page.keyboard.press("Meta+S");
    await page.waitForTimeout(200);

    const stored = await page.evaluate(() => localStorage.getItem("tabsData"));
    expect(stored).toContain("Meta save content");

    const toastVisible = await page.evaluate(() => {
      const el = document.getElementById("save-indicator");
      return el ? el.classList.contains("is-visible") : false;
    });
    expect(toastVisible).toBe(true);
  });

  test("browser native save dialog is suppressed (preventDefault)", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Focus the page first: handleKeydown() bails on !document.hasFocus(),
    // which is false in headless until a real click happens.
    await page.locator(".ProseMirror").last().click();

    await page.evaluate(() => {
      // Same node + phase as the app's capture handler, registered after it,
      // so the app's preventDefault() has already run when we read the flag.
      document.addEventListener(
        "keydown",
        (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
            window.__ctrlSDefaultPrevented = e.defaultPrevented;
          }
        },
        { capture: true }
      );
    });
    await page.keyboard.press("Control+S");
    await page.waitForTimeout(200);

    const prevented = await page.evaluate(() => window.__ctrlSDefaultPrevented);
    expect(prevented).toBe(true);
  });
});
