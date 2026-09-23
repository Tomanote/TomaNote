// e2e/tabContextMenu.spec.js
// Right-clicking a note tab must show a context menu whose pin action
// dynamically reflects that specific tab's pinned state:
//   unpinned => "Pin Tab" (context-menu.pin-tab)
//   pinned   => "Unpin Tab" (context-menu.unpin-tab)
// Clicking the action runs the unified window.tabManager pin/unpin lifecycle.

import { test, expect } from "@playwright/test";
import { waitForAppReady, getTabCount } from "./helpers.js";

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

/** Open the context menu on the first tab label */
async function openTabContextMenu(page) {
  const label = page.locator(".tab-list__item label").first();
  await label.click({ button: "right" });
  await page.waitForTimeout(300);
  return page.locator("#context-menu");
}

/** Read the pin action item's label span (text + data-i18n key) */
async function getPinLabel(page) {
  return page.evaluate(() => {
    const item = document.querySelector('#context-menu .context-menu__item[data-action="pin-tab"]');
    if (!item) return null;
    const span = item.querySelector("span[data-i18n]");
    return {
      visible: item.style.display !== "none",
      key: span ? span.getAttribute("data-i18n") : null,
      text: span ? span.textContent.trim() : null,
      pinText: window.i18n ? window.i18n.t("context-menu.pin-tab") : null,
      unpinText: window.i18n ? window.i18n.t("context-menu.unpin-tab") : null,
    };
  });
}

/** Is the first tab currently pinned? */
async function isFirstTabPinned(page) {
  return page.evaluate(() => {
    const item = document.querySelector(".tab-list__item");
    return item ? item.classList.contains("pinned") : null;
  });
}

test.describe("Tab Context Menu — dynamic Pin/Unpin actions", () => {
  test.beforeEach(async ({ page }) => {
    await seedTab(page);
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("right-click on an unpinned tab shows the pin action with the pin label", async ({ page }) => {
    expect(await getTabCount(page)).toBeGreaterThanOrEqual(1);
    expect(await isFirstTabPinned(page)).toBe(false);

    const menu = await openTabContextMenu(page);
    await expect(menu).toBeVisible();

    const label = await getPinLabel(page);
    expect(label).not.toBeNull();
    expect(label.visible).toBe(true);
    expect(label.key).toBe("context-menu.pin-tab");
    expect(label.text).toBe(label.pinText);
    expect(label.text).not.toBe(label.unpinText);
  });

  test("clicking the pin action pins the tab through tabManager", async ({ page }) => {
    const menu = await openTabContextMenu(page);
    const label = await getPinLabel(page);
    expect(label.key).toBe("context-menu.pin-tab");

    await menu.locator('.context-menu__item[data-action="pin-tab"]').click();
    await page.waitForTimeout(500);

    // The pin lifecycle ran: DOM class + unified tabManager state
    expect(await isFirstTabPinned(page)).toBe(true);
    const managerState = await page.evaluate(() => {
      const tab = window.tabManager?.tabsData?.[0];
      return tab ? tab.isPinned : null;
    });
    expect(managerState).toBe(true);
  });

  test("after pinning, re-opening the menu shows the unpin label", async ({ page }) => {
    // Pin via the context menu first
    let menu = await openTabContextMenu(page);
    await menu.locator('.context-menu__item[data-action="pin-tab"]').click();
    await page.waitForTimeout(500);
    expect(await isFirstTabPinned(page)).toBe(true);

    // Re-open on the same tab — label must flip to "Unpin Tab"
    menu = await openTabContextMenu(page);
    await expect(menu).toBeVisible();

    const label = await getPinLabel(page);
    expect(label.visible).toBe(true);
    expect(label.key).toBe("context-menu.unpin-tab");
    expect(label.text).toBe(label.unpinText);
    expect(label.text).not.toBe(label.pinText);
  });

  test("clicking the unpin action restores the unpinned state and label flips back", async ({ page }) => {
    // Pin first
    let menu = await openTabContextMenu(page);
    await menu.locator('.context-menu__item[data-action="pin-tab"]').click();
    await page.waitForTimeout(500);
    expect(await isFirstTabPinned(page)).toBe(true);

    // Unpin through the same menu item (now labeled unpin)
    menu = await openTabContextMenu(page);
    const label = await getPinLabel(page);
    expect(label.key).toBe("context-menu.unpin-tab");
    await menu.locator('.context-menu__item[data-action="pin-tab"]').click();
    await page.waitForTimeout(500);

    expect(await isFirstTabPinned(page)).toBe(false);
    const managerState = await page.evaluate(() => {
      const tab = window.tabManager?.tabsData?.[0];
      return tab ? tab.isPinned : null;
    });
    expect(managerState).toBe(false);

    // Label flips back to pin
    menu = await openTabContextMenu(page);
    const backLabel = await getPinLabel(page);
    expect(backLabel.key).toBe("context-menu.pin-tab");
    expect(backLabel.text).toBe(backLabel.pinText);
  });

  test("tab context menu hides text-only actions (copy, bold, undo)", async ({ page }) => {
    const menu = await openTabContextMenu(page);
    await expect(menu).toBeVisible();

    const textActions = await page.evaluate(() => {
      const items = [...document.querySelectorAll("#context-menu .context-menu__item")];
      const textItems = items.filter((i) => i.dataset.context !== "tab");
      return {
        total: textItems.length,
        hidden: textItems.filter((i) => i.style.display === "none").length,
      };
    });
    expect(textActions.total).toBeGreaterThan(0);
    expect(textActions.hidden).toBe(textActions.total);
  });
});
