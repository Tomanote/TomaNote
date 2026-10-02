// src/features/top-bar/__tests__/mobileNoteNav.test.js
// Milestone 0.5.9.1 (Mobile Beta) — the mobile-only "regresar" back control.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MobileNoteNav, REGRESAR_LABEL } from "../mobileNoteNav.js";

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

function mountWorkspace({ activeId = "body-tab-1", format = "markdown" } = {}) {
  document.body.innerHTML = `
    <main class="flex-1 relative">
      <div class="tab-list tn-listView">
        <div class="tab-list__item" ${format === "markdown" ? 'data-format="markdown"' : ""}>
          <input type="radio" name="body-tab" id="body-tab-1">
          <label for="body-tab-1"><span>Abierta</span></label>
          <div class="tab-list__item--content hidden">
            <div class="milkdown"></div>
          </div>
        </div>
        <div class="tab-list__item">
          <input type="radio" name="body-tab" id="body-tab-2">
          <label for="body-tab-2"><span>Cerrada</span></label>
          <div class="tab-list__item--content hidden"></div>
        </div>
      </div>
    </main>`;

  if (activeId) {
    const input = document.getElementById(activeId);
    if (input) input.checked = true;
  }
}

function backButton() {
  return document.querySelector("[data-tn-regresar]");
}

describe("MobileNoteNav — immersive back control", () => {
  let nav;
  let media;
  let tabManager;

  beforeEach(async () => {
    document.body.innerHTML = "";
    media = installMatchMedia(true);

    tabManager = {
      saveTabs: vi.fn(),
      updateContentHeight: vi.fn(),
      findTabById: vi.fn(() => ({ id: "body-tab-1", content: "viejo" })),
    };
    window.tabManager = tabManager;
    window.milkdownEditor = { getContent: vi.fn(() => "contenido guardado") };

    mountWorkspace();
    nav = new MobileNoteNav({ debug: false });
    await nav.init();
  });

  afterEach(() => {
    nav?.destroy();
    delete window.tabManager;
    delete window.milkdownEditor;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it('injects a control labelled exactly "regresar" on the open note', () => {
    const button = backButton();
    expect(button).not.toBeNull();
    expect(button.textContent).toBe(REGRESAR_LABEL);
    expect(button.textContent).toBe("regresar");
    expect(button.getAttribute("aria-label")).toBe("regresar");
  });

  it("lands in the TOP LEFT quadrant of the full-screen writing surface", () => {
    const button = backButton();
    expect(button.style.position).toBe("absolute");
    expect(button.style.top).toBe("8px");
    expect(button.style.left).toBe("8px");
    // it rides on the ACTIVE note row (same containing block as the pane)
    expect(button.closest(".tab-list__item").querySelector("input").id).toBe(
      "body-tab-1"
    );
  });

  it("is mobile-only: never injected above 768px", async () => {
    media.setMatches(false);
    expect(backButton()).toBeNull();

    media.setMatches(true);
    expect(backButton()).not.toBeNull();
  });

  it("stays a single instance across repeated tab transitions", () => {
    document.dispatchEvent(new CustomEvent("tabsChanged"));
    document.dispatchEvent(new CustomEvent("tabsChanged"));
    expect(document.querySelectorAll("[data-tn-regresar]")).toHaveLength(1);
  });

  it("disappears when no note is open", () => {
    document.getElementById("body-tab-1").checked = false;
    document.dispatchEvent(new CustomEvent("tabsChanged"));
    expect(backButton()).toBeNull();
  });

  describe("click → commit, persist, close, return (no reload)", () => {
    it("runs the full close transaction", () => {
      const urlBefore = window.location.href;
      const dispatched = vi.fn();
      document.addEventListener("tabsChanged", dispatched);

      backButton().click();

      // 1. editor flush + 2. core persistence
      expect(window.milkdownEditor.getContent).toHaveBeenCalledWith("body-tab-1");
      expect(tabManager.findTabById).toHaveBeenCalledWith("body-tab-1");
      expect(tabManager.saveTabs).toHaveBeenCalledTimes(1);
      // 3. workspace layer closed
      expect(document.getElementById("body-tab-1").checked).toBe(false);
      expect(dispatched).toHaveBeenCalled();
      // 4. back to the list, no page reload
      expect(tabManager.updateContentHeight).toHaveBeenCalled();
      expect(window.location.href).toBe(urlBefore);
      // the control removed itself with the tabsChanged dispatch
      expect(backButton()).toBeNull();

      document.removeEventListener("tabsChanged", dispatched);
    });

    it("commits live editor content into the model before persisting", () => {
      const modelTab = { id: "body-tab-1", content: "viejo" };
      tabManager.findTabById.mockReturnValue(modelTab);

      backButton().click();

      expect(modelTab.content).toBe("contenido guardado");
    });

    it("persists plain (non-markdown) notes through saveTabs too", async () => {
      await nav.destroy();
      document.body.innerHTML = "";
      mountWorkspace({ format: "text" });
      const plainNav = new MobileNoteNav({ debug: false });
      await plainNav.init();

      plainNav.goBack();

      expect(tabManager.saveTabs).toHaveBeenCalledTimes(1);
      expect(window.milkdownEditor.getContent).not.toHaveBeenCalled();
      plainNav.destroy();
    });

    it("goBack is a no-op without an open note", () => {
      nav.destroy();
      document.getElementById("body-tab-1").checked = false;
      const fresh = new MobileNoteNav({ debug: false });
      return fresh.init().then(() => {
        expect(fresh.goBack()).toBe(false);
        expect(tabManager.saveTabs).not.toHaveBeenCalled();
        fresh.destroy();
      });
    });
  });

  it("destroy() removes the injected control and its listeners", () => {
    nav.destroy();
    expect(backButton()).toBeNull();

    const countBefore = document.querySelectorAll("[data-tn-regresar]").length;
    document.dispatchEvent(new CustomEvent("tabsChanged"));
    expect(document.querySelectorAll("[data-tn-regresar]").length).toBe(countBefore);
  });
});
