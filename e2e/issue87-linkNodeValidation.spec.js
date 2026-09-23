// e2e/issue87-linkNodeValidation.spec.js
// Validates that the link modal produces a real <a> node inside ProseMirror
// with correct href, text content, and visual styling (underline + color).

import { test, expect } from "@playwright/test";
import { waitForAppReady, typeInEditor, selectAllInEditor, clearEditor, clickFormatButton } from "./helpers.js";

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

test.describe("Link Modal — Node Validation", () => {
  test.beforeEach(async ({ page }) => {
    await seedTab(page);
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

  // Bug: WITHOUT prior selection the modal shows 2 inputs (URL + display text),
  // but the result was inserted as flat plain text — no <a> node was created.
  test("link without prior selection creates a real <a> node with href and text", async ({ page }) => {
    // Start from a blank editor with the cursor in an empty paragraph (no selection)
    await clearEditor(page);
    await page.waitForTimeout(200);

    await clickFormatButton(page, "link");
    await page.waitForTimeout(500);

    const modal = page.locator('[data-testid="link-modal"]');
    await expect(modal).toBeVisible();

    // No selection => both URL and display-text inputs are shown
    await expect(modal.locator("#link-modal-url")).toBeVisible();
    await expect(modal.locator("#link-modal-text")).toBeVisible();

    await modal.locator("#link-modal-url").fill("https://example.org");
    await modal.locator("#link-modal-text").fill("Custom Display Text");
    await modal.locator(".link-modal__btn--confirm").click();
    await page.waitForTimeout(600);

    // A real anchor node must exist inside the ProseMirror document
    const link = page.locator(".ProseMirror a").first();
    await expect(link).toBeAttached();

    const href = await link.getAttribute("href");
    expect(href).toBe("https://example.org");

    const text = await link.textContent();
    expect(text).toBe("Custom Display Text");

    // The anchor must be visually distinguishable as a link (underline)
    const decoration = await link.evaluate((el) => window.getComputedStyle(el).textDecorationLine);
    expect(decoration).toContain("underline");
  });
});
