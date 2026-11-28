// src/features/mobile-topbar/noteViews.js
// Milestone 0.5.9 Phase 3 — Figma-compliant dynamic note rendering for the
// mobile views. Presentation-only decorator over the EXISTING TabManager DOM
// (100% reuse — no rebuild):
//  - subscribes to the viewMode store (list ↔ grid) and re-classes each
//    .tab-list__item as a full-width row (tn-row) or a masonry card
//    (tn-card tn-card--normal);
//  - subscribes to the viewMode store (list ↔ grid) and re-classes each
//    .tab-list__item as a full-width row (tn-row) or a masonry card
//    (tn-card tn-card--normal);
//  - injects an unformatted, opacity-faded multi-line text snippet
//    (.tn-note-preview) beneath every NORMAL card/row title. PINNED cards
//    render TITLE ONLY (maintenance sprint Fix #1.2): their 100%-width card
//    shows the heading (manual or auto-generated) and the native star — no
//    duplicate snippet body, in lockstep with the topbar search sync;
//  - hosts the INLINE CARD ACTION STRIP (Fix #5 & #6): every responsive
//    card (pinned and normal) carries three accessible semantic buttons —
//    pin (tabPinHandler toggle), edit (opens the immersive fullscreen
//    editor modal) and delete (legacy deletion workflow). The BottomBar
//    no longer duplicates these utilities.
//  - renders pinned notes as COMPREHENSIVE CARDS (tn-card--pinned) stacked at
//    the top of the grid flow — never single-line chips. Pinned items keep
//    their core DOM position (first, right after #tab-list-anchor), so in
//    grid mode they sit on the first full-width grid row before any normal
//    card, without duplicating the note anywhere (Figma: "pinned bypass the
//    grid, 100% width").
//  - publishes the MEASURED single-column width as --tn-card-width on the
//    grid container on every decorate pass and resize, so the Figma height
//    formulas (max = 1:1, min = width / 2.5) in mobile-topbar.scss resolve
//    against real content-box pixels instead of viewport guesses.
// It re-decorates idempotently on init, viewmode-changed and tabsChanged.

import { devLogger } from "../../lib/scripts/utils/devLogger.js";
import {
  PINNED_STAR_SVG,
  PINNED_STAR_CLASS,
} from "../../lib/scripts/core/pinnedStar.js";

// Native vector icons for the inline card action strip (same heroicons
// paths as Icon.astro — one visual language across the app).
const CARD_ACTION_ICONS = {
  pin: "M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z",
  edit: "M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42",
  delete: "m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0",
};

// The pinned indicator is the NATIVE ORANGE STAR VECTOR shared with the
// desktop strip (pinnedStar.js) — never a text emoji. The class contract is
// what tests and themes target; CSS supplies the accent color.
const STAR_SVG = PINNED_STAR_SVG;
const STAR_CLASS = PINNED_STAR_CLASS;

// Figma spec: clean plaintext snippet capped at 200 characters.
export const SNIPPET_MAX_CHARS = 200;

export class NoteViews {
  constructor(options = {}) {
    this.options = {
      debug: true,
      ...options,
    };

    this.tabList = null;
    this.initialized = false;
    this.boundViewModeChanged = null;
    this.boundTabsChanged = null;
    this.observer = null;
    this.scheduled = false;
    this.cardWidthObserver = null;
  }

  async init() {
    this.tabList = document.querySelector(".tab-list");
    if (!this.tabList) {
      this.log("Tab list not found — note views unavailable");
      return this;
    }

    // Event-driven redecoration is synchronous (cheap, idempotent); the rAF
    // coalescing is reserved for MutationObserver mutation bursts.
    this.boundViewModeChanged = () => this.decorate();
    window.addEventListener("viewmode-changed", this.boundViewModeChanged);

    this.boundTabsChanged = () => this.decorate();
    document.addEventListener("tabsChanged", this.boundTabsChanged);

    // Structural safety net: tabs created/removed without a tabsChanged burst
    this.observer = new MutationObserver(() => this.scheduleDecorate());
    this.observer.observe(this.tabList, { childList: true });

    // Masonry geometry: re-publish the measured column width whenever the
    // container box changes (orientation, resize, scrollbar appearing).
    this.setupCardWidthMeasurement();

    // Inline card action strip delegation (Fix #5 & #6)
    this.setupCardActionDelegation();

    this.decorate();
    this.initialized = true;
    this.log("initialized");
    return this;
  }

  /** Coalesce event bursts into one decorate per frame. */
  scheduleDecorate() {
    if (this.scheduled || !this.initialized) return;
    this.scheduled = true;
    requestAnimationFrame(() => {
      this.scheduled = false;
      this.decorate();
    });
  }

  decorate() {
    if (!this.tabList) return;

    const isGrid = window.viewMode?.isGrid() === true;
    this.tabList.classList.toggle("tn-view-grid", isGrid);
    this.tabList.classList.toggle("notes-grid-container", isGrid);

    const items = this.tabList.querySelectorAll(".tab-list__item");
    items.forEach((item) => this.decorateItem(item, isGrid));

    // Masonry height formulas consume the measured column width
    this.publishCardWidth();
  }

  /** Observe the grid container so --tn-card-width tracks real resizes. */
  setupCardWidthMeasurement() {
    if (this.cardWidthObserver || typeof ResizeObserver === "undefined") return;
    this.cardWidthObserver = new ResizeObserver(() => this.publishCardWidth());
    this.cardWidthObserver.observe(this.tabList);
  }

  /**
   * Publish the MEASURED single-column width as --tn-card-width on the tab
   * list. Multi-column fragmentainers cannot express "column width" in CSS
   * (100% of a column is not a length), so the decorator measures the real
   * artifact: the first normal card's border-box IS the column width (cards
   * span their column at 100%). Arithmetic over the content box is only the
   * fallback while no normal card exists to measure.
   */
  publishCardWidth() {
    if (!this.tabList) return;
    const firstCard = this.tabList.querySelector(".tab-list__item.tn-card--normal");
    let width = firstCard ? firstCard.getBoundingClientRect().width : 0;
    if (!(width > 0)) {
      const s = window.getComputedStyle(this.tabList);
      const gap = parseFloat(s.columnGap) || 0;
      const padL = parseFloat(s.paddingLeft) || 0;
      const padR = parseFloat(s.paddingRight) || 0;
      width = (this.tabList.clientWidth - padL - padR - gap) / 2;
    }
    if (!Number.isFinite(width) || width <= 0) return; // unmeasurable box (jsdom/hidden)
    this.tabList.style.setProperty("--tn-card-width", `${Math.round(width)}px`);
  }

  decorateItem(item, isGrid) {
    const input = item.querySelector("input");
    const tab = input ? window.tabManager?.tabsData?.find((t) => t.id === input.id) : null;
    const isPinned = item.classList.contains("pinned");

    // Strategy classes — list rows vs grid cards (presentation only)
    item.classList.toggle("tn-row", !isGrid);
    item.classList.toggle("tn-card", isGrid);
    item.classList.toggle("tn-card--normal", isGrid && !isPinned);
    item.classList.toggle("tn-card--pinned", isGrid && isPinned);
    item.dataset.tnPreviewLines = isGrid ? "3" : "2";

    // Figma: heading + snippet beneath it. The heading is the tab's REAL
    // label span (rename/pin flows keep working — it is never replaced);
    // adding a <div> wrapper keeps label's inline context intact.
    const label = item.querySelector("label");
    let heading = label?.querySelector("div.tn-card-heading");
    if (!heading && label) {
      const span = label.querySelector("span");
      heading = document.createElement("div");
      heading.className = "tn-card-heading";
      if (span) {
        span.replaceWith(heading);
        heading.appendChild(span); // <div class="tn-card-heading"><span>…</span></div>
      } else {
        label.prepend(heading);
      }
    }

    // Figma: pinned cards anchor the NATIVE orange star vector before the
    // heading. Injected only for pinned items (and removed on unpin).
    if (isPinned && label) {
      if (!label.querySelector(`.${STAR_CLASS}`)) {
        label.insertBefore(
          document.createRange().createContextualFragment(STAR_SVG).firstChild,
          heading
        );
      }
    } else {
      label?.querySelector(`.${STAR_CLASS}`)?.remove();
    }

    // Snippet preview (decorative duplication inside the card). Maintenance
    // Fix #1.2: pinned cards are TITLE ONLY — never create the preview body
    // for them and strip any stale one left by a previous decoration cycle.
    let preview = item.querySelector(".tn-note-preview");
    if (isPinned) {
      preview?.remove();
      preview = null;
    } else if (!preview) {
      preview = document.createElement("span");
      preview.className = "tn-note-preview";
      preview.setAttribute("aria-hidden", "true");
      item.appendChild(preview);
    }

    if (preview) {
      preview.textContent = this.snippetFor(item, tab);
    }

    // Inline card action strip (Fix #5): three semantic utility buttons.
    this.decorateCardActions(item, isPinned);

    item.dataset.tnCardDecorated = "1";
  }

  /**
   * Inject the 3-button action strip into a card (idempotent). Actions are
   * delegated in handleCardActionClick — the buttons carry only data attrs.
   */
  decorateCardActions(item) {
    if (item.querySelector(".tn-card-actions")) return;

    const strip = document.createElement("div");
    strip.className = "tn-card-actions";

    const isPinned = item.classList.contains("pinned");
    const actions = [
      {
        action: "pin",
        icon: CARD_ACTION_ICONS.pin,
        label: isPinned
          ? window.i18n?.t?.("context-menu.unpin-tab") ?? "Desfijar Pestaña"
          : window.i18n?.t?.("context-menu.pin-tab") ?? "Fijar Pestaña",
      },
      {
        action: "edit",
        icon: CARD_ACTION_ICONS.edit,
        label: window.i18n?.t?.("context-menu.edit-name-tab") ?? "Renombrar Pestaña",
      },
      {
        action: "delete",
        icon: CARD_ACTION_ICONS.delete,
        label: window.i18n?.t?.("context-menu.delete-tab") ?? "Eliminar Pestaña",
      },
    ];

    for (const { action, icon, label } of actions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `tn-card-action tn-card-action--${action}`;
      btn.setAttribute("data-card-action", action);
      btn.setAttribute("aria-label", label);
      btn.title = label;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${icon}"/></svg>`;
      strip.appendChild(btn);
    }

    item.appendChild(strip);
  }

  /** Delegated click handling for the inline action strip (Fix #5 & #6). */
  handleCardActionClick(event) {
    const btn = event.target.closest?.("button[data-card-action]");
    if (!btn) return;

    const item = btn.closest(".tab-list__item");
    if (!item) return;

    const action = btn.dataset.cardAction;
    event.preventDefault();
    event.stopPropagation();

    if (action === "pin") {
      // Native pin pipeline: class flip → reorderTabs → saveTabs (the same
      // route the context menu uses). NoteViews re-decorates on tabsChanged.
      const isPinned = item.classList.contains("pinned");
      const method = isPinned ? "unpinTab" : "pinTab";
      window.tabManager?.[method]?.(item);
      const pinLabel = isPinned
        ? window.i18n?.t?.("context-menu.pin-tab") ?? "Fijar Pestaña"
        : window.i18n?.t?.("context-menu.unpin-tab") ?? "Desfijar Pestaña";
      btn.setAttribute("aria-label", pinLabel);
      btn.title = pinLabel;
      this.log("card pin toggle:", item.querySelector("input")?.id);
      return;
    }

    if (action === "edit") {
      // Módulo C: open the note in the immersive fullscreen editor modal.
      window.editorModal?.open?.(item);
      this.log("card edit → editor modal:", item.querySelector("input")?.id);
      return;
    }

    if (action === "delete") {
      // Legacy deletion workflow (confirmation modal → editor teardown →
      // DOM removal → persistence) — identical to the context menu route.
      window.tabManager?.deleteTabElement?.(item);
      return;
    }
  }

  /** Bind strip delegation on the tab list (once per controller). */
  setupCardActionDelegation() {
    if (this.boundCardActionClick) return;
    this.boundCardActionClick = (event) => this.handleCardActionClick(event);
    this.tabList.addEventListener("click", this.boundCardActionClick);
  }

  /**
   * Snippet text: tabsData content is the source of truth; falls back to the
   * live editor DOM. HTML is stripped (unformatted preview), whitespace
   * collapsed and the result truncated to 200 chars (Figma spec).
   */
  snippetFor(item, tab) {
    let raw = tab?.content || "";
    if (!raw.trim()) {
      const contentEl = item.querySelector(".tab-list__item--content");
      raw = contentEl?.textContent || "";
    }
    return this.collapse(raw).slice(0, SNIPPET_MAX_CHARS);
  }

  firstLineOf(raw) {
    const lines = String(raw || "").split("\n").map((l) => l.trim());
    return lines.find(Boolean) || "";
  }

  collapse(text) {
    return String(text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  destroy() {
    if (this.boundViewModeChanged) {
      window.removeEventListener("viewmode-changed", this.boundViewModeChanged);
    }
    if (this.boundTabsChanged) {
      document.removeEventListener("tabsChanged", this.boundTabsChanged);
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.boundCardActionClick && this.tabList) {
      this.tabList.removeEventListener("click", this.boundCardActionClick);
    }
    if (this.cardWidthObserver) {
      this.cardWidthObserver.disconnect();
      this.cardWidthObserver = null;
    }
    this.boundCardActionClick = null;
    this.boundViewModeChanged = null;
    this.boundTabsChanged = null;
    this.initialized = false;
  }

  log(...args) {
    if (this.options.debug) {
      devLogger.log("[NoteViews]", ...args);
    }
  }
}
