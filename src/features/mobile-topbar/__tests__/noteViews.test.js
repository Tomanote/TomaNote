// src/features/mobile-topbar/__tests__/noteViews.test.js
// Milestone 0.5.9 Phase 3 — Figma-compliant dynamic note rendering.
// The controller re-decorates the EXISTING .tab-list__item DOM (100% reuse —
// no rebuild) on init and on every viewmode-changed / tabsChanged event.
// Pinned notes render as comprehensive full-width cards (tn-card--pinned)
// stacked at the top — never single-line chips.
// TDD: updated with the Phase 3 Figma contract.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NoteViews, SNIPPET_MAX_CHARS } from "../noteViews.js";
import { MobileTopbar } from "../mobileTopbar.js";
import { viewMode } from "../../../lib/scripts/core/viewMode.js";
import { TabPinHandler } from "../../../lib/scripts/core/tabPinHandler.js";

window.viewMode = viewMode;

function mount() {
  document.body.innerHTML = `
    <div class="tab-list flex flex-row" dir="ltr">
      <span id="tab-list-anchor" class="hidden"></span>
      <div class="group relative">
        <button id="create-tab">+</button>
      </div>
    </div>
  `;
}

/**
 * Build a realistic tab item replicating TabManager.createTabElement markup.
 */
function seedTab(id, name, content, { pinned = false, emoji = "📌" } = {}) {
  const item = document.createElement("div");
  item.className = "tab-list__item";
  item.dataset.format = "markdown";
  if (pinned) item.classList.add("pinned");
  item.innerHTML = `
    <input type="radio" name="body-tab" id="${id}">
    <label for="${id}" data-emoji="${emoji}"><span>${name}</span></label>
    <div class="tab-list__item--content"></div>
  `;
  document.querySelector(".tab-list").insertBefore(item, document.getElementById("tab-list-anchor"));
  return item;
}

function makeTabManager(tabs) {
  return {
    tabsData: tabs,
    getTabs: () => tabs,
    reorderTabs: vi.fn(),
    saveTabs: vi.fn(),
    findTabById: (id) => tabs.find((t) => t.id === id),
  };
}

describe("NoteViews (Phase 3 — Figma note rendering)", () => {
  let controller;
  let t1; // pinned note
  let t2; // long-content note
  let t3; // soon-untitled note
  let tabManager;

  beforeEach(() => {
    window.localStorage.clear();
    mount();

    t1 = seedTab("body-tab-1", "Pinned note", "pinned body", { pinned: true });
    t2 = seedTab("body-tab-2", "Long note", "");
    t3 = seedTab("body-tab-3", "Nueva", "first raw line\nsecond line");

    tabManager = makeTabManager([
      { id: "body-tab-1", name: "Pinned note", content: "pinned body", isPinned: true },
      { id: "body-tab-2", name: "Long note", content: "<p>".concat("word ".repeat(400), "</p>") },
      { id: "body-tab-3", name: "Nueva", content: "first raw line\nsecond line" },
    ]);
    window.tabManager = tabManager;
    window.viewMode = viewMode;

    const topbar = new MobileTopbar({ debug: false });
    topbar.init();

    controller = new NoteViews({ debug: false });
  });

  afterEach(() => {
    controller.destroy();
    delete window.tabManager;
    viewMode.destroy();
    viewMode.setMode("list");
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("init() decorates existing tab items with preview and heading wiring", () => {
    controller.init();

    expect(t2.querySelector(".tn-note-preview")).not.toBeNull();
    expect(t1.dataset.tnCardDecorated).toBe("1");
    expect(controller.pinnedStrip).toBeUndefined();
  });

  it("grid view: pinned tabs become full tn-card--pinned cards with star and heading (title only)", () => {
    viewMode.setMode("grid");
    controller.init();

    expect(t1.classList.contains("tn-card--pinned")).toBe(true);
    expect(t1.classList.contains("tn-card--normal")).toBe(false);

    // Native vector star — never a text emoji
    const star = t1.querySelector(".tn-pinned-star");
    expect(star).not.toBeNull();
    expect(star.tagName.toLowerCase()).toBe("svg");
    expect(t1.textContent).not.toContain("📌");

    // Heading keeps the REAL label span (rename flow intact)
    const heading = t1.querySelector(".tn-card-heading");
    expect(heading).not.toBeNull();
    expect(heading.querySelector("span")?.textContent).toBe("Pinned note");

    // Maintenance Fix #1.2: pinned cards render TITLE ONLY — no snippet body
    expect(t1.querySelector(".tn-note-preview")).toBeNull();
  });

  it("grid view: normal tabs get tn-card--normal and pinned stay outside that class", () => {
    viewMode.setMode("grid");
    controller.init();

    expect(t2.classList.contains("tn-card--normal")).toBe(true);
    expect(t2.classList.contains("tn-card--pinned")).toBe(false);
    expect(t1.classList.contains("tn-card--normal")).toBe(false);
  });

  it("list view: rows carry the tn-row strategy class (full-width + capped preview)", () => {
    viewMode.setMode("list");
    controller.init();

    expect(t2.classList.contains("tn-row")).toBe(true);
    expect(t2.classList.contains("tn-card")).toBe(false);
    expect(t2.classList.contains("tn-card--pinned")).toBe(false);
    expect(t2.classList.contains("tn-card--normal")).toBe(false);
    // Explicit threshold contract (visual max-height enforced in SCSS, asserted in E2E)
    expect(t2.dataset.tnPreviewLines).toBe("2");
  });

  it("grid view: items become cards (tn-card) and the container gets the grid hooks", () => {
    viewMode.setMode("grid");
    controller.init();

    expect(t2.classList.contains("tn-card")).toBe(true);
    expect(t2.classList.contains("tn-row")).toBe(false);
    const list = document.querySelector(".tab-list");
    expect(list.classList.contains("tn-view-grid")).toBe(true);
    expect(list.classList.contains("notes-grid-container")).toBe(true);
  });

  it("pinned heading lives first in DOM order (before every normal card)", () => {
    viewMode.setMode("grid");
    controller.init();

    const order = [...document.querySelectorAll(".tab-list .tab-list__item")].map((el) => el.className);
    const pinnedIdx = order.findIndex((c) => c.includes("tn-card--pinned"));
    const normalIdx = order.findIndex((c) => c.includes("tn-card--normal"));
    expect(pinnedIdx).toBeGreaterThanOrEqual(0);
    expect(pinnedIdx).toBeLessThan(normalIdx);
  });

  it("switching modes re-decorates items live (no reload) via viewmode-changed", () => {
    controller.init();
    expect(t2.classList.contains("tn-row")).toBe(true);

    viewMode.setMode("grid");
    expect(t2.classList.contains("tn-card--normal")).toBe(true);
    expect(t2.classList.contains("tn-row")).toBe(false);

    viewMode.setMode("list");
    expect(t2.classList.contains("tn-row")).toBe(true);
    expect(t2.classList.contains("tn-card")).toBe(false);
  });

  it("preview snippet strips HTML, is aria-hidden and capped at 200 chars (Figma)", () => {
    controller.init();

    const preview = t2.querySelector(".tn-note-preview");
    expect(preview.textContent.length).toBe(SNIPPET_MAX_CHARS);
    expect(preview.textContent).not.toContain("<p>");
    expect(preview.getAttribute("aria-hidden")).toBe("true");
    expect(SNIPPET_MAX_CHARS).toBe(200);
  });

  it("unpinning re-classes the card from pinned to normal (tabsChanged sync)", () => {
    viewMode.setMode("grid");
    controller.init();
    expect(t1.classList.contains("tn-card--pinned")).toBe(true);

    // Exactly what the app does: DOM class + tabsData flag + event
    t1.classList.remove("pinned");
    tabManager.tabsData.find((t) => t.id === "body-tab-1").isPinned = false;
    document.dispatchEvent(new Event("tabsChanged"));

    expect(t1.classList.contains("tn-card--pinned")).toBe(false);
    expect(t1.classList.contains("tn-card--normal")).toBe(true);

    // Pin t3 back
    t3.classList.add("pinned");
    tabManager.tabsData.find((t) => t.id === "body-tab-3").isPinned = true;
    document.dispatchEvent(new Event("tabsChanged"));

    expect(t3.classList.contains("tn-card--pinned")).toBe(true);
    expect(t3.querySelector(".tn-pinned-star")).not.toBeNull();
  });

  it("untitled pinned notes keep the real span intact (label wrapper safe)", () => {
    tabManager.tabsData.find((t) => t.id === "body-tab-3").name = "";
    t3.querySelector("label span").textContent = "";
    t3.classList.add("pinned");
    tabManager.tabsData.find((t) => t.id === "body-tab-3").isPinned = true;

    viewMode.setMode("grid");
    controller.init();

    const span = t3.querySelector("label .tn-card-heading span");
    expect(span).not.toBeNull();
    expect(span.parentElement.classList.contains("tn-card-heading")).toBe(true);
  });

  it("pinned card opens its note when the label is clicked (native radio flow)", () => {
    controller.init();
    const radio = t1.querySelector("input");

    t1.querySelector("label").click();

    expect(radio.checked).toBe(true);
  });

  it("star isolation: emojis in note content or title NEVER toggle pin status (Fix #1.1)", () => {
    viewMode.setMode("grid");
    controller.init();

    // Emoji-laden note stays a NORMAL card — decoration mirrors the `pinned`
    // class / tabsData.isPinned flag only, never note text.
    t2.querySelector("label span").textContent = "🚀 Lanzamiento 🎉";
    tabManager.tabsData.find((tab) => tab.id === "body-tab-2").content = "<p>Nota con 📌 emojis 🌟 por todos lados</p>";
    document.dispatchEvent(new Event("tabsChanged"));

    expect(t2.classList.contains("tn-card--pinned")).toBe(false);
    expect(t2.classList.contains("tn-card--normal")).toBe(true);
    expect(t2.querySelector(".tn-pinned-star")).toBeNull();

    // ...and a plain pin flag still produces the star card
    expect(t1.classList.contains("tn-card--pinned")).toBe(true);
    expect(t1.querySelector(".tn-pinned-star")).not.toBeNull();
  });

  it("pinned cards render TITLE ONLY — no content snippet body (Fix #1.2)", () => {
    viewMode.setMode("grid");
    controller.init();

    // Pinned note HAS body content...
    tabManager.tabsData.find((tab) => tab.id === "body-tab-1").content = "<p>Cuerpo que NO debe renderizarse en la pinned card</p>";
    document.dispatchEvent(new Event("tabsChanged"));

    // ...but the pinned card shows no .tn-note-preview at all
    expect(t1.querySelector(".tn-note-preview")).toBeNull();
    expect(t1.querySelector(".tn-card-heading span").textContent).toBe("Pinned note");

    // Normal cards keep their snippet
    expect(t2.querySelector(".tn-note-preview")).not.toBeNull();
  });

  it("legacy data-emoji pinned tabs still decorate as star cards (metadata migration)", () => {
    t1.querySelector("label").setAttribute("data-emoji", "📌");
    t1.querySelector("label span").setAttribute("data-emoji", "📌");

    viewMode.setMode("grid");
    controller.init();

    expect(t1.classList.contains("tn-card--pinned")).toBe(true);
    expect(t1.querySelector(".tn-pinned-star")).not.toBeNull();
  });

  it("destroy() disconnects observers and stops re-decorating", () => {
    controller.init();
    controller.destroy();

    const fresh = seedTab("body-tab-9", "Late", "");
    tabManager.tabsData.push({ id: "body-tab-9", name: "Late", content: "" });
    document.dispatchEvent(new Event("tabsChanged"));

    expect(fresh.dataset.tnCardDecorated).toBeUndefined();
  });
});

describe("NoteViews — card action strip (Fix #5 & #6)", () => {
  let controller;
  let t1;
  let tabManager;

  beforeEach(() => {
    window.localStorage.clear();
    mount();

    t1 = seedTab("body-tab-1", "Pinned note", "pinned body", { pinned: true });
    seedTab("body-tab-2", "Normal note", "");

    tabManager = makeTabManager([
      { id: "body-tab-1", name: "Pinned note", content: "pinned body", isPinned: true },
      { id: "body-tab-2", name: "Normal note", content: "" },
    ]);
    // The strip must route through the NATIVE pin pipeline (TabPinHandler),
    // so the mock manager delegates exactly like the real TabManager does.
    const pinHandler = new TabPinHandler(tabManager);
    tabManager.pinTab = (el) => pinHandler.pinTab(el);
    tabManager.unpinTab = (el) => pinHandler.unpinTab(el);
    window.tabManager = tabManager;
    window.viewMode = viewMode;

    const topbar = new MobileTopbar({ debug: false });
    topbar.init();

    controller = new NoteViews({ debug: false });
    controller.init();
  });

  afterEach(() => {
    controller.destroy();
    delete window.tabManager;
    viewMode.destroy();
    viewMode.setMode("list");
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("every card carries a 3-button semantic action strip (pin, edit, delete)", () => {
    for (const item of [t1, document.querySelectorAll(".tab-list__item")[1]]) {
      const strip = item.querySelector(".tn-card-actions");
      expect(strip).not.toBeNull();
      const actions = strip.querySelectorAll("button[data-card-action]");
      expect(actions).toHaveLength(3);
      expect([...actions].map((b) => b.dataset.cardAction).sort()).toEqual(["delete", "edit", "pin"]);
      for (const btn of actions) {
        expect(btn.getAttribute("aria-label")).toBeTruthy();
        expect(btn.querySelector("svg")).not.toBeNull();
      }
    }
  });

  it("pin button routes through tabPinHandler and reflects the new state", async () => {
    const normal = document.querySelectorAll(".tab-list__item")[1];
    const pinBtn = normal.querySelector("button[data-card-action='pin']");

    pinBtn.click();
    await Promise.resolve(); // deletion flow is async-safe; pin resolves sync

    expect(normal.classList.contains("pinned")).toBe(true);
    expect(tabManager.saveTabs).toHaveBeenCalled();
    // Star vector appeared (pin status) and strip still intact
    expect(normal.querySelector(".tn-pinned-star")).not.toBeNull();
  });

  it("edit button opens the mobile fullscreen editor modal", () => {
    // The controller integrates with the modal through its public contract
    // (window.editorModal.open) — implementation-agnostic by design.
    window.editorModal = { open: vi.fn() };

    t1.querySelector("button[data-card-action='edit']").click();

    expect(window.editorModal.open).toHaveBeenCalledWith(t1);
    delete window.editorModal;
  });

  it("delete button routes through the legacy deletion workflow", async () => {
    tabManager.deleteTabElement = vi.fn(async () => {});

    t1.querySelector("button[data-card-action='delete']").click();
    await Promise.resolve();
    await Promise.resolve();

    expect(tabManager.deleteTabElement).toHaveBeenCalledWith(t1);
  });
});

describe("NoteViews — masonry geometry tokens (Phase 3 Figma)", () => {
  let controller;
  let tabManager;

  beforeEach(() => {
    window.localStorage.clear();
    mount();

    seedTab("body-tab-1", "Pinned note", "pinned body", { pinned: true });
    seedTab("body-tab-2", "Normal note", "");

    tabManager = makeTabManager([
      { id: "body-tab-1", name: "Pinned note", content: "pinned body", isPinned: true },
      { id: "body-tab-2", name: "Normal note", content: "" },
    ]);
    window.tabManager = tabManager;
    window.viewMode = viewMode;

    const topbar = new MobileTopbar({ debug: false });
    topbar.init();

    controller = new NoteViews({ debug: false });
    controller.init();
  });

  afterEach(() => {
    controller.destroy();
    delete window.tabManager;
    viewMode.destroy();
    viewMode.setMode("list");
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("publishCardWidth() derives (clientWidth − lateral padding − gap) / 2", () => {
    const list = document.querySelector(".tab-list");
    list.style.paddingLeft = "8px";
    list.style.paddingRight = "8px";
    list.style.columnGap = "16px";
    Object.defineProperty(list, "clientWidth", { configurable: true, value: 400 });

    controller.publishCardWidth();

    // (400 − 8 − 8 − 16) / 2 = 184 → the Figma column width
    expect(list.style.getPropertyValue("--tn-card-width")).toBe("184px");
  });

  it("decorator skips unmeasurable boxes instead of publishing NaN tokens", () => {
    const list = document.querySelector(".tab-list");
    // jsdom has no layout engine: clientWidth stays 0
    controller.publishCardWidth();

    expect(list.style.getPropertyValue("--tn-card-width")).toBe("");
  });

  it("destroy() disconnects the card-width ResizeObserver", () => {
    const disconnect = vi.fn();
    const observe = vi.fn();
    const OriginalResizeObserver = global.ResizeObserver;
    class FakeResizeObserver {
      constructor(callback) {
        this.callback = callback;
      }
      observe = observe;
      disconnect = disconnect;
    }
    global.ResizeObserver = FakeResizeObserver;
    try {
      const c2 = new NoteViews({ debug: false });
      c2.init();
      expect(observe).toHaveBeenCalledWith(document.querySelector(".tab-list"));

      c2.destroy();
      expect(disconnect).toHaveBeenCalled();
    } finally {
      global.ResizeObserver = OriginalResizeObserver;
    }
  });
});
