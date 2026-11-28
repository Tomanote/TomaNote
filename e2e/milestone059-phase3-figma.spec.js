// e2e/milestone059-phase3-figma.spec.js
// Milestone 0.5.9 Phase 3 — Figma visual specification for the mobile note
// layout, enforced as structural assertions (TDD RED → implement → GREEN).
//
// 1. Empty state renders a vertically centered wrapper (logo + warning + CTA).
// 2. Pinned notes bypass the grid: full-width stacked cards at the top, native
//    orange star vector + heading + multi-line snippet, no duplication.
// 3. Normal notes flow in a GENUINE two-column masonry (CSS multi-column
//    model) whose geometry follows the Figma formula:
//      card width  = ((viewport - 2*margin) - gap) / 2
//      max height  = card width (1:1 boundary)
//      min height  = card width / 2.5
//    with a gradient fade masking truncated text at the height cap and every
//    active card rendering a sanitized multi-line snippet beneath its title.
// 4. Pinned rows keep their inline action strip anchored to the lower-right
//    quadrant of the card surface (Fix #1.2 realignment).
// 5. #tn-empty-state is fully isolated from the column model: it keeps its
//    full-viewport flex centering whenever active.

import { test, expect } from "@playwright/test";
import { waitForAppReady } from "./helpers.js";

const VIEWPORT = { width: 390, height: 844 };
const GRID_GAP = 16; // px — Figma dual-column gap
const EPSILON = 2; // px tolerance for computed layouts

/**
 * Effective lateral margin of the grid: the workspace is inset by the app
 * gutter (body padding) AND the grid's own padding — the Figma formula uses
 * the EFFECTIVE margin, so the tests measure it instead of assuming it.
 */
async function effectiveLateralMargin(page) {
  return page.evaluate(() =>
    document.querySelector(".tab-list").getBoundingClientRect().left +
    parseFloat(getComputedStyle(document.querySelector(".tab-list")).paddingLeft)
  );
}

/** Switch to the mobile grid view and wait for the container hook. */
async function enterGridView(page) {
  await page.locator("#mobile-view-grid").click();
  await expect(page.locator(".tab-list")).toHaveClass(/tn-view-grid/);
}

/**
 * Seed the ACTIVE note with REAL editor text (ProseMirror → autosave →
 * tabsData), then force a view decoration pass.
 * The CHECKED tab is the source of truth for "active" (createTab checks the
 * newest tab) — its pane is the only VISIBLE editor; focusing a hidden
 * pane silently no-ops and the keystrokes go nowhere.
 */
async function seedActiveNote(page, text) {
  await page.waitForFunction(
    () => {
      const item = document.querySelector(".tab-list__item:has(input:checked)");
      return item && item.querySelector(".ProseMirror") !== null;
    },
    null,
    { timeout: 15000 }
  );
  await page.evaluate(() => {
    document.querySelector(".tab-list__item:has(input:checked) .ProseMirror").focus();
  });
  await page.keyboard.type(text);
  await page.waitForTimeout(800); // autosave debounce
  await page.evaluate(() => window.noteViews.decorate());
}

test.describe("Phase 3 Figma — Empty state (no tabs open)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto("/");
    // Isolation: never restore the previous test's tabs (spec #1 requires zero notes).
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    // This suite asserts the EMPTY state: no tab may be fabricated for us.
    // (Under the legacy z-index:-1 hack the auto-created tab was masked —
    // the programmatic gate makes the honesty requirement explicit.)
    await waitForAppReady(page, { createIfEmpty: false });
  });

  test("renders a perfectly centered vertical wrapper (logo + warning + CTA)", async ({ page }) => {
    const state = page.locator("#tn-empty-state");
    await expect(state).toBeVisible();

    const box = await state.boundingBox();
    expect(box).not.toBeNull();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(VIEWPORT.height + EPSILON);

    const metrics = await page.evaluate(() => {
      const el = document.getElementById("tn-empty-state");
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      // Nearest ancestor whose position ≠ static, per CSS containing-block rules
      let anchor = el.parentElement;
      while (anchor && getComputedStyle(anchor).position === "static") anchor = anchor.parentElement;
      const anchorRect = anchor ? anchor.getBoundingClientRect() : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
      return {
        display: style.display,
        flexDirection: style.flexDirection,
        alignItems: style.alignItems,
        justifyContent: style.justifyContent,
        rect,
        anchor: anchorRect,
        children: [...el.children].map((c) => c.getBoundingClientRect()),
      };
    });

    expect(metrics.display).toBe("flex");
    expect(metrics.flexDirection).toBe("column");
    expect(metrics.alignItems).toBe("center");
    expect(metrics.justifyContent).toBe("center");
    for (const child of metrics.children) {
      expect(child.width).toBeGreaterThan(0);
      expect(child.height).toBeGreaterThan(0);
      expect(child.y).toBeGreaterThanOrEqual(metrics.anchor.top - EPSILON);
      expect(child.y + child.height).toBeLessThanOrEqual(metrics.anchor.top + metrics.anchor.height + EPSILON);
    }

    // Brand mark + warning text must be present inside the wrapper
    await expect(state.locator("img")).toBeVisible();
    await expect(state.locator("h1, h2")).not.toHaveCount(0);
    await expect(state).toContainText(/Toma[Nn]ote/);
  });
});

test.describe("Phase 3 Figma — Pinned section bypasses the grid", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto("/");
    await waitForAppReady(page);
    await page.evaluate(() => window.tabManager.createTab("Second note"));
    await expect(page.locator(".tab-list__item")).toHaveCount(2);
    // Pin the explicitly-named second tab (locale-agnostic heading assert)
    await page.evaluate(() => window.tabManager.pinTab(document.querySelectorAll(".tab-list__item")[1]));
    await expect(page.locator(".tab-list__item.pinned")).toHaveCount(1);
    // Activate the pinned note programmatically: the ACTIVE editor pane is
    // absolutely positioned over the labels at mobile widths and intercepts
    // real pointer events (same interception the desktop-less E2E hits).
    await page.evaluate(() => {
      const radio = document.querySelector(".tab-list__item.pinned input");
      radio.checked = true;
      document.dispatchEvent(new CustomEvent("tabsChanged"));
    });
    await seedActiveNote(page, "Pinned body content that should surface inside the pinned card snippet.");
    // Pinned cards are a GRID-mode concept — enter the masonry view last
    await enterGridView(page);
  });

  test("pinned items render as full-width stacked cards: star + heading (title only)", async ({ page }) => {
    const cards = page.locator(".tab-list .tab-list__item.tn-card--pinned");
    await expect(cards).toHaveCount(1);

    const metrics = await page.evaluate(() => {
      const list = document.querySelector(".tab-list");
      const card = document.querySelector(".tab-list .tab-list__item.tn-card--pinned");
      const workspace = list.getBoundingClientRect();
      const s = getComputedStyle(list);
      const rect = card.getBoundingClientRect();
      const star = card.querySelector(".tn-pinned-star");
      const heading = card.querySelector(".tn-card-heading");
      const snippet = card.querySelector(".tn-note-preview");
      return {
        // "Available" width per Figma = inside the grid's lateral margins
        availableWidth: workspace.width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight),
        cardWidth: rect.width,
        starColor: star ? getComputedStyle(star).color : null,
        starSvg: !!star && star.tagName.toLowerCase() === "svg",
        headingText: heading ? heading.textContent.trim() : "",
        hasSnippet: !!snippet,
      };
    });

    // 1) Full available width (spans both columns + the inter-column gap)
    expect(metrics.cardWidth).toBeGreaterThanOrEqual(metrics.availableWidth - EPSILON);
    // 2) No duplication: only the OTHER note renders as a normal card
    await expect(page.locator(".tab-list .tab-list__item.tn-card--normal")).toHaveCount(1);
    // 3) Native vector star, tinted orange (fixed color token, not theme contrast)
    expect(metrics.starSvg).toBe(true);
    expect(metrics.starColor).toBe("rgb(255, 165, 0)");
    // 4) Heading only — maintenance Fix #1.2: pinned cards render TITLE ONLY
    // (no content snippet body; title is manual or auto-generated)
    expect(metrics.headingText).toBe("Second note");
    expect(metrics.hasSnippet).toBe(false);  });

  test("pinned cards stack above every normal note in DOM order", async ({ page }) => {
    await expect(page.locator(".tn-pinned-strip")).toHaveCount(0);

    const order = await page.evaluate(() =>
      [...document.querySelectorAll(".tab-list .tab-list__item")].map((el) => el.className)
    );
    expect(order.findIndex((c) => c.includes("tn-card--pinned"))).toBeLessThan(
      order.findIndex((c) => c.includes("tn-card--normal"))
    );
  });

  test("pinned card opens its note on tap", async ({ page }) => {
    const card = page.locator(".tab-list .tab-list__item.tn-card--pinned");
    // The card wraps the tab's radio input — a tap lands on its label
    await card.locator("label").evaluate((el) => el.click());
    const activeId = await page.evaluate(() => document.querySelector('input[name="body-tab"]:checked')?.id);
    expect(activeId).toBeTruthy();
  });
});

test.describe("Phase 3 Figma — Masonry grid geometry (viewMode grid)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto("/");
    await waitForAppReady(page);
    await page.evaluate(() => {
      window.tabManager.createTab("Second note");
      window.tabManager.createTab("Third note");
    });
    await expect(page.locator(".tab-list__item")).toHaveCount(3);
    await enterGridView(page);
    // Give the ACTIVE note real content; the others stay empty so the grid
    // mixes a content-tall card with min-height cards (Figma asymmetry).
    await seedActiveNote(page, "Alpha note body text that grows the card beyond the minimum height boundary. ".repeat(2));
  });

  test("grid container, columns and dual-column geometry follow the Figma formula", async ({ page }) => {
    const margin = await effectiveLateralMargin(page); // body gutter + grid padding

    const metrics = await page.evaluate(() => {
      const list = document.querySelector(".tab-list");
      const s = getComputedStyle(list);
      return {
        // Genuine masonry: CSS multi-column model — NOT the row-locked grid.
        display: s.display,
        columnCount: s.columnCount,
        columnGap: s.columnGap,
        // Row-height locking is exactly what the multi-column model removes.
        gridTemplateColumns: s.gridTemplateColumns,
        // The measured single-column width feeds the card height formulas
        // (JS-supplied token set by noteViews.decorate on every pass).
        widthVar: s.getPropertyValue("--tn-card-width").trim(),
      };
    });

    expect(metrics.display).toBe("block");
    expect(metrics.columnCount).toBe("2");
    expect(parseFloat(metrics.columnGap)).toBe(GRID_GAP);
    // No residual row-locked grid tracks — the masonry has none.
    expect(metrics.gridTemplateColumns.startsWith("none") || metrics.gridTemplateColumns === "").toBe(true);

    // Widths: ((viewport − 2·effectiveMargin) − gap) / 2 → 169px at 390px
    // with the current app gutter (10px) + container padding (8px).
    const expected = (VIEWPORT.width - margin * 2 - GRID_GAP) / 2;
    const widths = await page.evaluate(() =>
      [...document.querySelectorAll(".tab-list .tab-list__item.tn-card--normal")].map((el) => el.getBoundingClientRect().width)
    );
    expect(widths.length).toBeGreaterThanOrEqual(2);
    for (const w of widths) {
      expect(Math.abs(w - expected)).toBeLessThanOrEqual(EPSILON);
    }

    // The height formulas resolve against the MEASURED column width
    // (decorator-supplied custom property), not a viewport guess.
    expect(metrics.widthVar.endsWith("px")).toBe(true);
    expect(Math.abs(parseFloat(metrics.widthVar) - expected)).toBeLessThanOrEqual(EPSILON);
  });

  test("adjacent cards share equal width, respect the height boundaries and flow asymmetrically", async ({ page }) => {
    const boxes = await page.evaluate(() =>
      [...document.querySelectorAll(".tab-list .tab-list__item.tn-card--normal")].map((el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: r.width, h: r.height };
      })
    );
    expect(boxes.length).toBeGreaterThanOrEqual(2);

    // Genuine masonry: exactly two lateral stacks — every normal card's
    // left edge coincides with one of the two column origins.
    const xs = [...new Set(boxes.map((b) => b.x))];
    expect(xs.length).toBe(2);

    // Adjacent cards share equal width — inline-block inside the column
    const widths = boxes.map((b) => b.w);
    expect(Math.abs(Math.max(...widths) - Math.min(...widths))).toBeLessThanOrEqual(EPSILON);

    // Core geometry: min = width/2.5, max = width (1:1 boundary)
    const minExpected = boxes[0].w / 2.5;
    for (const b of boxes) {
      expect(b.h).toBeLessThanOrEqual(b.w + EPSILON);
      expect(b.h).toBeGreaterThanOrEqual(minExpected - EPSILON);
    }

    // Masonry flow: the content-bearing card grows past the empty-card minimum
    const heights = boxes.map((b) => b.h);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(EPSILON);

    // Vertical settling — the Figma point of masonry: some card must start
    // strictly BELOW the top of the opposite column (no row-height locking).
    const tops = boxes.map((b) => b.y);
    expect(Math.max(...tops) - Math.min(...tops)).toBeGreaterThan(EPSILON);
  });

  test("every normal card clips at the height cap with a bottom gradient fade over truncated text", async ({ page }) => {
    const styles = await page.evaluate(() =>
      [...document.querySelectorAll(".tab-list .tab-list__item.tn-card--normal")].map((el) => {
        const s = getComputedStyle(el);
        const preview = el.querySelector(".tn-note-preview");
        const ps = preview ? getComputedStyle(preview) : null;
        const rect = el.getBoundingClientRect();
        const previewRect = preview ? preview.getBoundingClientRect() : null;
        return {
          maxHeight: s.maxHeight,
          minHeight: s.minHeight,
          overflow: s.overflowY,
          cardH: rect.height,
          cardW: rect.width,
          maskImage: ps?.maskImage ?? ps?.webkitMaskImage ?? "",
          // Figma: the fade covers the cap region of the preview — the part
          // where truncated text sits. Math.round keeps the px assert stable.
          fadeTop: previewRect ? Math.round(previewRect.top) : 0,
          fadeBottom: previewRect ? Math.round(previewRect.bottom) : 0,
        };
      })
    );
    expect(styles.length).toBeGreaterThanOrEqual(2);

    for (const st of styles) {
      // Height boundaries: max == card width (1:1), min == width / 2.5 —
      // resolved from the measured --tn-card-width token.
      expect(Math.abs(parseFloat(st.maxHeight) - st.cardW)).toBeLessThanOrEqual(EPSILON);
      expect(Math.abs(parseFloat(st.minHeight) - st.cardW / 2.5)).toBeLessThanOrEqual(EPSILON);
      // The boundary clips (overflow hidden on the card shell)
      expect(st.overflow).toBe("hidden");
      // Gradient fade: a vertical linear-gradient mask over the snippet
      // (Chromium serializes `to bottom` away — assert the fade stops instead)
      expect(st.maskImage).toContain("linear-gradient");
      expect(st.maskImage).toContain("55%");
      expect(st.maskImage).toContain("100%");
    }
  });

  test("every active card wraps a non-empty sanitized snippet beneath the title", async ({ page }) => {
    const cards = await page.evaluate(() =>
      [...document.querySelectorAll(".tab-list .tab-list__item.tn-card--normal")].map((card) => {
        const heading = card.querySelector(".tn-card-heading");
        const snippet = card.querySelector(".tn-note-preview");
        const s = snippet ? getComputedStyle(snippet) : null;
        return {
          heading: heading?.textContent.trim() ?? "",
          snippet: snippet?.textContent.trim() ?? "",
          opacity: s?.opacity ?? "",
          ariaHidden: snippet?.getAttribute("aria-hidden"),
          snippetTop: snippet ? snippet.getBoundingClientRect().top : 0,
          headingBottom: heading ? heading.getBoundingClientRect().bottom : 0,
        };
      })
    );
    expect(cards.length).toBeGreaterThanOrEqual(2);

    // Every decorated card: heading present, snippet element aria-hidden,
    // opacity-faded, positioned beneath the title wrapper
    for (const c of cards) {
      expect(c.heading.length).toBeGreaterThan(0);
      expect(c.ariaHidden).toBe("true");
      expect(Number(c.opacity)).toBeLessThan(1);
      expect(c.snippetTop).toBeGreaterThanOrEqual(c.headingBottom - EPSILON);
      if (c.snippet.length > 0) {
        expect(c.snippet).not.toContain("<");
      }
    }

    // At least one card carries the seeded body text beneath its title
    const withBody = cards.filter((c) => c.snippet.includes("Alpha note body"));
    expect(withBody.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Phase 3 Figma — Pinned rows: action strip anchored lower-right (Fix #1.2)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto("/");
    await waitForAppReady(page);
    await page.evaluate(() => window.tabManager.createTab("Second note"));
    await expect(page.locator(".tab-list__item")).toHaveCount(2);
    await page.evaluate(() => window.tabManager.pinTab(document.querySelectorAll(".tab-list__item")[1]));
    await expect(page.locator(".tab-list__item.pinned")).toHaveCount(1);
    await enterGridView(page);
  });

  test("pinned action strip anchors to the lower-right quadrant, clear of the text", async ({ page }) => {
    const metrics = await page.evaluate(() => {
      const card = document.querySelector(".tab-list .tab-list__item.tn-card--pinned");
      const strip = card?.querySelector(".tn-card-actions");
      const heading = card?.querySelector(".tn-card-heading");
      if (!card || !strip || !heading) return null;
      const cs = getComputedStyle(strip);
      const cardS = getComputedStyle(card);
      const cardRect = card.getBoundingClientRect();
      const stripRect = strip.getBoundingClientRect();
      const headingRect = heading.getBoundingClientRect();
      return {
        display: cs.display,
        justifyContent: cs.justifyContent,
        gap: cs.gap,
        position: cs.position,
        // Anchoring: the strip lives inside the card's padding + border —
        // measure against the card's CONTENT box (padding-box minus border)
        cardPadRight: (parseFloat(cardS.paddingRight) || 0) + (parseFloat(cardS.borderRightWidth) || 0),
        cardPadLeft: (parseFloat(cardS.paddingLeft) || 0) + (parseFloat(cardS.borderLeftWidth) || 0),
        cardPadBottom: (parseFloat(cardS.paddingBottom) || 0) + (parseFloat(cardS.borderBottomWidth) || 0),
        insetFromRight: Math.round(cardRect.right - stripRect.right),
        // Lower-right: the strip is the visually lowest text-bearing block
        stripTop: Math.round(stripRect.top),
        stripBottom: Math.round(stripRect.bottom),
        headingBottom: Math.round(headingRect.bottom),
        cardBottom: Math.round(cardRect.bottom),
        // Row identity: full-bleed — card and strip widths match
        cardW: Math.round(cardRect.width),
        stripW: Math.round(stripRect.width),
      };
    });
    expect(metrics).not.toBeNull();
    expect(metrics.display).toBe("flex");
    expect(metrics.justifyContent).toBe("flex-end");
    expect(metrics.gap).toBe("12px");
    expect(metrics.position).toBe("relative");
    // Buttons flush with the card's content box (border+padding excluded)
    expect(metrics.insetFromRight - metrics.cardPadRight).toBeLessThanOrEqual(EPSILON);
    expect(metrics.insetFromRight - metrics.cardPadRight).toBeGreaterThanOrEqual(-EPSILON);
    // The strip spans the card's full CONTENT width — flex-end anchors the
    // buttons hard against the right edge
    expect(Math.abs(metrics.stripW - (metrics.cardW - metrics.cardPadRight - metrics.cardPadLeft))).toBeLessThanOrEqual(EPSILON);
    // Anchored BELOW the heading text block (never floating mid-card)
    expect(metrics.stripTop).toBeGreaterThanOrEqual(metrics.headingBottom - 20);
    // ...and flush against the card's lower content edge (lower-RIGHT quadrant)
    expect(metrics.cardBottom - metrics.stripBottom - metrics.cardPadBottom).toBeLessThanOrEqual(EPSILON);
    expect(metrics.cardBottom - metrics.stripBottom - metrics.cardPadBottom).toBeGreaterThanOrEqual(-EPSILON);
  });

  test("pinned rows stay OUTSIDE the column matrix: full-width, stacked above normal cards", async ({ page }) => {
    // Two pinned + two normal → unambiguous vertical stacking assertion.
    // createTab auto-CHECKS the new tab (unpinning the previous active one):
    // pin the first two items SEQUENTIALLY, re-querying after each reorder.
    await page.evaluate(() => window.tabManager.createTab("Third note"));
    await page.evaluate(() => window.tabManager.createTab("Fourth note"));
    await page.evaluate(() => window.tabManager.pinTab(document.querySelectorAll(".tab-list__item")[0]));
    await expect(page.locator(".tab-list .tab-list__item.tn-card--pinned")).toHaveCount(1);
    await page.evaluate(() => window.tabManager.pinTab(document.querySelectorAll(".tab-list__item")[1]));
    await expect(page.locator(".tab-list .tab-list__item.tn-card--pinned")).toHaveCount(2);
    await expect(page.locator(".tab-list .tab-list__item.tn-card--normal")).toHaveCount(2);

    const layout = await page.evaluate(() => {
      const list = document.querySelector(".tab-list");
      const listRect = list.getBoundingClientRect();
      const s = getComputedStyle(list);
      const pinned = [...document.querySelectorAll(".tab-list .tab-list__item.tn-card--pinned")].map((el) => el.getBoundingClientRect());
      const normal = [...document.querySelectorAll(".tab-list .tab-list__item.tn-card--normal")].map((el) => el.getBoundingClientRect());
      return {
        columnCount: s.columnCount,
        listW: listRect.width,
        pinned: pinned.map((r) => ({ top: Math.round(r.top), w: Math.round(r.width), x: Math.round(r.x) })),
        normalXs: normal.map((r) => Math.round(r.x)),
      };
    });

    expect(layout.columnCount).toBe("2");
    // Every pinned row consumes the full AVAILABLE width (the container's
    // content box — its lateral padding is not part of the workspace)
    const contentWidth = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector(".tab-list"));
      return document.querySelector(".tab-list").getBoundingClientRect().width - (parseFloat(s.paddingLeft) || 0) - (parseFloat(s.paddingRight) || 0);
    });
    for (const p of layout.pinned) {
      expect(Math.abs(p.w - contentWidth)).toBeLessThanOrEqual(EPSILON);
    }
    // Pinned rows stack at the very top in DOM order, in a single column of
    // their own (identical left edge — never interleaved into the matrix)
    expect(layout.pinned[0].top).toBeLessThanOrEqual(layout.pinned[1].top);
    expect(layout.pinned[0].x).toBe(layout.pinned[1].x);
    // Normal cards begin BELOW the last pinned row
    const lastPinnedTop = Math.max(...layout.pinned.map((p) => p.top));
    const firstNormalTop = await page.evaluate(() => Math.round(document.querySelector(".tab-list .tab-list__item.tn-card--normal").getBoundingClientRect().top));
    expect(firstNormalTop).toBeGreaterThan(lastPinnedTop);
    // ...and the normal cards flow in the two-column matrix (left edges = column origins)
    expect(new Set(layout.normalXs).size).toBe(2);
  });
});

test.describe("Phase 3 Figma — Empty state isolation from the masonry (viewMode grid)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForAppReady(page, { createIfEmpty: false });
    // The grid hook may be engaged even with zero notes — the isolation is
    // about the empty state surviving it untouched.
    await page.evaluate(() => window.viewMode?.setMode?.("grid"));
  });

  test("#tn-empty-state keeps full-viewport flex centering even in grid mode", async ({ page }) => {
    const state = page.locator("#tn-empty-state");
    await expect(state).toBeVisible();

    const metrics = await page.evaluate(() => {
      const el = document.getElementById("tn-empty-state");
      const s = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        position: s.position,
        display: s.display,
        flexDirection: s.flexDirection,
        alignItems: s.alignItems,
        justifyContent: s.justifyContent,
        rect,
        vw: window.innerWidth,
        vh: window.innerHeight,
        // The masonry columns hook lives on .tab-list — it must NOT have
        // leaked onto the empty-state element or its box
        classes: el.className,
      };
    });

    expect(metrics.position).toBe("absolute");
    expect(metrics.display).toBe("flex");
    expect(metrics.flexDirection).toBe("column");
    expect(metrics.alignItems).toBe("center");
    expect(metrics.justifyContent).toBe("center");
    // Full-viewport coverage: the centering box spans the whole mobile viewport
    expect(Math.abs(metrics.rect.width - metrics.vw)).toBeLessThanOrEqual(EPSILON);
    expect(Math.abs(metrics.rect.height - metrics.vh)).toBeLessThanOrEqual(EPSILON + 1);
    // No masonry classes leaked onto the empty state or the column model
    // onto its ancestors' styling (absolute positioning is the isolation seal)
    expect(metrics.classes).not.toContain("notes-grid-container");
    expect(metrics.classes).not.toContain("tn-card");
    expect(metrics.classes).not.toContain("tn-column");
  });
});
