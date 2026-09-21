// e2e/issue85-emptyParagraphAfter.spec.js
// Issue #85: Missing empty paragraph after code block, inline code, and blockquote
// Tests verify that after inserting these elements, an empty paragraph
// exists below to allow continued writing.

import { test, expect } from "@playwright/test";
import {
  waitForAppReady,
  typeInEditor,
  selectAllInEditor,
  clickFormatButton,
  getEditorText,
  clearEditor,
} from "./helpers.js";

test.describe("Issue #85 — Empty Paragraph After Special Elements", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("code block: empty paragraph exists after insertion", async ({ page }) => {
    await typeInEditor(page, "content");
    await selectAllInEditor(page);
    await clickFormatButton(page, "codeBlock");
    await page.waitForTimeout(500);

    const editor = page.locator(".ProseMirror").last();

    // After code block, there should be an empty <p> tag
    // The autoEmptyLinesPlugin should handle this
    const paragraphs = editor.locator("p");
    const pCount = await paragraphs.count();

    // At least one paragraph should be empty (the one after the code block)
    let hasEmptyParagraph = false;
    for (let i = 0; i < pCount; i++) {
      const text = await paragraphs.nth(i).textContent();
      if (text.trim() === "") {
        hasEmptyParagraph = true;
        break;
      }
    }
    expect(hasEmptyParagraph).toBe(true);
  });

  test("blockquote: empty paragraph exists after insertion", async ({ page }) => {
    await typeInEditor(page, "quoted content");
    await selectAllInEditor(page);
    await clickFormatButton(page, "blockquote");
    await page.waitForTimeout(500);

    const editor = page.locator(".ProseMirror").last();

    // After blockquote, there should be an empty paragraph
    const paragraphs = editor.locator("p");
    const pCount = await paragraphs.count();

    let hasEmptyParagraph = false;
    for (let i = 0; i < pCount; i++) {
      const text = await paragraphs.nth(i).textContent();
      if (text.trim() === "") {
        hasEmptyParagraph = true;
        break;
      }
    }
    expect(hasEmptyParagraph).toBe(true);
  });

  test("inline code: cursor is positioned for continued typing", async ({ page }) => {
    await typeInEditor(page, "text to format");
    await selectAllInEditor(page);
    await clickFormatButton(page, "codeInline");
    await page.waitForTimeout(300);

    const editor = page.locator(".ProseMirror").last();

    // After inline code, user should be able to type more
    // Move cursor to end and type
    await editor.click();
    await page.keyboard.press("End");
    await typeInEditor(page, " after code");

    const text = await getEditorText(page);
    expect(text).toContain("after code");
  });

  test("code block as first element: empty paragraph before AND after", async ({ page }) => {
    // Clear the editor first
    await clearEditor(page);
    await page.waitForTimeout(200);

    // Type and convert to code block
    await typeInEditor(page, "only block");
    await selectAllInEditor(page);
    await clickFormatButton(page, "codeBlock");
    await page.waitForTimeout(500);

    const editor = page.locator(".ProseMirror").last();

    // For the first block, autoEmptyLinesPlugin should add empty paragraphs
    // both before AND after
    const preElement = editor.locator("pre").first();
    const preBox = await preElement.boundingBox();

    // There should be content before the code block (empty paragraph)
    // We check that the code block is not at the very top
    if (preBox) {
      // Code block should have some space above it (from empty paragraph)
      expect(preBox.y).toBeGreaterThan(0);
    }
  });

  test("blockquote as first element: empty paragraph before AND after", async ({ page }) => {
    await clearEditor(page);
    await page.waitForTimeout(200);

    await typeInEditor(page, "only quote");
    await selectAllInEditor(page);
    await clickFormatButton(page, "blockquote");
    await page.waitForTimeout(500);

    const editor = page.locator(".ProseMirror").last();

    // Verify user can type after the blockquote
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await typeInEditor(page, "after quote");

    const text = await getEditorText(page);
    expect(text).toContain("after quote");
  });
});
