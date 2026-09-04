// e2e/ui.spec.js
// E2E tests for TomaNote UI components
// Covers: sidebar, floating menu, bottom bar, modals, context menu, shortcuts

import { test, expect } from "@playwright/test";
import { waitForAppReady, typeInEditor, clickFormatButton } from "./helpers.js";

test.describe("UI — Left Sidebar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("left sidebar is visible on desktop", async ({ page }) => {
    // Sidebar should be visible at desktop viewport
    const sidebar = page.locator(".sidebar-left");
    await expect(sidebar).toBeVisible();
  });

  test("left sidebar has search button that opens command palette", async ({ page }) => {
    const searchBtn = page.locator(".sidebar-left button[aria-label]").first();
    await searchBtn.click();
    await page.waitForTimeout(500);

    // Command palette should appear
    const palette = page.locator(".command-palette");
    await expect(palette).toBeVisible();
  });

  test("left sidebar has settings button that opens modal", async ({ page }) => {
    // Find the settings button (last button in sidebar-bottom)
    const settingsBtn = page.locator(".sidebar-left__bottom button").last();
    await settingsBtn.click();
    await page.waitForTimeout(500);

    // Settings modal (dialog) should appear
    const modal = page.locator("dialog#info-notepad");
    await expect(modal).toBeVisible();
  });

  test("left sidebar has help/shortcuts button", async ({ page }) => {
    const helpBtn = page.locator(".sidebar-left__bottom button").first();
    await helpBtn.click();
    await page.waitForTimeout(500);

    // Keyboard shortcuts help dialog should appear
    const shortcuts = page.locator("dialog#keyboardShortcutsHelp");
    await expect(shortcuts).toBeVisible();
  });
});

test.describe("UI — Floating Menu (Formatting Toolbar)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("floating menu is visible", async ({ page }) => {
    const menu = page.locator("#floating-nav");
    await expect(menu).toBeVisible();
  });

  test("formatting toolbar has all 12 format buttons", async ({ page }) => {
    const toolbar = page.locator(".tn-formatting-toolbar");
    const buttons = toolbar.locator("button[data-floating-action]");
    const count = await buttons.count();
    expect(count).toBe(12);
  });

  test("format buttons have correct actions", async ({ page }) => {
    const expectedActions = [
      "bold", "italic", "underline",
      "heading1", "heading2", "heading3",
      "blockquote", "codeInline", "codeBlock",
      "bulletList", "orderedList", "link",
    ];

    for (const action of expectedActions) {
      const btn = page.locator(`button[data-floating-action="${action}"]`);
      const count = await btn.count();
      // At least one button per action (may exist in both floating menu and bottom bar)
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test("create tab button is visible", async ({ page }) => {
    const createBtn = page.locator("#create-tab");
    await expect(createBtn).toBeVisible();
  });
});

test.describe("UI — Bottom Bar (Mobile)", () => {
  test("bottom bar exists in DOM", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const bottomBar = page.locator("#bottom-bar");
    await expect(bottomBar).toBeAttached();
  });

  test("bottom bar has content, font, and tab submenus", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const submenuTriggers = page.locator("[data-submenu-trigger]");
    const count = await submenuTriggers.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

test.describe("UI — Settings Modal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("settings modal opens from sidebar", async ({ page }) => {
    const settingsBtn = page.locator(".sidebar-left__bottom button").last();
    await settingsBtn.click();
    await page.waitForTimeout(500);

    const modal = page.locator("dialog#info-notepad");
    await expect(modal).toBeVisible();
  });

  test("settings modal closes on Escape", async ({ page }) => {
    const settingsBtn = page.locator(".sidebar-left__bottom button").last();
    await settingsBtn.click();
    await page.waitForTimeout(500);

    const modal = page.locator("dialog#info-notepad");
    await expect(modal).toBeVisible();

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // Modal should be hidden
    const isOpen = await modal.evaluate((el) => el.open);
    expect(isOpen).toBe(false);
  });
});

test.describe("UI — Command Palette", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("command palette opens from sidebar search button", async ({ page }) => {
    const searchBtn = page.locator(".sidebar-left button[aria-label]").first();
    await searchBtn.click();
    await page.waitForTimeout(500);

    const palette = page.locator(".command-palette");
    await expect(palette).toBeVisible();
  });

  test("command palette closes on Escape", async ({ page }) => {
    const searchBtn = page.locator(".sidebar-left button[aria-label]").first();
    await searchBtn.click();
    await page.waitForTimeout(500);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    const palette = page.locator(".command-palette");
    await expect(palette).not.toBeVisible();
  });
});

test.describe("UI — Keyboard Shortcuts Help", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("Alt+/ toggles keyboard shortcuts help", async ({ page }) => {
    await page.keyboard.press("Alt+/");
    await page.waitForTimeout(500);

    const help = page.locator("dialog#keyboardShortcutsHelp");
    await expect(help).toBeVisible();
  });

  test("keyboard shortcuts help closes on Escape", async ({ page }) => {
    await page.keyboard.press("Alt+/");
    await page.waitForTimeout(500);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    const help = page.locator("dialog#keyboardShortcutsHelp");
    const isOpen = await help.evaluate((el) => el.open);
    expect(isOpen).toBe(false);
  });
});

test.describe("UI — Context Menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("right-click on editor shows context menu", async ({ page }) => {
    const editor = page.locator(".ProseMirror").last();
    await editor.click({ button: "right" });
    await page.waitForTimeout(300);

    const contextMenu = page.locator("#context-menu");
    await expect(contextMenu).toBeVisible();
  });

  test("context menu closes on Escape", async ({ page }) => {
    const editor = page.locator(".ProseMirror").last();
    await editor.click({ button: "right" });
    await page.waitForTimeout(300);

    const contextMenu = page.locator("#context-menu");
    await expect(contextMenu).toBeVisible();

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // Context menu uses CSS class "hidden" to hide
    const hasHiddenClass = await contextMenu.evaluate((el) =>
      el.classList.contains("hidden")
    );
    expect(hasHiddenClass).toBe(true);
  });

  test("context menu closes on click outside", async ({ page }) => {
    const editor = page.locator(".ProseMirror").last();
    await editor.click({ button: "right" });
    await page.waitForTimeout(300);

    const contextMenu = page.locator("#context-menu");
    await expect(contextMenu).toBeVisible();

    // Click somewhere else
    await page.click("body", { position: { x: 10, y: 10 } });
    await page.waitForTimeout(300);

    const hasHiddenClass = await contextMenu.evaluate((el) =>
      el.classList.contains("hidden")
    );
    expect(hasHiddenClass).toBe(true);
  });
});

test.describe("UI — Tab Switching", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("clicking a tab label switches the active tab", async ({ page }) => {
    // Create a second tab
    await page.click("#create-tab");
    await page.waitForTimeout(500);

    // Get all tab labels
    const labels = page.locator(".tab-list__item label");
    const count = await labels.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Click first tab
    await labels.first().click();
    await page.waitForTimeout(300);

    // Its radio should be checked
    const firstRadio = labels.first().locator("..").locator("input[type='radio']");
    await expect(firstRadio).toBeChecked();
  });

  test("active tab content is visible, inactive tabs are hidden", async ({ page }) => {
    // Create second tab
    await page.click("#create-tab");
    await page.waitForTimeout(500);

    // Type in second tab
    const editor = page.locator(".ProseMirror").last();
    await editor.click();
    await page.keyboard.type("Second tab content");
    await page.waitForTimeout(300);

    // Switch to first tab
    const firstLabel = page.locator(".tab-list__item label").first();
    await firstLabel.click();
    await page.waitForTimeout(500);

    // The visible editor should NOT contain "Second tab content"
    const visibleEditor = page.locator(".ProseMirror").last();
    const text = await visibleEditor.textContent();
    expect(text).not.toContain("Second tab content");
  });
});

test.describe("UI — Responsive / Mobile", () => {
  test("default editor content is visible at desktop viewport", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Editor should be present and editable
    const editor = page.locator(".ProseMirror").last();
    await expect(editor).toBeVisible();
  });
});
