// e2e/issue97-richPastePersistence.spec.js
// Issue #97: formatted HTML/Markdown clipboard paste breaks editor state and
// fails to persist in LocalStorage.
//
// Reproduces the report: pasting mixed HTML/Markdown (e.g. from Google
// AI/Gemini — headers, bullet lists, bold/italic runs, tables, code fences)
// renders correctly in the Milkdown surface but the next save persists empty
// content; the tab metadata survives while the note body is lost on reload.

import { test, expect } from "@playwright/test";
import { waitForAppReady, getEditorText, waitForAutoSave, getStoredTabs } from "./helpers.js";

const GEMINI_STYLE_HTML =
  "<h2>Gemini Summary</h2>" +
  "<ul>" +
  "<li><strong>Bold point</strong> with supporting detail</li>" +
  "<li>Second <em>italic</em> point " +
  "<ul><li>nested child item</li></ul>" +
  "</li>" +
  "</ul>" +
  "<blockquote><p>Quoted takeaway line</p></blockquote>" +
  "<pre><code class=\"language-js\">const answer = 42;</code></pre>" +
  "<table><thead><tr><th>Option</th><th>Score</th></tr></thead>" +
  "<tbody><tr><td>alpha</td><td>9</td></tr></tbody></table>" +
  "<p>Strikethrough <del>old idea</del> and a <a href=\"https://tomanote.app\">link</a>.</p>" +
  "<hr>" +
  "<p>Closing normal paragraph</p>";

const GEMINI_STYLE_PLAIN =
  "## Gemini Summary\n" +
  "- **Bold point** with supporting detail\n" +
  "- Second *italic* point\n" +
  "  - nested child item\n" +
  "\n" +
  "> Quoted takeaway line\n" +
  "\n" +
  "```js\nconst answer = 42;\n```\n" +
  "\n" +
  "| Option | Score |\n| --- | --- |\n| alpha | 9 |\n" +
  "\n" +
  "Strikethrough ~~old idea~~ and a [link](https://tomanote.app).\n" +
  "\n" +
  "---\n" +
  "\n" +
  "Closing normal paragraph";

/** Dispatch a rich paste event with mixed HTML/Markdown payload onto the editor */
async function pasteRichContent(page) {
  await page.evaluate(
    ({ html, plain }) => {
      const pm = document.querySelector(".ProseMirror");
      if (!pm) throw new Error("ProseMirror surface not found");

      const pasteEvent = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer(),
      });
      pasteEvent.clipboardData.setData("text/html", html);
      pasteEvent.clipboardData.setData("text/plain", plain);
      pm.dispatchEvent(pasteEvent);
    },
    { html: GEMINI_STYLE_HTML, plain: GEMINI_STYLE_PLAIN }
  );
  await page.waitForTimeout(500);
}

/** Trigger explicit save to localStorage for Milkdown tabs */
async function triggerSave(page) {
  await page.evaluate(() => {
    if (window.tabManager) window.tabManager.saveTabs();
  });
  await page.waitForTimeout(200);
}

test.describe("Issue #97 — Rich paste persistence", () => {
  test("complex mixed HTML/Markdown paste persists via explicit save (non-empty)", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await page.locator(".ProseMirror").last().click();

    await pasteRichContent(page);
    await triggerSave(page);

    const stored = await getStoredTabs(page);
    expect(stored).not.toBeNull();
    expect(stored.length).toBeGreaterThanOrEqual(1);

    // The pasted body must reach storage — the exact data-loss bug was the
    // persisted content being empty while tab metadata survived.
    const savedTab = stored.find(
      (tab) => tab.content && tab.content.includes("Gemini Summary")
    );
    expect(savedTab).toBeTruthy();
    expect(savedTab.content).toContain("Bold point");
    expect(savedTab.content).toContain("nested child item");
    // Milkdown pads table cells for alignment, so match without trailing pipe
    expect(savedTab.content).toMatch(/\|\s*alpha\s*\|/); // gfm table row
    expect(savedTab.content).toContain("const answer = 42;"); // code fence
    expect(savedTab.content).toContain("Closing normal paragraph");
  });

  test("complex rich paste persists through the real autosave debounce", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await page.locator(".ProseMirror").last().click();

    await pasteRichContent(page);

    // Do NOT call saveTabs() — let the app's own autosave pipeline persist.
    await waitForAutoSave(page);
    await page.waitForTimeout(300);

    const stored = await getStoredTabs(page);
    const savedTab = stored.find(
      (tab) => tab.content && tab.content.includes("Gemini Summary")
    );
    expect(savedTab).toBeTruthy();
    expect(savedTab.content).toContain("Bold point");
  });

  test("rich pasted content survives a full page reload", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await page.locator(".ProseMirror").last().click();

    await pasteRichContent(page);
    await triggerSave(page);

    await page.goto("about:blank");
    await page.goto("/");
    await waitForAppReady(page);

    const text = await getEditorText(page);
    expect(text).toContain("Gemini Summary");
    expect(text).toContain("Bold point");
    expect(text).toContain("alpha");
  });
});
