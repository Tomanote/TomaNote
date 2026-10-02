// src/lib/scripts/core/tabPinHandler.js
// Milestone 0.5.9.1 (Mobile Beta) — pin state = the NATIVE ORANGE STAR
// VECTOR only (shared markup from pinnedStar.js). Emojis are permanently
// decoupled from the pin pipeline: they are plain note content and are never
// detected, stored, resolved or rendered as pin metadata. The legacy
// resolution chain (param → detectEmojiInText → stored data-emoji →
// getRandomPinEmoji) is gone by construction.
//
// Persistence contract: the `pinned` class on .tab-list__item is mirrored to
// tabsData.isPinned by saveTabs(); ordering is centralized in
// tabManager.reorderTabs(). This handler never dispatches tabsChanged —
// reorderTabs already notifies.
//
// Both the desktop tab strip and the mobile layout consume this handler, so
// a pin toggle on any viewport stamps the star instantly and identically.

import { stampPinnedStar, removePinnedStars } from "./pinnedStar.js";

export class TabPinHandler {
  constructor(tabManager) {
    this.tabManager = tabManager;
  }

  /**
   * Pin a tab element. The `emoji` argument is accepted only for call-site
   * compatibility and is ignored entirely — the native star is the only pin
   * anchor (explicit emoji arguments produce zero emoji writes).
   * @param {Element} tabElement
   * @param {string|null} [emoji] deliberately unused
   */
  pinTab(tabElement, emoji = null) {
    void emoji; // deliberately unused: emojis no longer influence pin status

    const label = tabElement?.querySelector?.("label") ?? null;
    const labelSpan = tabElement?.querySelector?.("label span") ?? null;

    tabElement.classList.add("pinned");

    // Legacy decoupling cleanup: never leave pre-refactor emoji metadata on
    // a freshly pinned tab.
    label?.removeAttribute?.("data-emoji");
    labelSpan?.removeAttribute?.("data-emoji");

    // Stamp the native star (rebuild = idempotent, no duplicate accumulation).
    stampPinnedStar(label);

    this.tabManager.reorderTabs();
    this.tabManager.saveTabs();
  }

  unpinTab(tabElement) {
    tabElement.classList.remove("pinned");

    const label = tabElement?.querySelector?.("label") ?? null;
    const labelSpan = tabElement?.querySelector?.("label span") ?? null;

    // Strip any stored emoji metadata from pre-refactor markup, plus the
    // star that marked the pinned state.
    label?.removeAttribute?.("data-emoji");
    labelSpan?.removeAttribute?.("data-emoji");
    removePinnedStars(label);

    this.tabManager.reorderTabs();
    this.tabManager.saveTabs();
  }
}
