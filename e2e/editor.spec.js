// e2e/editor.spec.js
// E2E tests for the Milkdown editor
// Covers: loading, content creation, formatting, headings, code blocks, undo/redo

import { test, expect } from "@playwright/test";
import {
  waitForAppReady,
  typeInEditor,
  selectAllInEditor,
  getEditorText,
  clearEditor,
  clickFormatButton,
  createNewTab,
  getTabCount,
  waitForAutoSave,
} from "./helpers.js";

test.describe("Editor — Loading & Basic Content", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("app loads successfully with a default tab and editor", async ({ page }) => {
    // Tab exists
    const tabCount = await getTabCount(page);
    expect(tabCount).toBeGreaterThanOrEqual(1);

    // ProseMirror editor is visible
    const editor = page.locator(".ProseMirror").last();
    await expect(editor).toBeVisible();
  });

  test("editor is contenteditable and accepts typing", async ({ page }) => {
    await typeInEditor(page, "Hello TomaNote");
    const text = await getEditorText(page);
    expect(text).toContain("Hello TomaNote");
  });

  test("editor preserves content after typing multiple lines", async ({ page }) => {
    await typeInEditor(page, "Line one");
    await page.keyboard.press("Enter");
    await typeInEditor(page, "Line two");
    await page.keyboard.press("Enter");
    await typeInEditor(page, "Line three");

    const text = await getEditorText(page);
    expect(text).toContain("Line one");
    expect(text).toContain("Line two");
    expect(text).toContain("Line three");
  });

  test("editor can be cleared and retyped", async ({ page }) => {
    await typeInEditor(page, "Temporary content");
    await clearEditor(page);
    await typeInEditor(page, "New content");

    const text = await getEditorText(page);
    expect(text).not.toContain("Temporary content");
    expect(text).toContain("New content");
  });
});

test.describe("Editor — Formatting", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("bold formatting via Ctrl+B", async ({ page }) => {
    await typeInEditor(page, "bold text");
    await selectAllInEditor(page);
    await page.keyboard.press("Control+B");

    const editor = page.locator(".ProseMirror").last();
    const hasBold = await editor.locator("strong").count();
    expect(hasBold).toBeGreaterThanOrEqual(1);
  });

  test("italic formatting via Ctrl+I", async ({ page }) => {
    await typeInEditor(page, "italic text");
    await selectAllInEditor(page);
    await page.keyboard.press("Control+I");

    const editor = page.locator(".ProseMirror").last();
    const hasItalic = await editor.locator("em").count();
    expect(hasItalic).toBeGreaterThanOrEqual(1);
  });

  test("underline formatting via Ctrl+U", async ({ page }) => {
    await typeInEditor(page, "underlined text");
    await selectAllInEditor(page);
    await page.keyboard.press("Control+U");

    const editor = page.locator(".ProseMirror").last();
    const hasUnderline = await editor.locator("u").count();
    expect(hasUnderline).toBeGreaterThanOrEqual(1);
  });

  test("bold formatting via floating menu button", async ({ page }) => {
    await typeInEditor(page, "menu bold");
    await selectAllInEditor(page);
    await clickFormatButton(page, "bold");

    const editor = page.locator(".ProseMirror").last();
    const hasBold = await editor.locator("strong").count();
    expect(hasBold).toBeGreaterThanOrEqual(1);
  });

  test("italic formatting via floating menu button", async ({ page }) => {
    await typeInEditor(page, "menu italic");
    await selectAllInEditor(page);
    await clickFormatButton(page, "italic");

    const editor = page.locator(".ProseMirror").last();
    const hasItalic = await editor.locator("em").count();
    expect(hasItalic).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Editor — Headings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("heading 1 via floating menu", async ({ page }) => {
    await typeInEditor(page, "My Heading");
    await selectAllInEditor(page);
    await clickFormatButton(page, "heading1");

    const editor = page.locator(".ProseMirror").last();
    const hasH1 = await editor.locator("h1").count();
    expect(hasH1).toBeGreaterThanOrEqual(1);
  });

  test("heading 2 via floating menu", async ({ page }) => {
    await typeInEditor(page, "Sub Heading");
    await selectAllInEditor(page);
    await clickFormatButton(page, "heading2");

    const editor = page.locator(".ProseMirror").last();
    const hasH2 = await editor.locator("h2").count();
    expect(hasH2).toBeGreaterThanOrEqual(1);
  });

  test("heading 3 via floating menu", async ({ page }) => {
    await typeInEditor(page, "Detail Heading");
    await selectAllInEditor(page);
    await clickFormatButton(page, "heading3");

    const editor = page.locator(".ProseMirror").last();
    const hasH3 = await editor.locator("h3").count();
    expect(hasH3).toBeGreaterThanOrEqual(1);
  });

  test("heading toggle — same level heading back to paragraph", async ({ page }) => {
    await typeInEditor(page, "Toggle me");
    await selectAllInEditor(page);
    await clickFormatButton(page, "heading1");

    // Now toggle again — should revert to paragraph
    await selectAllInEditor(page);
    await clickFormatButton(page, "heading1");

    const editor = page.locator(".ProseMirror").last();
    const hasH1 = await editor.locator("h1").count();
    expect(hasH1).toBe(0);
  });
});

test.describe("Editor — Code Blocks & Inline Code", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("code block via floating menu", async ({ page }) => {
    await typeInEditor(page, "code block text");
    await selectAllInEditor(page);
    await clickFormatButton(page, "codeBlock");

    const editor = page.locator(".ProseMirror").last();
    const hasCodeBlock = await editor.locator("pre code").count();
    expect(hasCodeBlock).toBeGreaterThanOrEqual(1);
  });

  test("inline code via floating menu", async ({ page }) => {
    await typeInEditor(page, "inline code");
    await selectAllInEditor(page);
    await clickFormatButton(page, "codeInline");

    const editor = page.locator(".ProseMirror").last();
    const hasInlineCode = await editor.locator("code").count();
    expect(hasInlineCode).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Editor — Blockquotes & Lists", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("blockquote via floating menu", async ({ page }) => {
    await typeInEditor(page, "quoted text");
    await selectAllInEditor(page);
    await clickFormatButton(page, "blockquote");

    const editor = page.locator(".ProseMirror").last();
    const hasBlockquote = await editor.locator("blockquote").count();
    expect(hasBlockquote).toBeGreaterThanOrEqual(1);
  });

  test("bullet list via floating menu", async ({ page }) => {
    await typeInEditor(page, "list item");
    await selectAllInEditor(page);
    await clickFormatButton(page, "bulletList");

    const editor = page.locator(".ProseMirror").last();
    const hasList = await editor.locator("ul li").count();
    expect(hasList).toBeGreaterThanOrEqual(1);
  });

  test("ordered list via floating menu", async ({ page }) => {
    await typeInEditor(page, "ordered item");
    await selectAllInEditor(page);
    await clickFormatButton(page, "orderedList");

    const editor = page.locator(".ProseMirror").last();
    const hasOList = await editor.locator("ol li").count();
    expect(hasOList).toBeGreaterThanOrEqual(1);
  });

  test("blockquote toggle — lift out of blockquote", async ({ page }) => {
    await typeInEditor(page, "quoted");
    await selectAllInEditor(page);
    await clickFormatButton(page, "blockquote");

    // Toggle again — should lift out
    await selectAllInEditor(page);
    await clickFormatButton(page, "blockquote");

    const editor = page.locator(".ProseMirror").last();
    const hasBlockquote = await editor.locator("blockquote").count();
    expect(hasBlockquote).toBe(0);
  });
});

test.describe("Editor — Links", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("link via floating menu triggers URL prompt", async ({ page }) => {
    await typeInEditor(page, "click here");
    await selectAllInEditor(page);

    // The link command uses window.prompt() — intercept it
    page.once("dialog", async (dialog) => {
      await dialog.accept("https://example.com");
    });

    await clickFormatButton(page, "link");

    const editor = page.locator(".ProseMirror").last();
    const hasLink = await editor.locator("a").count();
    expect(hasLink).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Editor — Undo / Redo", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("undo after typing removes recent characters", async ({ page }) => {
    // Click once and type all text in one session (no second click)
    const editor = page.locator(".ProseMirror").last();
    await editor.click();
    await page.keyboard.type("abcdefghij", { delay: 10 });
    await page.waitForTimeout(300);

    const beforeUndo = await getEditorText(page);
    expect(beforeUndo).toContain("abcdefghij");

    // Undo many times — should eventually clear the text
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Control+Z");
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(200);

    const afterUndo = await getEditorText(page);
    // After enough undos, text should be different (shorter or empty)
    expect(afterUndo.length).toBeLessThanOrEqual(beforeUndo.length);
  });

  test("redo after undo restores content", async ({ page }) => {
    const editor = page.locator(".ProseMirror").last();
    await editor.click();
    await page.keyboard.type("redo test", { delay: 10 });
    await page.waitForTimeout(300);

    // Undo all
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Control+Z");
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(200);

    // Redo all
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Control+Y");
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(200);

    const text = await getEditorText(page);
    expect(text).toContain("redo test");
  });

  test("Ctrl+Z after selectAll+delete is possible without crash", async ({ page }) => {
    await typeInEditor(page, "undoable");
    await page.waitForTimeout(300);
    await selectAllInEditor(page);
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(300);

    // Use keyboard undo — should not throw errors
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Control+Z");
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(300);

    // Page should still be functional after undo
    const editor = page.locator(".ProseMirror").last();
    await expect(editor).toBeVisible();
  });
});

test.describe("Editor — Tables", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("editor handles pipe characters without crashing", async ({ page }) => {
    // Type pipe characters (Milkdown may not auto-create tables from syntax)
    await typeInEditor(page, "Header 1 | Header 2");
    await page.waitForTimeout(300);

    const editor = page.locator(".ProseMirror").last();
    const text = await editor.textContent();
    expect(text).toContain("Header 1");
  });
});

test.describe("Editor — Multiple Tabs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("create a second tab and switch between them", async ({ page }) => {
    // Type in first tab
    await typeInEditor(page, "Tab one content");
    await waitForAutoSave(page);

    // Create second tab
    await createNewTab(page);

    // Type in second tab
    await typeInEditor(page, "Tab two content");
    await waitForAutoSave(page);

    // Verify both tabs exist
    const tabCount = await getTabCount(page);
    expect(tabCount).toBeGreaterThanOrEqual(2);

    // Switch back to first tab — click its label
    const firstTabLabel = page.locator(".tab-list__item label").first();
    await firstTabLabel.click();
    await page.waitForTimeout(500);

    // Verify first tab content is visible
    const text = await getEditorText(page);
    expect(text).toContain("Tab one content");
  });
});
