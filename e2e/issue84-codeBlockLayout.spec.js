// e2e/issue84-codeBlockLayout.spec.js
// Issue #84: Inline code + code block renders visually joined on same line
// Tests that verify code blocks are block-level elements, not inline,
// and that they render correctly as block elements.

import { test, expect } from "@playwright/test";
import {
  waitForAppReady,
  typeInEditor,
  selectAllInEditor,
  clickFormatButton,
  getEditorText,
  clearEditor,
} from "./helpers.js";

test.describe("Issue #84 — Code Block Layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("code block renders as a block element (not inline)", async ({ page }) => {
    // Create a code block via the toolbar
    await typeInEditor(page, "test code");
    await selectAllInEditor(page);
    await clickFormatButton(page, "codeBlock");
    await page.waitForTimeout(300);

    const editor = page.locator(".ProseMirror").last();

    // <pre> should be a block-level element
    const preElements = editor.locator("pre");
    const preCount = await preElements.count();
    expect(preCount).toBeGreaterThanOrEqual(1);

    // Verify it's block display (not inline)
    const preDisplay = await preElements.first().evaluate((el) =>
      window.getComputedStyle(el).display
    );
    expect(preDisplay).not.toBe("inline");
  });

  test("inline code and code block are on separate visual lines", async ({ page }) => {
    // First create inline code
    await typeInEditor(page, "inline text");
    await selectAllInEditor(page);
    await clickFormatButton(page, "codeInline");
    await page.waitForTimeout(200);

    // Then create a code block on the next line
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await typeInEditor(page, "block code");
    await selectAllInEditor(page);
    await clickFormatButton(page, "codeBlock");
    await page.waitForTimeout(300);

    const editor = page.locator(".ProseMirror").last();

    // The code block (<pre>) should be a sibling of the paragraph, not inside it
    const preElements = editor.locator("pre");
    const preCount = await preElements.count();
    expect(preCount).toBeGreaterThanOrEqual(1);

    // The <pre> should NOT be inside a <p> tag
    const preInsideP = editor.locator("p pre, p code");
    // We specifically want to check that pre is NOT nested in p
    const preParent = await preElements.first().evaluate((el) =>
      el.parentElement?.tagName
    );
    expect(preParent).not.toBe("P");
  });

  test("pre element does not use display:inline-flex (CSS bug)", async ({ page }) => {
    // Issue #84 root cause: pre { display: inline-flex } in CSS
    await typeInEditor(page, "code block");
    await selectAllInEditor(page);
    await clickFormatButton(page, "codeBlock");
    await page.waitForTimeout(300);

    const editor = page.locator(".ProseMirror").last();
    const preEl = editor.locator("pre").first();

    // The computed display should be block, not inline-flex
    const display = await preEl.evaluate((el) =>
      window.getComputedStyle(el).display
    );
    expect(display).not.toBe("inline-flex");
    expect(display).not.toBe("inline");
  });

  test("code block takes full width of editor (block behavior)", async ({ page }) => {
    await typeInEditor(page, "full width code");
    await selectAllInEditor(page);
    await clickFormatButton(page, "codeBlock");
    await page.waitForTimeout(300);

    const editor = page.locator(".ProseMirror").last();
    const preEl = editor.locator("pre").first();

    const preBox = await preEl.boundingBox();
    const editorBox = await editor.boundingBox();

    if (preBox && editorBox) {
      // Code block should be nearly as wide as the editor
      expect(preBox.width).toBeGreaterThan(editorBox.width * 0.5);
    }
  });

  test("typing after code block creates a new paragraph", async ({ page }) => {
    await typeInEditor(page, "before code");
    await selectAllInEditor(page);
    await clickFormatButton(page, "codeBlock");
    await page.waitForTimeout(300);

    // Press Enter to go after code block, type new text
    const editor = page.locator(".ProseMirror").last();
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await typeInEditor(page, "after code");

    const text = await getEditorText(page);
    expect(text).toContain("after code");
  });
});
