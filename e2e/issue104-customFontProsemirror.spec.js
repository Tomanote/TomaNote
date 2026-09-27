// e2e/issue104-customFontProsemirror.spec.js
// Issue #104: Custom font does not cascade into the Milkdown/ProseMirror workspace.
// Asserts the computed font-family of the active ProseMirror surface matches the
// user's selected typography, not just the tab wrapper elements.

import { test, expect } from "@playwright/test";
import { waitForAppReady } from "./helpers.js";

/** Open the settings modal on the Typography (fonts) tab */
async function openTypographySettings(page) {
  await page.evaluate(() => {
    const modal = document.querySelector("dialog#info-notepad");
    if (modal && !modal.open) modal.showModal();
  });
  await page.waitForSelector("#info-notepad[open]", { timeout: 5000 });
  await page.locator('button.nav-item[data-tab="fonts"]').click();
  await page.waitForTimeout(300);
}

test.describe("Issue #104 — Custom font cascades into ProseMirror workspace", () => {
  test("selected font family is computed on the active ProseMirror surface", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Pick a bundled font that is visually distinct from the default Inter
    await openTypographySettings(page);
    await page.locator("#font-select").selectOption({ label: "Poppins" });
    await page.waitForTimeout(500); // allow FontManager + stylesheet to apply

    // The tab wrapper picks the font up (known-good path)
    const wrapperFamily = await page.evaluate(() => {
      const el = document.querySelector(".tab-list__item--content");
      return getComputedStyle(el).fontFamily;
    });

    // The ProseMirror surface must ALSO resolve the same custom family
    const pmFamily = await page.evaluate(() => {
      const pm = document.querySelector(".tab-list__item--content .ProseMirror");
      if (!pm) throw new Error("No ProseMirror surface found in active tab");
      return getComputedStyle(pm).fontFamily;
    });

    expect(wrapperFamily.toLowerCase()).toContain("poppins");
    expect(pmFamily.toLowerCase()).toContain("poppins");
  });

  test("editor stylesheet consumes the custom font-family CSS variable", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Set the variable the way FontManager.applyFontToNotes does
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--font-family-notes", "'Roboto', sans-serif, serif");
    });
    await page.waitForTimeout(300);

    const pmFamily = await page.evaluate(() => {
      const pm = document.querySelector(".tab-list__item--content .ProseMirror");
      if (!pm) throw new Error("No ProseMirror surface found in active tab");
      return getComputedStyle(pm).fontFamily;
    });

    expect(pmFamily.toLowerCase()).toContain("roboto");
  });

  test("font size still cascades after the family fix (no regression)", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await openTypographySettings(page);
    // sr-only radio: the label is the real click target (fires change on the input)
    await page.locator('label[for="option-large-text"]').click();
    await page.waitForTimeout(400);

    const pmFontSize = await page.evaluate(() => {
      const pm = document.querySelector(".tab-list__item--content .ProseMirror");
      if (!pm) throw new Error("No ProseMirror surface found in active tab");
      return getComputedStyle(pm).fontSize;
    });
    // large-text => --tn-font-size-large = 1.6rem = 25.6px
    expect(parseFloat(pmFontSize)).toBeGreaterThan(16);
  });
});
