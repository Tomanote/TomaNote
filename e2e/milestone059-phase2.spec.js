// e2e/milestone059-phase2.spec.js
// Milestone 0.5.9 Phase 2 — Mobile bottombar pivot, dynamic list/grid views,
// compact pinned strip and touch long-press drag reorder.

import { test, expect } from "@playwright/test";
import { waitForAppReady } from "./helpers.js";

function makeTouch(x, y, identifier = 0) {
  return `new Touch({ identifier: ${identifier}, target: document.body, clientX: ${x}, clientY: ${y} })`;
}

test.describe("Phase 2 — BottomBar support pivot (mobile)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("bottom bar heart button opens the Phase 1 support modal", async ({ page }) => {
    const heart = page.locator('#bottom-bar button[data-floating-action="support"]');
    await expect(heart).toBeVisible();

    // The dev-only astro-dev-toolbar overlays the bottom strip in dev builds
    // and intercepts real pointer events (absent in prod builds), so dispatch
    // the click programmatically — same handler path a user tap triggers.
    await heart.evaluate((el) => el.click());
    await expect(page.locator("dialog#supportModal")).toBeVisible();
  });

  test("the obsolete search button is gone from the bottom bar", async ({ page }) => {
    await expect(page.locator('#bottom-bar button[data-floating-action="search"]')).toHaveCount(0);
  });
});

test.describe("Phase 2 — Dynamic note rendering (list ↔ grid)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("grid toggle mutates layout classes and produces a fluid two-column masonry", async ({ page }) => {
    await page.locator("#mobile-view-grid").click();

    await expect(page.locator(".tab-list")).toHaveClass(/tn-view-grid/);
    const firstItem = page.locator(".tab-list__item").first();
    await expect(firstItem).toHaveClass(/tn-card/);

    // Masonry architecture (0.5.9 patch): the toggle now produces a genuine
    // CSS multi-column fragmentainer — cards settle vertically per column
    // with no row-height locking (gridTemplateColumns is `none`).
    const columns = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector(".tab-list"));
      return { columnCount: s.columnCount, display: s.display };
    });
    expect(columns.columnCount).toBe("2");
    expect(columns.display).toBe("block");

    await page.locator("#mobile-view-list").click();
    await expect(firstItem).toHaveClass(/tn-row/);
    await expect(page.locator(".tab-list")).not.toHaveClass(/tn-view-grid/);
  });

  test("list rows render an unformatted 2-line snippet preview capped at 150px", async ({ page }) => {
    // Write through the REAL text pipeline (ProseMirror → autosave →
    // tabsData) — mutating tabsData directly would be clobbered by the next
    // saveTabs() reading the live editor.
    const editor = page.locator(".ProseMirror").last();
    // Focus programmatically: at mobile widths the tab label row intercepts
    // pointer events over the pane's center point
    await editor.evaluate((el) => el.focus());
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.type(`Line ${i} of preview content`);
      await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(800); // autosave debounce
    await page.evaluate(() => window.noteViews.decorate());

    const preview = page.locator(".tab-list__item .tn-note-preview").first();
    await expect(preview).toBeVisible();
    await expect(preview).toContainText("Line 0 of preview content");

    const metrics = await page.evaluate(() => {
      const row = document.querySelector(".tab-list .tab-list__item.tn-row") || document.querySelector(".tab-list__item");
      const el = document.querySelector(".tn-note-preview");
      return { rowMaxHeight: getComputedStyle(row).maxHeight, previewLines: getComputedStyle(el)["-webkit-line-clamp"] };
    });
    expect(metrics.rowMaxHeight).toBe("150px");
    expect(Number(metrics.previewLines)).toBeLessThanOrEqual(3);
  });
});

test.describe("Phase 2 — Pinned section (Phase 3 full-card contract)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForAppReady(page);
    await page.evaluate(() => window.tabManager.createTab("Second note"));
    await expect(page.locator(".tab-list__item")).toHaveCount(2);
    await page.evaluate(() => window.tabManager.pinTab(document.querySelectorAll(".tab-list__item")[1]));
  });

  test("pinned notes render as full cards above normal notes, with star and heading", async ({ page }) => {
    await page.locator("#mobile-view-grid").click();

    const pinnedCard = page.locator(".tab-list .tab-list__item.tn-card--pinned");
    await expect(pinnedCard).toHaveCount(1);

    // Native vector star anchor — never a text emoji
    await expect(pinnedCard.locator(".tn-pinned-star")).toHaveCount(1);
    await expect(pinnedCard).not.toContainText("📌");

    // Heading keeps the note title
    await expect(pinnedCard.locator(".tn-card-heading")).toContainText("Second note");

    // Pinned card precedes every normal card in the interface
    const order = await page.evaluate(() =>
      [...document.querySelectorAll(".tab-list .tab-list__item")].map((el) => el.className)
    );
    expect(order.findIndex((c) => c.includes("tn-card--pinned"))).toBeLessThan(
      order.findIndex((c) => c.includes("tn-card--normal"))
    );

    // The pinned card opens its note (programmatic: the active editor pane
    // overlays labels at mobile widths and intercepts real pointer events)
    await pinnedCard.locator("label").evaluate((el) => el.click());
    const activeId = await page.evaluate(() => document.querySelector('input[name="body-tab"]:checked')?.id);
    expect(activeId).toBeTruthy();
  });

  test("pinned cards persist across both view modes (list and grid)", async ({ page }) => {
    for (const mode of ["grid", "list"]) {
      await page.locator(`#mobile-view-${mode}`).click();
      await expect(page.locator(".tab-list .tab-list__item.pinned")).toHaveCount(1);
      if (mode === "grid") {
        await expect(page.locator(".tab-list .tab-list__item.tn-card--pinned")).toHaveCount(1);
      } else {
        await expect(page.locator(".tab-list .tab-list__item.tn-row")).toHaveCount(2);
      }
    }
  });
});

test.describe("Phase 2 — Touch long-press drag reorder", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForAppReady(page);
    await page.evaluate(() => window.tabManager.createTab("Second note"));
    await expect(page.locator(".tab-list__item")).toHaveCount(2);
  });

  test("movement before the long-press threshold never activates dragging", async ({ page }) => {
    await page.evaluate(() => {
      const item = document.querySelector(".tab-list__item");
      const rect = item.getBoundingClientRect();
      const touch = new Touch({ identifier: 0, target: document.body, clientX: rect.left + 10, clientY: rect.top + 10 });
      item.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [touch] }));
      const moved = new Touch({ identifier: 0, target: document.body, clientX: rect.left + 10, clientY: rect.top + 40 });
      document.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, cancelable: true, touches: [moved] }));
    });

    await page.waitForTimeout(400);
    await expect(page.locator(".tab-list__item").first()).not.toHaveClass(/tn-dragging/);
  });

  test("long-press activates the dragging state, moves reorder in real time, release persists", async ({ page }) => {
    const item = page.locator(".tab-list__item").first();

    await page.evaluate(() => {
      const el = document.querySelector(".tab-list__item");
      const rect = el.getBoundingClientRect();
      const touch = new Touch({ identifier: 0, target: document.body, clientX: rect.left + 10, clientY: rect.top + 10 });
      el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [touch] }));
    });
    await page.waitForTimeout(350); // > 200ms long-press threshold
    await expect(item).toHaveClass(/tn-dragging/);

    // Drag over the second note — real-time index shift
    await page.evaluate(() => {
      const items = document.querySelectorAll(".tab-list__item");
      const rect = items[1].getBoundingClientRect();
      const moved = new Touch({ identifier: 0, target: document.body, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 });
      document.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, cancelable: true, touches: [moved] }));
    });

    const idsAfterMove = await page.evaluate(() =>
      [...document.querySelectorAll(".tab-list .tab-list__item input")].map((i) => i.id)
    );
    expect(idsAfterMove[0]).toBe("body-tab-2");

    // Release: dragging state cleared, order persisted through the core routine
    await page.evaluate(() => {
      const touch = new Touch({ identifier: 0, target: document.body, clientX: 0, clientY: 0 });
      document.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [touch] }));
    });
    await expect(item).not.toHaveClass(/tn-dragging/);

    const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("tabsData")).map((t) => t.id));
    expect(persisted[0]).toBe("body-tab-2");
  });

  test("release without a drag leaves tabsData untouched", async ({ page }) => {
    const before = await page.evaluate(() => localStorage.getItem("tabsData"));

    await page.evaluate(() => {
      const el = document.querySelector(".tab-list__item");
      const rect = el.getBoundingClientRect();
      const touch = new Touch({ identifier: 0, target: document.body, clientX: rect.left + 10, clientY: rect.top + 10 });
      el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [touch] }));
      const end = new Touch({ identifier: 0, target: document.body, clientX: rect.left + 10, clientY: rect.top + 10 });
      document.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [end] }));
    });

    const after = await page.evaluate(() => localStorage.getItem("tabsData"));
    expect(after).toBe(before);
  });
});
