// src/features/top-bar/__tests__/mobileRowLayout.test.js
// Milestone 0.5.9.1 (Mobile Beta) — uniform row height distribution.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MobileRowLayout } from "../mobileRowLayout.js";

function installMatchMedia(matches) {
  const media = {
    matches,
    media: "",
    listeners: new Set(),
    addEventListener(type, callback) {
      if (type === "change") this.listeners.add(callback);
    },
    removeEventListener(type, callback) {
      this.listeners.delete(callback);
    },
    setMatches(value) {
      this.matches = value;
      [...this.listeners].forEach((callback) => callback({ matches: value }));
    },
  };
  window.matchMedia = vi.fn(() => media);
  return media;
}

function stubHeight(row, height) {
  row.getBoundingClientRect = () => ({
    height,
    width: 320,
    top: 0,
    left: 0,
    right: 320,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

function mountWorkspace(heights = [40, 62, 48]) {
  document.body.innerHTML = `<div class="tab-list tn-listView"></div>`;
  const list = document.querySelector(".tab-list");
  heights.forEach((height, index) => {
    const row = document.createElement("div");
    row.className = "tab-list__item";
    row.innerHTML = `<input type="radio" name="body-tab" id="body-tab-${index + 1}"><label><span>Note ${index + 1}</span></label>`;
    list.appendChild(row);
    stubHeight(row, height);
  });
  return list;
}

function minHeightOf(row) {
  return row.style.getPropertyValue("min-height");
}

function nextFrame() {
  return new Promise((resolve) =>
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame(resolve)
      : setTimeout(resolve, 16)
  );
}

describe("MobileRowLayout — uniform row heights in mobile list mode", () => {
  let layout;
  let media;

  beforeEach(async () => {
    document.body.innerHTML = "";
    media = installMatchMedia(true);
    mountWorkspace();
    layout = new MobileRowLayout({ debug: false });
    await layout.init();
  });

  afterEach(() => {
    layout?.destroy();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("stamps an identical min-height across every active row", () => {
    const rows = [...document.querySelectorAll(".tab-list__item")];
    const heights = rows.map(minHeightOf);

    expect(heights[0]).toBe("62px"); // tallest row wins
    expect(new Set(heights).size).toBe(1);
    expect(layout.lastHeight).toBe(62);
  });

  it("strips its own previous stamp before re-measuring (no ratcheting)", () => {
    const rows = [...document.querySelectorAll(".tab-list__item")];

    // The natural heights shrink (fewer wrapped lines after a rename)
    rows.forEach((row) => stubHeight(row, 30));
    const published = layout.apply();

    expect(published).toBe(30);
    expect(minHeightOf(rows[0])).toBe("30px");
    expect(minHeightOf(rows[1])).toBe("30px");
    expect(minHeightOf(rows[2])).toBe("30px");
  });

  it("excludes rows hidden by the live search filter", () => {
    const rows = [...document.querySelectorAll(".tab-list__item")];
    rows[1].style.setProperty("display", "none"); // filtered out

    const published = layout.apply();

    expect(published).toBe(48); // max of the VISIBLE rows (40, 48)
    expect(minHeightOf(rows[1])).toBe(""); // untouched — it is not active
  });

  it("returns null and stamps nothing when the box is unmeasurable", async () => {
    await layout.destroy();
    document.body.innerHTML = "";
    mountWorkspace([0, 0, 0]);
    const blind = new MobileRowLayout({ debug: false });
    await blind.init();

    expect(blind.lastHeight).toBeNull();
    const rows = [...document.querySelectorAll(".tab-list__item")];
    expect(rows.every((row) => minHeightOf(row) === "")).toBe(true);
    blind.destroy();
  });

  it("clears every stamp the moment the viewport reaches desktop", () => {
    expect(layout.lastHeight).toBe(62);

    media.setMatches(false); // ≥768px — desktop tab strip untouched

    const rows = [...document.querySelectorAll(".tab-list__item")];
    expect(rows.every((row) => minHeightOf(row) === "")).toBe(true);
    expect(layout.lastHeight).toBeNull();
  });

  it("skips grid mode (masonry keeps its organic rhythm)", async () => {
    document.querySelector(".tab-list").classList.add("tn-view-grid");

    expect(layout.apply()).toBeNull();
    const rows = [...document.querySelectorAll(".tab-list__item")];
    expect(rows.every((row) => minHeightOf(row) === "")).toBe(true);
  });

  it("re-applies on tabsChanged (rAF-coalesced)", async () => {
    const rows = [...document.querySelectorAll(".tab-list__item")];
    rows.forEach((row) => row.style.removeProperty("min-height"));

    document.dispatchEvent(new CustomEvent("tabsChanged"));
    await nextFrame();

    expect(minHeightOf(rows[0])).toBe("62px");
  });

  it("re-applies after the search filter changes the active set", async () => {
    const rows = [...document.querySelectorAll(".tab-list__item")];
    rows[0].style.setProperty("display", "none");

    document.dispatchEvent(new CustomEvent("tn-search-filtered"));
    await nextFrame();

    // rows[0] hidden → its stamp is irrelevant; visible rows are leveled
    expect(minHeightOf(rows[1])).toBe("62px");
    expect(minHeightOf(rows[2])).toBe("62px");
  });

  it("destroy() strips every stamp and unhooks its listeners", () => {
    layout.destroy();

    const rows = [...document.querySelectorAll(".tab-list__item")];
    expect(rows.every((row) => minHeightOf(row) === "")).toBe(true);

    document.dispatchEvent(new CustomEvent("tabsChanged"));
    expect(rows.every((row) => minHeightOf(row) === "")).toBe(true);
  });
});
