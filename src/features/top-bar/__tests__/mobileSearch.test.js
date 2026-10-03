// src/features/top-bar/__tests__/mobileSearch.test.js
// Milestone 0.5.9.1 (Mobile Beta) — live search engine + checkbox beta gate.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MobileSearch } from "../mobileSearch.js";

/** matchMedia double whose `matches` can be flipped at runtime. */
function installMatchMedia() {
  const media = {
    matches: false,
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
  window.matchMedia = vi.fn((query) => {
    media.media = query;
    return media;
  });
  return media;
}

function mountWorkspace() {
  document.body.innerHTML = `
    <div class="tn-searchMobile__header block md:hidden! w-full h-auto">
      <div class="tn-container">
        <div class="tn-container__searchBar">
          <input type="text" placeholder="Search Note" />
        </div>
        <div class="tn-container__buttons">
          <div class="button">
            <input type="checkbox" name="list" id="tn-MobileList" class="hidden" />
            <label for="list">list</label>
          </div>
          <div class="button">
            <input type="checkbox" name="grid" id="tn-MobileGrid" class="hidden" />
            <label for="grid">grid</label>
          </div>
        </div>
      </div>
    </div>
    <div class="tab-list tn-listView">
      <div class="tab-list__item"><input type="radio" name="body-tab" id="body-tab-1"><label for="body-tab-1"><span>Groceries</span></label></div>
      <div class="tab-list__item"><input type="radio" name="body-tab" id="body-tab-2"><label for="body-tab-2"><span>Vacation</span></label></div>
      <div class="tab-list__item"><input type="radio" name="body-tab" id="body-tab-3"><label for="body-tab-3"><span>Orphan</span></label></div>
    </div>`;

  window.tabManager = {
    tabsData: [
      { id: "body-tab-1", name: "Groceries", content: "<p>milk and <b>bread</b></p>" },
      { id: "body-tab-2", name: "Vacation", content: "<p>caribbean beach</p>" },
    ],
  };
}

function type(query) {
  const input = document.querySelector('.tn-container__searchBar input[type="text"]');
  input.value = query;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return input;
}

function rowStates() {
  return [...document.querySelectorAll(".tab-list__item")].map(
    (row) => row.style.display !== "none"
  );
}

describe("MobileSearch — live filtering against the internal layout collection", () => {
  let search;
  let media;

  beforeEach(async () => {
    document.body.innerHTML = "";
    mountWorkspace();
    media = installMatchMedia();
    search = new MobileSearch({ debug: false });
    await search.init();
  });

  afterEach(() => {
    search?.destroy();
    delete window.tabManager;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("binds the handwritten TopBarMobile input", () => {
    expect(search.initialized).toBe(true);
    expect(search.searchInput).not.toBeNull();
    expect(search.searchInput.getAttribute("placeholder")).toBe("Search Note");
  });

  it("degrades silently when the top bar markup is absent", async () => {
    document.body.innerHTML = '<div class="tab-list"></div>';
    const orphan = new MobileSearch({ debug: false });
    await orphan.init();
    expect(orphan.initialized).toBe(false);
    expect(orphan.searchInput).toBeNull();
  });

  it("matches by TITLE string and hides the non-matching rows", () => {
    const result = type("groceries");
    expect(result).toBeTruthy();
    expect(rowStates()).toEqual([true, false, false]);
    expect(search.getQuery()).toBe("groceries");
  });

  it("matches by PLAINTEXT BODY content (HTML stripped)", () => {
    type("milk and bread");
    expect(rowStates()).toEqual([true, false, false]);

    type("beach");
    expect(rowStates()).toEqual([false, true, false]);
  });

  it("is case-insensitive on both axes", () => {
    type("GROCERIES");
    expect(rowStates()).toEqual([true, false, false]);

    type("BEACH");
    expect(rowStates()).toEqual([false, true, false]);
  });

  it("restores every row when the query is cleared", () => {
    type("zzz-no-match");
    expect(rowStates()).toEqual([false, false, false]);

    type("");
    expect(rowStates()).toEqual([true, true, true]);
  });

  it("hides rows whose model entry is missing while a query is active", () => {
    // body-tab-3 has no tabsData entry — must never survive a live query
    type("groceries");
    const third = document.querySelectorAll(".tab-list__item")[2];
    expect(third.style.display).toBe("none");
  });

  it("Enter opens the best match and clears the filter (command-palette contract)", () => {
    const input = type("beach");
    const dispatched = vi.fn();
    document.addEventListener("tabsChanged", dispatched);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(document.getElementById("body-tab-2").checked).toBe(true);
    expect(dispatched).toHaveBeenCalled();
    expect(input.value).toBe("");
    expect(rowStates()).toEqual([true, true, true]);

    document.removeEventListener("tabsChanged", dispatched);
  });

  it("re-applies an active filter to rows created while filtering", () => {
    type("groceries");
    expect(rowStates()).toEqual([true, false, false]);

    // A new note appears (createTab path) — the filter must cover it too
    const list = document.querySelector(".tab-list");
    const fresh = document.createElement("div");
    fresh.className = "tab-list__item";
    fresh.innerHTML =
      '<input type="radio" name="body-tab" id="body-tab-9"><label for="body-tab-9"><span>Fresh</span></label>';
    list.appendChild(fresh);
    window.tabManager.tabsData.push({ id: "body-tab-9", name: "Bread recipes", content: "" });

    document.dispatchEvent(new CustomEvent("tabsChanged"));

    expect(fresh.style.display).toBe("none"); // "Bread recipes" does not contain "groceries"
  });

  it("emits tn-search-filtered so layout consumers can recompute", () => {
    const listener = vi.fn();
    document.addEventListener("tn-search-filtered", listener);
    type("groceries");
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ detail: expect.objectContaining({ query: "groceries" }) })
    );
    document.removeEventListener("tn-search-filtered", listener);
  });

  it("drops the filter the moment the viewport crosses into desktop", () => {
    type("groceries");
    expect(rowStates()).toEqual([true, false, false]);

    media.setMatches(true); // ≥768px: header is hidden by md:hidden!

    expect(rowStates()).toEqual([true, true, true]);
    expect(search.getQuery()).toBe("");
  });

  it("destroy() unhooks every listener", () => {
    search.destroy();
    type("groceries");
    expect(rowStates()).toEqual([true, true, true]);
  });
});

describe("MobileSearch — List/Grid checkbox beta gate", () => {
  let search;

  beforeEach(async () => {
    document.body.innerHTML = "";
    mountWorkspace();
    installMatchMedia();
    search = new MobileSearch({ debug: false });
    await search.init();
  });

  afterEach(() => {
    search?.destroy();
    delete window.tabManager;
    document.body.innerHTML = "";
  });

  it("removes the checkbox control group from the viewport", () => {
    const group = document.querySelector(".tn-container__buttons");
    expect(group).not.toBeNull();
    expect(group.hidden).toBe(true);
    expect(group.getAttribute("aria-hidden")).toBe("true");
    expect(group.getAttribute("data-tn-beta-gated")).toBe("checkbox-toggle");
  });

  it("makes both checkboxes inert (disabled, unchecked, untabbable)", () => {
    const boxes = [
      document.getElementById("tn-MobileList"),
      document.getElementById("tn-MobileGrid"),
    ];
    expect(boxes).toHaveLength(2);
    for (const box of boxes) {
      expect(box.disabled).toBe(true);
      expect(box.checked).toBe(false);
      expect(box.tabIndex).toBe(-1);
      expect(box.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("leaves ONLY the core search input visible and functional", () => {
    const input = document.querySelector('.tn-container__searchBar input[type="text"]');
    expect(input.closest(".tn-container__buttons")).toBeNull();
    expect(input.disabled).toBe(false);

    const result = type("groceries");
    expect(result).toBeTruthy();
    expect(search.getQuery()).toBe("groceries");
    expect(rowStates()).toEqual([true, false, false]);
  });

  it("re-gating is idempotent", () => {
    const first = search.gateViewToggles();
    const second = search.gateViewToggles();
    expect(first.disabled).toBe(2);
    expect(second.hidden).toBe(0); // already hidden — nothing left to hide
    expect(second.disabled).toBe(2);
  });
});
