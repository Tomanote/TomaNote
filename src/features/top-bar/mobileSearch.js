// src/features/top-bar/mobileSearch.js
// Milestone 0.5.9.1 (Mobile Beta) — Mobile Live Search Engine.
//
// Presentation wrapper only: it REUSES the existing TabManager model
// (window.tabManager.tabsData) and mirrors the command-palette search
// contract (case-insensitive match on title OR plain-text body, HTML
// stripped). The input listener was recovered from the developer's stashed
// search-engine mechanics
// (`git show stash@{0}:src/features/mobile-topbar/mobileTopbar.js`) and
// re-targeted onto the handwritten TopBarMobile search input
// (.tn-searchMobile__header → .tn-container__searchBar → input[type=text]).
//
// Filtering hides/shows the EXISTING .tab-list__item elements — no rebuild,
// no copies. It is a no-op above 768px: the whole header lives behind
// `md:hidden!`, and a media-query listener drops any stale query the moment
// the viewport crosses into desktop so the desktop tab strip is never
// filtered by a leftover mobile term.
//
// Beta gate: the two handwritten `type="checkbox"` inputs (List/Grid view
// toggles) are programmatically hidden AND inert this cycle — only the core
// search input stays visible and functional.

import { devLogger } from "../../lib/scripts/utils/devLogger.js";

export class MobileSearch {
  constructor(options = {}) {
    this.options = { debug: true, ...options };

    this.root = null;
    this.searchInput = null;
    this.tabList = null;
    this.initialized = false;

    this.boundInput = null;
    this.boundKeydown = null;
    this.boundTabsChanged = null;
    this.boundMediaChange = null;
    this.desktopMedia = null;
  }

  /**
   * Bind the handwritten search input. Safe to call when the top bar is not
   * mounted (returns silently — the controller is optional chrome).
   * @returns {this}
   */
  async init() {
    this.root = document.querySelector(".tn-searchMobile__header");
    if (!this.root) {
      this.log("Top bar markup not found — mobile search unavailable");
      return this;
    }

    this.searchInput = this.root.querySelector(
      '.tn-container__searchBar input[type="text"]'
    );
    this.tabList = document.querySelector(".tab-list");

    // Beta gate FIRST: List/Grid checkboxes leave the viewport before any
    // handler can observe them.
    this.gateViewToggles();

    if (!this.searchInput) {
      this.log("Search input not found — mobile search unavailable");
      return this;
    }

    this.boundInput = () => this.applyFilter();
    this.searchInput.addEventListener("input", this.boundInput);

    // Enter mirrors the command palette: open the best match.
    this.boundKeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.openFirstMatch();
      }
    };
    this.searchInput.addEventListener("keydown", this.boundKeydown);

    // Tabs created while a filter is active must respect it.
    this.boundTabsChanged = () => {
      if (this.getQuery()) this.applyFilter();
    };
    document.addEventListener("tabsChanged", this.boundTabsChanged);

    // ≥768px the header is hidden by `md:hidden!` — never leak a mobile
    // query into the desktop tab strip.
    this.desktopMedia =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(min-width: 768px)")
        : null;
    this.boundMediaChange = (e) => {
      if (e.matches) this.reset();
    };
    this.desktopMedia?.addEventListener?.("change", this.boundMediaChange);
    if (this.desktopMedia?.matches) this.reset();

    this.initialized = true;
    this.log("initialized");
    return this;
  }

  /**
   * Beta-cycle gate for the handwritten List/Grid checkboxes: the controls
   * are removed from the viewport AND made inert (disabled, untabbable,
   * unchecked) so no keyboard, AT or synthetic click can engage them before
   * the view-toggle engine lands. The gate is expressed as data attributes so
   * the future cycle can lift it without archaeology.
   */
  gateViewToggles() {
    if (!this.root) return { hidden: 0, disabled: 0 };

    let hidden = 0;
    let disabled = 0;

    this.root
      .querySelectorAll('.tn-container__buttons input[type="checkbox"]')
      .forEach((checkbox) => {
        checkbox.checked = false;
        checkbox.disabled = true;
        checkbox.tabIndex = -1;
        checkbox.setAttribute("aria-hidden", "true");
        checkbox.setAttribute("data-tn-beta-gated", "checkbox-toggle");
        disabled += 1;
      });

    const group = this.root.querySelector(".tn-container__buttons");
    if (group && !group.hidden) {
      group.hidden = true;
      group.setAttribute("aria-hidden", "true");
      group.setAttribute("data-tn-beta-gated", "checkbox-toggle");
      hidden += 1;
    }

    this.log(`checkbox gate applied — hidden groups: ${hidden}, disabled inputs: ${disabled}`);
    return { hidden, disabled };
  }

  /**
   * Current search query, trimmed.
   * @returns {string}
   */
  getQuery() {
    return (this.searchInput?.value || "").trim();
  }

  /**
   * Select the first visible match (radio + tabsChanged — the same path
   * CommandPalette.openTab uses), then reset the query and clear the filter.
   * @returns {string | null} the opened tab id
   */
  openFirstMatch() {
    if (!this.tabList) return null;
    if (!this.getQuery()) return null;

    const match = Array.from(
      this.tabList.querySelectorAll(".tab-list__item")
    ).find((item) => item.style.display !== "none");
    const radio = match?.querySelector("input");
    if (!radio) return null;

    radio.checked = true;
    document.dispatchEvent(new CustomEvent("tabsChanged"));

    this.searchInput.value = "";
    this.applyFilter();
    this.log("opened top match:", radio.id);
    return radio.id;
  }

  /**
   * Hide/show the EXISTING tab items against the query. Matches the
   * command-palette contract: tabManager.tabsData is the source of truth,
   * title OR plain-text body, case-insensitive.
   */
  applyFilter() {
    if (!this.tabList) return { visible: 0, hidden: 0 };

    const query = this.getQuery().toLowerCase();
    const items = this.tabList.querySelectorAll(".tab-list__item");
    const tabsData = window.tabManager?.tabsData;

    let visible = 0;
    let hidden = 0;

    items.forEach((item) => {
      const input = item.querySelector("input");
      if (!input) return;

      if (!query) {
        item.style.removeProperty("display");
        visible += 1;
        return;
      }

      const tab = tabsData?.find((t) => t.id === input.id);
      if (!tab) {
        item.style.setProperty("display", "none");
        hidden += 1;
        return;
      }

      const nameMatch = (tab.name || "").toLowerCase().includes(query);
      const contentMatch = this.stripHtml(tab.content || "")
        .toLowerCase()
        .includes(query);
      const matches = nameMatch || contentMatch;

      if (matches) {
        item.style.removeProperty("display");
        visible += 1;
      } else {
        item.style.setProperty("display", "none");
        hidden += 1;
      }
    });

    this.log(`filter "${query}" → visible: ${visible}, hidden: ${hidden}`);

    // Decoupled signal for layout consumers (uniform row heights recompute
    // against the visible set only).
    try {
      document.dispatchEvent(new CustomEvent("tn-search-filtered", { detail: { query, visible, hidden } }));
    } catch {
      /* CustomEvent is unavailable in exotic embeds — filtering still applied */
    }

    return { visible, hidden };
  }

  /**
   * Clear the query and reveal every row (desktop hand-off / destroy).
   */
  reset() {
    if (this.searchInput) this.searchInput.value = "";
    this.applyFilter();
  }

  stripHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }

  destroy() {
    if (this.searchInput && this.boundInput) {
      this.searchInput.removeEventListener("input", this.boundInput);
    }
    if (this.searchInput && this.boundKeydown) {
      this.searchInput.removeEventListener("keydown", this.boundKeydown);
    }
    if (this.boundTabsChanged) {
      document.removeEventListener("tabsChanged", this.boundTabsChanged);
    }
    if (this.desktopMedia && this.boundMediaChange) {
      this.desktopMedia.removeEventListener?.("change", this.boundMediaChange);
    }
    this.reset();

    this.boundInput = null;
    this.boundKeydown = null;
    this.boundTabsChanged = null;
    this.boundMediaChange = null;
    this.desktopMedia = null;
    this.initialized = false;
  }

  log(...args) {
    if (this.options.debug) {
      devLogger.log("[MobileSearch]", ...args);
    }
  }
}
