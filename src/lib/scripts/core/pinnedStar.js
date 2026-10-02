// src/lib/scripts/core/pinnedStar.js
// Milestone 0.5.9.1 (Mobile Beta) — single source of truth for the NATIVE
// pin indicator: the heroicons outline star vector (same path as Icon.astro),
// tinted with the fixed Figma orange accent. Both the desktop tab strip
// (TabPinHandler) and the mobile layout (tabs.js pin toggle) consume this
// exact markup, so pin status renders identically on every viewport.
//
// Emojis are NOT part of the pin system anymore: they are plain note content.
// No data-emoji attribute is ever written by the pin pipeline.
//
// Placement contract: the star is stamped INSIDE the label's title <span>,
// which TabList.scss pins as `position: relative`. It adopts the exact slot
// the legacy `span::before { content: attr(data-emoji) }` occupied
// (absolute, vertically centered, 10px from the left edge) — so this module
// carries its own inline geometry and colour instead of depending on any
// stylesheet (the 0.5.9 layout CSS is intentionally untouched in this cycle).

export const PINNED_STAR_CLASS = "tn-pinned-star";

// Inline presentation: the legacy emoji slot + the Figma orange accent.
// `fill` must override the presentation attribute `fill="none"` below.
export const PINNED_STAR_STYLE =
  "position:absolute;left:10px;top:50%;transform:translate(-50%,-50%);" +
  "width:14px;height:14px;flex-shrink:0;pointer-events:none;" +
  "color:rgb(255,165,0);fill:rgb(255,165,0);";

export const PINNED_STAR_SVG =
  `<svg class="${PINNED_STAR_CLASS}" viewBox="0 0 24 24" fill="none" ` +
  `stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ` +
  `stroke-linejoin="round" aria-hidden="true" focusable="false" ` +
  `style="${PINNED_STAR_STYLE}"><path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"/></svg>`;

/**
 * Build a detached DOM node for the pinned star. Returns null only when the
 * runtime DOM is unavailable (defensive — unit-test mocks construct labels
 * without a document-backed parent).
 * @returns {SVGElement|null}
 */
export function createPinnedStar() {
  if (typeof document === "undefined") return null;
  const template = document.createElement("template");
  template.innerHTML = PINNED_STAR_SVG.trim();
  return template.content.firstElementChild;
}

/**
 * Remove every pinned-star descendant of the given element (unpin cleanup).
 * Safe to call on elements without stars or without querySelector support.
 * @param {Element|null} element
 */
export function removePinnedStars(element) {
  element?.querySelectorAll?.(`.${PINNED_STAR_CLASS}`)?.forEach((star) => star.remove());
}

/**
 * Stamp the native star onto a pinned tab's label, rebuilding it in place so
 * the label never accumulates duplicates (idempotent).
 * The star lives inside the title <span> (positioned ancestor); when a label
 * has no span (test doubles, degenerate markup) it falls back to the label.
 * @param {Element|null} label
 * @returns {SVGElement|null} the freshly stamped star
 */
export function stampPinnedStar(label) {
  if (!label) return null;
  const host = label.querySelector?.("span") ?? label;
  removePinnedStars(label);
  const star = createPinnedStar();
  // Optional-call: exotic hosts (unit-test doubles without DOM methods) must
  // never break the pin transaction itself.
  host.appendChild?.(star);
  return star;
}

/**
 * Reconcile the star population of a whole tab strip from the model:
 * every `.pinned` item owns exactly one star, every other item owns none.
 * This heals hydration paths (restoreTabs, createTabElement) and re-heals
 * labels whose star was destroyed by an in-place rename.
 * @param {Element|null} tabList
 * @returns {{stamped: number, cleaned: number}}
 */
export function syncPinnedStars(tabList) {
  const result = { stamped: 0, cleaned: 0 };
  if (!tabList?.querySelectorAll) return result;

  tabList.querySelectorAll(".tab-list__item").forEach((item) => {
    const label = item.querySelector("label");
    if (!label) return;
    const pinned = item.classList.contains("pinned");
    const stars = label.querySelectorAll(`.${PINNED_STAR_CLASS}`);

    if (pinned) {
      if (stars.length === 0) {
        stampPinnedStar(label);
        result.stamped += 1;
      } else if (stars.length > 1) {
        // Rebuild down to exactly one (also re-homes a star that drifted
        // from the title span into the label itself).
        stampPinnedStar(label);
        result.stamped += 1;
      } else if (!label.querySelector(`span .${PINNED_STAR_CLASS}`)) {
        stampPinnedStar(label);
        result.stamped += 1;
      }
    } else if (stars.length > 0) {
      removePinnedStars(label);
      result.cleaned += stars.length;
    }
  });

  return result;
}
