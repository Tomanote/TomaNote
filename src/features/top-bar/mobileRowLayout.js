// src/features/top-bar/mobileRowLayout.js
// Milestone 0.5.9.1 (Mobile Beta) — uniform row height distribution.
//
// Layout CONSTRAINT only: it never rewrites markup, never reorders notes and
// never touches the developer's SCSS. It measures the active note rows and
// stamps an identical `min-height` on every one of them, so the mobile list
// mode presents a uniform row rhythm no matter how long each title is.
//
// Measurement protocol (the same one the stashed masonry decorator uses):
// strip the previously stamped value → force a measurement pass → publish
// only when the box is actually measurable. jsdom/hidden containers report
// 0, which is treated as "no data" instead of collapsing rows to 0px.
//
// Re-applies on: tab mutations, viewport resize (rAF-coalesced), search
// filtering (MobileSearch emits `tn-search-filtered`) and viewport band
// crossings. Above 768px every stamp is removed — the desktop tab strip is
// left byte-identical to the developer's layout.

import { devLogger } from "../../lib/scripts/utils/devLogger.js";

export class MobileRowLayout {
  constructor(options = {}) {
    this.options = { debug: true, ...options };

    this.tabList = null;
    this.initialized = false;

    this.lastHeight = null;
    this.frame = null;

    this.boundApply = null;
    this.boundMediaChange = null;
    this.mobileMedia = null;
  }

  /**
   * @returns {this}
   */
  async init() {
    this.tabList = document.querySelector(".tab-list");
    if (!this.tabList) {
      this.log("Tab list not found — row layout unavailable");
      return this;
    }

    this.mobileMedia =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(max-width: 768px)")
        : null;

    this.boundApply = () => this.schedule();
    this.boundMediaChange = () => this.apply();

    document.addEventListener("tabsChanged", this.boundApply);
    document.addEventListener("tn-search-filtered", this.boundApply);
    window.addEventListener("resize", this.boundApply);
    this.mobileMedia?.addEventListener?.("change", this.boundMediaChange);

    this.apply();
    this.initialized = true;
    this.log("initialized");
    return this;
  }

  /** @returns {boolean} true inside the ≤768px mobile list band */
  isMobileList() {
    const mobile = this.mobileMedia
      ? this.mobileMedia.matches === true
      : typeof window !== "undefined" && window.innerWidth <= 768;
    if (!mobile) return false;
    // Future-proof: the List/Grid toggle ships next cycle — grid mode keeps
    // its own organic (masonry) row rhythm and must not be leveled.
    if (this.tabList?.classList.contains("tn-view-grid")) return false;
    return true;
  }

  /**
   * Coalesce bursts of triggers into a single measurement pass.
   */
  schedule() {
    if (this.frame != null) return;
    const raf =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (fn) => setTimeout(fn, 16);
    this.frame = raf(() => {
      this.frame = null;
      this.apply();
    });
  }

  /**
   * Stamp an identical min-height across every ACTIVE (visible) note row.
   * @returns {number|null} the published row height in px, or null when the
   *   band is desktop, the grid view is active, no rows exist, or the box is
   *   unmeasurable (jsdom / display:none).
   */
  apply() {
    if (!this.tabList) return null;

    if (!this.isMobileList()) {
      this.clear();
      return null;
    }

    const allRows = Array.from(this.tabList.querySelectorAll(".tab-list__item"));
    const rows = allRows.filter((row) => row.style.display !== "none");

    // 1. Strip every previous stamp (hidden rows included) so we measure
    //    natural heights, not a value we are about to recompute — the
    //    published height can only ever follow the content, never ratchet.
    allRows.forEach((row) => row.style.removeProperty("min-height"));
    if (rows.length === 0) {
      this.lastHeight = null;
      return null;
    }

    // 2. Measure the tallest active row.
    let max = 0;
    rows.forEach((row) => {
      const rect = row.getBoundingClientRect
        ? row.getBoundingClientRect()
        : null;
      const height = rect && Number.isFinite(rect.height) ? rect.height : row.offsetHeight || 0;
      if (height > max) max = height;
    });

    // 3. Unmeasurable box — leave the developer's layout untouched.
    if (!(max > 0)) {
      this.log("no measurable row height (hidden container?) — skipped");
      this.lastHeight = null;
      return null;
    }

    const published = Math.ceil(max);
    rows.forEach((row) => row.style.setProperty("min-height", `${published}px`));
    this.lastHeight = published;
    this.log(`uniform row height published: ${published}px across ${rows.length} rows`);
    return published;
  }

  /**
   * Remove every stamp (desktop hand-off / destroy).
   */
  clear() {
    if (!this.tabList) return;
    this.tabList
      .querySelectorAll(".tab-list__item")
      .forEach((row) => row.style.removeProperty("min-height"));
    this.lastHeight = null;
  }

  destroy() {
    if (this.boundApply) {
      document.removeEventListener("tabsChanged", this.boundApply);
      document.removeEventListener("tn-search-filtered", this.boundApply);
      window.removeEventListener("resize", this.boundApply);
    }
    if (this.mobileMedia && this.boundMediaChange) {
      this.mobileMedia.removeEventListener?.("change", this.boundMediaChange);
    }
    if (this.frame != null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(this.frame);
    }
    this.clear();
    this.boundApply = null;
    this.boundMediaChange = null;
    this.frame = null;
    this.initialized = false;
  }

  log(...args) {
    if (this.options.debug) {
      devLogger.log("[MobileRowLayout]", ...args);
    }
  }
}
