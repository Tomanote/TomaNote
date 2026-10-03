// e2e/milestone0591-mobileBeta.spec.js
// Milestone 0.5.9.1 — Mobile Beta end-to-end contract.
//
// Locks down:
//  1. The handwritten TopBarMobile search input queries open notes by title
//     AND plaintext body, while the List/Grid checkboxes stay hidden/inert.
//  2. Pin toggles stamp the native orange vector star — the emoji binding is
//     fully un-bound (no data-emoji anywhere, no emoji in persistence).
//  3. The mobile-only back control commits edits, runs saveTabs(),
//     closes the full-screen workspace and returns to the list — no reload.
//  4. Uniform note-row heights in mobile list mode.
//  5. The BottomBar pivot: search lens gone, Support button wired to the
//     modal, legacy tab submenu wrapper stripped.
//  6. Zero Desktop regressions: no mobile chrome leaks ≥768px, Modo Zen and
//     the Support modal live in the LeftSidebar.

import { test, expect } from "@playwright/test";
import {
  waitForAppReady,
  clearLocalStorage,
  getStoredTabs,
  typeInEditor,
} from "./helpers.js";

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

const SEARCH_INPUT = '.tn-searchMobile__header .tn-container__searchBar input[type="text"]';

async function visibleRowCount(page) {
  return page.locator(".tab-list__item").evaluateAll((els) =>
    els.filter((el) => el.style.display !== "none").length
  );
}

async function closeActiveNote(page) {
  await page.evaluate(() => {
    const active = document.querySelector('.tab-list input[type="radio"]:checked');
    if (active) active.checked = false;
    document.dispatchEvent(new CustomEvent("tabsChanged"));
  });
}

async function seedNotes(page) {
  await page.evaluate(() => {
    window.tabManager.createTab("Alpha groceries", "milk and bread");
    window.tabManager.createTab("Beta travel", "caribbean beach");
  });
}

test.describe("Mobile Beta — live search over the handwritten top bar", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/");
    await clearLocalStorage(page);
    await page.reload();
    await waitForAppReady(page);
    await seedNotes(page);
  });

  test("only the core search input is visible; the two checkboxes are hidden and inert", async ({ page }) => {
    await expect(page.locator(SEARCH_INPUT)).toBeVisible();

    // List/Grid view toggles are beta-gated out of the viewport
    await expect(page.locator(".tn-searchMobile__header .tn-container__buttons")).toBeHidden();

    const gate = await page
      .locator('.tn-container__buttons input[type="checkbox"]')
      .evaluateAll((els) =>
        els.map((el) => ({
          id: el.id,
          disabled: el.disabled,
          checked: el.checked,
          tabIndex: el.tabIndex,
          ariaHidden: el.getAttribute("aria-hidden"),
        }))
      );

    expect(gate).toHaveLength(2);
    for (const box of gate) {
      expect(box.disabled).toBe(true);
      expect(box.checked).toBe(false);
      expect(box.tabIndex).toBe(-1);
      expect(box.ariaHidden).toBe("true");
    }
  });

  test("a typed query filters open notes by title and by plaintext body", async ({ page }) => {
    const total = await page.locator(".tab-list__item").count();
    expect(total).toBeGreaterThanOrEqual(3);

    const input = page.locator(SEARCH_INPUT);

    // TITLE match
    await input.fill("Alpha");
    await expect.poll(() => visibleRowCount(page)).toBe(1);

    // BODY match (plaintext across the collection)
    await input.fill("beach");
    await expect.poll(() => visibleRowCount(page)).toBe(1);
    const shown = await page.locator(".tab-list__item").evaluateAll((els) =>
      els
        .filter((el) => el.style.display !== "none")
        .map((el) => el.querySelector("label span")?.textContent ?? "")
    );
    expect(shown.join(" ")).toContain("Beta travel");

    // Case-insensitive title match
    await input.fill("ALPHA");
    await expect.poll(() => visibleRowCount(page)).toBe(1);

    // No match → everything hidden
    await input.fill("zzz-no-match");
    await expect.poll(() => visibleRowCount(page)).toBe(0);

    // Clearing the query restores the whole list
    await input.fill("");
    await expect.poll(() => visibleRowCount(page)).toBe(total);
  });
});

test.describe("Mobile Beta — native star pin (emoji un-bound)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/");
    await clearLocalStorage(page);
    await page.reload();
    await waitForAppReady(page);
    await seedNotes(page);
    // waitForAppReady leaves a note open — its immersive pane covers the
    // list. Return to the list first, the way a user would.
    await closeActiveNote(page);
  });

  test("pinning stamps the orange vector star instantly and writes zero emoji metadata", async ({ page }) => {
    const firstRow = page.locator(".tab-list__item").first();

    await firstRow.locator(".pin-tab").click();
    // NB: assert via classList — the row's class string always contains the
    // literal substring "pinned" inside `[&:not(.pinned)_label]:relative!`
    await expect
      .poll(() => firstRow.evaluate((el) => el.classList.contains("pinned")))
      .toBe(true);

    const star = firstRow.locator(".tn-pinned-star");
    await expect(star).toBeVisible();

    // TomaNote's native orange accent
    const fill = await star.evaluate((el) => getComputedStyle(el).fill);
    expect(fill).toMatch(/255,\s*165,\s*0/);

    // Emoji anchoring is decommissioned everywhere
    expect(await page.locator("[data-emoji]").count()).toBe(0);

    const stored = await getStoredTabs(page);
    const pinnedEntry = stored.find((tab) => tab.isPinned);
    expect(pinnedEntry).toBeTruthy();
    expect(pinnedEntry).not.toHaveProperty("emoji");

    // Toggling back removes the star immediately
    await firstRow.locator(".pin-tab").click();
    await expect
      .poll(() => firstRow.evaluate((el) => el.classList.contains("pinned")))
      .toBe(false);
    await expect(page.locator(".tn-pinned-star")).toHaveCount(0);
    expect(await page.locator("[data-emoji]").count()).toBe(0);
  });
});

test.describe("Mobile Beta — immersive workspace + back button", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/");
    await clearLocalStorage(page);
    await page.reload();
    await waitForAppReady(page);
  });

  test('injects the back button in the top-left of the full-screen writing surface', async ({ page }) => {
    // waitForAppReady opens a note, so the immersive workspace is live
    const back = page.locator("[data-tn-back]");
    await expect(back).toBeVisible();
    // Playwright locale is en-US -> the i18n dictionary resolves the
    // visible label to "Return" (rendered lowercase via text-transform,
    // so match case-insensitively against the text content).
    await expect(back).toHaveText(/^return$/i);

    const box = await back.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeLessThanOrEqual(20);
    expect(box.y).toBeLessThanOrEqual(60);

    // Mobile-only control: never on the desktop strip
    await page.setViewportSize(DESKTOP);
    await expect(page.locator("[data-tn-back]")).toHaveCount(0);
    await page.setViewportSize(MOBILE);
  });

  test("tapping the back button commits edits, saves, closes the workspace and returns — no reload", async ({ page }) => {
    const urlBefore = page.url();

    // Close the note waitForAppReady opened, then open one from the list
    await closeActiveNote(page);
    await page.locator(".tab-list__item label").first().click();
    await expect(page.locator("[data-tn-back]")).toBeVisible();

    // Write something that must survive the close transaction
    await typeInEditor(page, "back must save this");

    await page.locator("[data-tn-back]").click();

    // Workspace layer closed, control gone, back on the list
    await expect(page.locator("[data-tn-back]")).toHaveCount(0);
    await expect(page.locator('.tab-list input[type="radio"]:checked')).toHaveCount(0);

    // No page reload
    expect(page.url()).toBe(urlBefore);

    // Core persistence workflow ran
    const stored = await getStoredTabs(page);
    expect(JSON.stringify(stored)).toContain("back must save this");
  });
});

test.describe("Mobile Beta — uniform row heights", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/");
    await clearLocalStorage(page);
    await page.reload();
    await waitForAppReady(page);
    await seedNotes(page);
    await closeActiveNote(page);
    await page.waitForTimeout(400);
  });

  test("every active note row shares an identical height in list mode", async ({ page }) => {
    const heights = await page.locator(".tab-list__item").evaluateAll((els) =>
      els
        .filter((el) => el.style.display !== "none")
        .map((el) => el.getBoundingClientRect().height)
    );

    expect(heights.length).toBeGreaterThanOrEqual(2);
    const tallest = Math.max(...heights);
    for (const height of heights) {
      expect(Math.abs(height - tallest)).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("Mobile Beta — BottomBar pivot", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/");
    await clearLocalStorage(page);
    await page.reload();
    await waitForAppReady(page);
  });

  test("search lens removed, Support button mounted and wired to the modal overlay", async ({ page }) => {
    await expect(page.locator('#bottom-bar [data-floating-action="search"]')).toHaveCount(0);
    await expect(page.locator("#submenu-tab")).toHaveCount(0);
    await expect(page.locator('#bottom-bar [data-floating-action="tab"]')).toHaveCount(0);

    const support = page.locator('#bottom-bar [data-floating-action="support"]');
    await expect(support).toBeAttached();

    // The immersive pane and the Astro dev toolbar both overlay the bar in
    // dev — dispatch the real click straight onto the control
    await closeActiveNote(page);
    await support.dispatchEvent("click");
    await expect(page.locator("#supportModal")).toBeVisible();
    await expect(page.locator("#supportModal .support-modal__action")).toHaveCount(4);

    await page.locator('#supportModal button[data-action="close"]').click();
    await expect(page.locator("#supportModal")).toBeHidden();
  });

  test("the legacy note-editing (tab actions) submenu block is gone for good", async ({ page }) => {
    await expect(page.locator("#submenu-tab")).toHaveCount(0);
    // the desktop floating menu keeps its own pin/edit/delete actions —
    // only the BOTTOM BAR wrapper block is decommissioned
    await expect(page.locator('#bottom-bar [data-floating-action="pin-tab"]')).toHaveCount(0);
    await expect(page.locator('#bottom-bar [data-floating-action="edit-name-tab"]')).toHaveCount(0);
    await expect(page.locator('#bottom-bar [data-floating-action="delete-tab"]')).toHaveCount(0);
    // content + font submenus survive untouched
    await expect(page.locator("[data-submenu-trigger]")).toHaveCount(2);
  });
});

test.describe("Desktop regression guard (0.5.9.1)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("no mobile chrome or row-height stamps leak into the desktop tab strip", async ({ page }) => {
    await expect(page.locator("[data-tn-back]")).toHaveCount(0);
    await expect(page.locator(".tn-searchMobile__header")).toBeHidden();

    const stamps = await page
      .locator(".tab-list__item")
      .evaluateAll((els) => els.map((el) => el.style.minHeight));
    expect(stamps.every((value) => value === "")).toBe(true);

    // The desktop tab strip still renders its rows
    await expect(page.locator(".tab-list__item").first()).toBeVisible();
  });

  test("LeftSidebar exposes Modo Zen and the accessible Support modal", async ({ page }) => {
    await expect(page.locator("#zen-mode-toggle")).toBeVisible();

    const supportButton = page.locator('.sidebar-left__bottom button[onclick*="supportModal"]');
    await expect(supportButton).toBeVisible();
    await supportButton.click();

    const modal = page.locator("#supportModal");
    await expect(modal).toBeVisible();
    await expect(modal.locator(".support-modal__action")).toHaveCount(4);
    await expect(modal.locator(".support-modal__close")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();

    const booted = await page.evaluate(() => ({
      zen: window.zenMode?.initialized === true,
      support: window.supportModal?.modal != null,
      topBar: window.topBarMobile?.initialized === true,
    }));
    expect(booted).toEqual({ zen: true, support: true, topBar: true });
  });

  test("desktop pin pipeline is star-only (no emoji resurrection)", async ({ page }) => {
    await page.evaluate(() => {
      const row = document.querySelector(".tab-list__item");
      window.tabManager.pinTab(row);
    });

    const pinned = await page
      .locator(".tab-list__item")
      .first()
      .evaluate((el) => el.classList.contains("pinned"));
    expect(pinned).toBe(true);
    await expect(page.locator(".tn-pinned-star").first()).toBeAttached();
    expect(await page.locator("[data-emoji]").count()).toBe(0);

    const stored = await getStoredTabs(page);
    for (const tab of stored) {
      expect(tab).not.toHaveProperty("emoji");
    }
  });

  test("bottom bar is fully pivoted on desktop markup too", async ({ page }) => {
    await expect(page.locator('#bottom-bar [data-floating-action="search"]')).toHaveCount(0);
    await expect(page.locator('#bottom-bar [data-floating-action="support"]')).toHaveCount(1);
    await expect(page.locator("#submenu-tab")).toHaveCount(0);
    await expect(page.locator("[data-submenu-trigger]")).toHaveCount(2);
  });
});
