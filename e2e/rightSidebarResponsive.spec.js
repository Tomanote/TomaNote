// e2e/rightSidebarResponsive.spec.js
// The RightSidebar (desktop floating menu / #floating-nav) must keep 100% of
// its tool buttons visible and click-accessible when the viewport height shrinks.
// Requirement: Adobe-style multi-column wrap — NOT a vertical scrollbar.
// body/html must keep overflow:hidden (the editor workspace stays locked).

import { test, expect } from "@playwright/test";
import { waitForAppReady } from "./helpers.js";

/** Seed a deterministic tab so the app never boots into the empty state (nav stays visible) */
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

/** Measure every visible tool button's position relative to the viewport */
async function getButtonsReport(page) {
  return page.evaluate(() => {
    const vp = { w: window.innerWidth, h: window.innerHeight };
    const btns = [...document.querySelectorAll("#floating-nav button[data-floating-action]")].filter(
      (b) => getComputedStyle(b).display !== "none" && b.offsetParent !== null
    );
    const items = btns.map((b) => {
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const topEl = document.elementFromPoint(cx, cy);
      return {
        action: b.dataset.floatingAction,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        left: Math.round(r.left),
        inViewport: r.top >= 0 && r.bottom <= vp.h,
        // Not covered by another element (e.g. the tab list with a higher z-index)
        reachable: !!topEl && (topEl === b || b.contains(topEl) || topEl.contains(b)),
      };
    });
    const columns = new Set(items.map((i) => i.left));
    return {
      vp,
      total: items.length,
      clipped: items.filter((i) => !i.inViewport),
      covered: items.filter((i) => !i.reachable),
      columnCount: columns.size,
      bodyOverflow: getComputedStyle(document.body).overflow,
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
      // The document itself must never grow past the viewport (no scrollbar possible)
      docOverflowing:
        document.documentElement.scrollHeight > document.documentElement.clientHeight + 1 ||
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      navScrollable: (() => {
        const nav = document.querySelector("#floating-nav");
        return nav ? nav.scrollHeight > nav.clientHeight + 1 : null;
      })(),
    };
  });
}

test.describe("RightSidebar — adaptive multi-column layout at low height", () => {
  test("no tool button is clipped when viewport height drops to 500px", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 500 });
    await seedTab(page);
    await page.goto("/");
    await waitForAppReady(page);

    const report = await getButtonsReport(page);
    expect(report.total).toBeGreaterThanOrEqual(12);
    expect(report.clipped, `clipped: ${JSON.stringify(report.clipped)}`).toEqual([]);
  });

  test("clipped buttons must flow into additional columns, not a scrollbar", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 500 });
    await seedTab(page);
    await page.goto("/");
    await waitForAppReady(page);

    const report = await getButtonsReport(page);

    // Multi-column wrap: buttons occupy 2+ distinct x positions (columns)
    expect(report.columnCount).toBeGreaterThanOrEqual(2);

    // The cheap vertical scrollbar solution is forbidden: workspace stays locked.
    // Note: html computes as "hidden auto" (Layout sets overflow-x: hidden only —
    // CSS flips the untouched axis from visible to auto), so the exact string is
    // not "hidden". What matters: body stays hidden AND the document never
    // overflows, so no scrollbar can appear.
    expect(report.bodyOverflow).toBe("hidden");
    expect(report.htmlOverflow).toContain("hidden");
    expect(report.docOverflowing).toBe(false);
    expect(report.navScrollable).toBe(false);
  });

  test("every tool button remains click-accessible (not covered by other layers)", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 500 });
    await seedTab(page);
    await page.goto("/");
    await waitForAppReady(page);

    const report = await getButtonsReport(page);
    expect(report.covered, `covered: ${JSON.stringify(report.covered)}`).toEqual([]);
  });

  test("tall viewports keep the single-column layout (no over-wrapping)", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await seedTab(page);
    await page.goto("/");
    await waitForAppReady(page);

    const report = await getButtonsReport(page);
    expect(report.total).toBeGreaterThanOrEqual(12);
    expect(report.clipped).toEqual([]);
    expect(report.columnCount).toBe(1);
  });

  test("an intermediate height (700px) also keeps all buttons visible", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await seedTab(page);
    await page.goto("/");
    await waitForAppReady(page);

    const report = await getButtonsReport(page);
    expect(report.total).toBeGreaterThanOrEqual(12);
    expect(report.clipped, `clipped: ${JSON.stringify(report.clipped)}`).toEqual([]);
  });
});
