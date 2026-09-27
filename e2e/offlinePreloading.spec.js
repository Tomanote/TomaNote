// e2e/offlinePreloading.spec.js
// Milestone 0.5.8 — Offline Pre-loading & Fallback.
// Verifies the centralized connectivity store exposure, the discrete
// connection status toast, and the offline-aware save toast text
// ("Saved locally (Offline mode active)") for both autosave and Ctrl+S.
//
// Playwright's context.setOffline() flips navigator.onLine AND fires the
// window online/offline events, which is exactly what ConnectivityStore listens to.

import { test, expect } from "@playwright/test";
import { waitForAppReady, typeInEditor } from "./helpers.js";

const OFFLINE_SAVE_TEXT = "Saved locally (Offline mode active)";

test.describe("Milestone 0.5.8 — Connectivity store exposure", () => {
  test("window.connectivity is globally exposed with a reactive subscribe()", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const report = await page.evaluate(() => {
      const store = window.connectivity;
      if (!store) return { exposed: false };
      let notified = null;
      const unsubscribe = store.subscribe((detail) => {
        notified = detail;
      });
      const hasApi =
        typeof store.isOnline === "function" &&
        typeof store.subscribe === "function" &&
        typeof store.init === "function";
      unsubscribe();
      return { exposed: true, hasApi, isOnline: store.isOnline(), notifiedOnSubscribe: notified };
    });

    expect(report.exposed).toBe(true);
    expect(report.hasApi).toBe(true);
    expect(report.isOnline).toBe(true);
    // subscribe() must NOT fire immediately (state is pulled, not pushed, on bind)
    expect(report.notifiedOnSubscribe).toBeNull();
  });

  test("store reacts to browser offline/online events and notifies subscribers", async ({ page, context }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await page.evaluate(() => {
      window.__connEvents = [];
      window.__connUnsub = window.connectivity.subscribe((d) => window.__connEvents.push(d));
    });

    await context.setOffline(true);
    await expect
      .poll(() => page.evaluate(() => window.connectivity.isOnline()))
      .toBe(false);

    await context.setOffline(false);
    await expect
      .poll(() => page.evaluate(() => window.connectivity.isOnline()))
      .toBe(true);

    const events = await page.evaluate(() => {
      window.__connUnsub?.();
      return window.__connEvents;
    });

    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0]).toMatchObject({ online: false, previous: true });
    expect(events[events.length - 1]).toMatchObject({ online: true, previous: false });
  });
});

test.describe("Milestone 0.5.8 — Connection status indicator", () => {
  test("appears on connection drop and hides after reconnect timeout", async ({ page, context }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const status = page.locator("#connection-status");
    await expect(status).toBeAttached();
    // Hidden while online
    expect(await status.evaluate((el) => el.classList.contains("is-visible"))).toBe(false);

    await context.setOffline(true);
    await expect
      .poll(() => status.evaluate((el) => el.classList.contains("is-visible")), { timeout: 5000 })
      .toBe(true);
    await expect(status).toContainText(/offline/i);

    // Reconnect → transient "Back online" notice that auto-hides
    await context.setOffline(false);
    await expect(status).toContainText(/online/i);
    await expect
      .poll(() => status.evaluate((el) => el.classList.contains("is-visible")), { timeout: 6000 })
      .toBe(false);
  });
});

test.describe("Milestone 0.5.8 — Offline-aware save toast", () => {
  test("manual Ctrl+S shows 'Saved locally (Offline mode active)' while offline", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await context.setOffline(true);
    await expect
      .poll(() => page.evaluate(() => window.connectivity.isOnline()))
      .toBe(false);

    await typeInEditor(page, "Offline manual save content");
    // Milkdown autosave syncs into tabsData after ~300ms
    await page.waitForTimeout(700);

    await page.keyboard.press("Control+S");
    await page.waitForTimeout(250);

    // 1. Text adapts to the offline state
    const toastText = await page.locator("#save-indicator .save-indicator__text").textContent();
    expect(toastText.trim()).toBe(OFFLINE_SAVE_TEXT);

    // 2. Toast is visible
    const toastVisible = await page.evaluate(() =>
      document.getElementById("save-indicator")?.classList.contains("is-visible")
    );
    expect(toastVisible).toBe(true);

    // 3. LocalStorage persistence still works (offline-first guarantee)
    const stored = await page.evaluate(() => localStorage.getItem("tabsData"));
    expect(stored).toContain("Offline manual save content");

    await context.setOffline(false);
  });

  test("autosave (debounced) toast also adapts while offline", async ({ page, context }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await context.setOffline(true);
    await expect
      .poll(() => page.evaluate(() => window.connectivity.isOnline()))
      .toBe(false);

    await typeInEditor(page, "Offline autosave content");

    // The toast fires only after Milkdown's tab-saved (+300ms) re-arms the
    // SaveIndicator debounce (+5000ms) — poll instead of a fixed sleep to
    // avoid racing the restart.
    await expect
      .poll(
        async () => {
          const state = await page.evaluate(() => ({
            visible: document.getElementById("save-indicator")?.classList.contains("is-visible"),
            text: document.querySelector("#save-indicator .save-indicator__text")?.textContent?.trim(),
          }));
          return state.visible && state.text === OFFLINE_SAVE_TEXT;
        },
        { timeout: 9000 }
      )
      .toBe(true);
  });

  test("toast returns to standard 'Saved' text after reconnecting", async ({ page, context }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await context.setOffline(true);
    await expect
      .poll(() => page.evaluate(() => window.connectivity.isOnline()))
      .toBe(false);

    await typeInEditor(page, "Reconnect content");
    await page.waitForTimeout(700);
    await page.keyboard.press("Control+S");
    await page.waitForTimeout(200);

    const offlineText = await page.locator("#save-indicator .save-indicator__text").textContent();
    expect(offlineText.trim()).toBe(OFFLINE_SAVE_TEXT);

    await context.setOffline(false);
    await expect
      .poll(() => page.evaluate(() => window.connectivity.isOnline()))
      .toBe(true);

    await page.keyboard.press("Control+S");
    await page.waitForTimeout(200);

    const onlineText = await page.locator("#save-indicator .save-indicator__text").textContent();
    expect(onlineText.trim()).toBe("Saved");

    await context.setOffline(false);
  });
});

test.describe("Milestone 0.5.8 — Notes remain fully usable offline", () => {
  test("create, edit and restore notes works with the connection dropped", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await context.setOffline(true);
    await expect
      .poll(() => page.evaluate(() => window.connectivity.isOnline()))
      .toBe(false);

    // Create a note while offline
    await page.click("#create-tab");
    await page.waitForTimeout(600);
    await typeInEditor(page, "Created while offline");
    // Milkdown doSave (300ms) → tab-saved → saveTabs() must reach LocalStorage
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("tabsData") ?? ""), { timeout: 5000 })
      .toContain("Created while offline");

    // Reconnect to reload the document (no SW page cache by design — 0.6.0)
    // and verify the restore path rebuilds the note purely from LocalStorage.
    await context.setOffline(false);
    await page.reload();
    await waitForAppReady(page);

    // App shell still alive (never a blank window)
    expect(await page.evaluate(() => typeof window.tabManager)).toBe("object");
    expect(await page.evaluate(() => typeof window.connectivity.isOnline())).toBe("boolean");
    expect(await page.locator(".tab-list__item").count()).toBe(2);

    // Open the note created offline — editor must render its content
    const noteLabel = page.locator(".tab-list__item label", { hasText: "New" }).nth(1);
    await noteLabel.click();
    await page.waitForSelector(".ProseMirror", { timeout: 10000 });
    await expect(page.locator(".ProseMirror").last()).toContainText("Created while offline", {
      timeout: 10000,
    });

    await context.setOffline(false);
  });
});
