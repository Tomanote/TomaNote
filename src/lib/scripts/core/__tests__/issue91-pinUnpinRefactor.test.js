// src/lib/scripts/core/__tests__/issue91-pinUnpinRefactor.test.js
// Issue #91 — Consolidated pin/unpin logic (UPDATED for the 0.5.9.1
// decoupling): TabPinHandler remains the single source of truth, but the
// resolution chain is now STAR-ONLY — no emoji detection, storage or
// fallback exists anywhere in the pin pipeline.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TabPinHandler } from "../tabPinHandler.js";

function makeTabElement({ pinned = false, name = "", storedEmoji = null } = {}) {
  const label = {
    setAttribute: vi.fn(),
    getAttribute: vi.fn(() => storedEmoji),
    removeAttribute: vi.fn(),
    appendChild: vi.fn(),
    contains: vi.fn(() => false),
  };
  const labelSpan = {
    setAttribute: vi.fn(),
    getAttribute: vi.fn(() => storedEmoji),
    textContent: name,
    removeAttribute: vi.fn(),
  };
  return {
    classList: {
      contains: vi.fn(() => pinned),
      add: vi.fn(),
      remove: vi.fn(),
    },
    querySelector: vi.fn((sel) => {
      if (sel === "label") return label;
      if (sel === "label span") return labelSpan;
      return null;
    }),
  };
}

describe("Issue #91 — Pin/Unpin Logic Audit (star-only pipeline)", () => {
  let handler;
  let mockTabManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTabManager = {
      reorderTabs: vi.fn(),
      saveTabs: vi.fn(),
    };
    handler = new TabPinHandler(mockTabManager);
  });

  describe("TabPinHandler.pinTab behavior", () => {
    it("adds 'pinned' class to tab element", () => {
      const tab = makeTabElement();
      handler.pinTab(tab);
      expect(tab.classList.add).toHaveBeenCalledWith("pinned");
    });

    it("injects the native star into the label (no data-emoji writes)", () => {
      const tab = makeTabElement();
      handler.pinTab(tab);
      const label = tab.querySelector("label");
      expect(label.appendChild).toHaveBeenCalled();
      expect(label.setAttribute).not.toHaveBeenCalled();
    });

    it("calls reorderTabs after pinning", () => {
      const tab = makeTabElement();
      handler.pinTab(tab);
      expect(mockTabManager.reorderTabs).toHaveBeenCalled();
    });

    it("calls saveTabs after pinning", () => {
      const tab = makeTabElement();
      handler.pinTab(tab);
      expect(mockTabManager.saveTabs).toHaveBeenCalled();
    });

    it("does NOT dispatch tabsChanged event", () => {
      const dispatchSpy = vi.spyOn(document, "dispatchEvent");
      const tab = makeTabElement();
      handler.pinTab(tab);
      expect(dispatchSpy).not.toHaveBeenCalled();
    });
  });

  describe("TabPinHandler.unpinTab behavior", () => {
    it("removes 'pinned' class from tab element", () => {
      const tab = makeTabElement({ pinned: true });
      handler.unpinTab(tab);
      expect(tab.classList.remove).toHaveBeenCalledWith("pinned");
    });

    it("clears data-emoji attributes (legacy cleanup, star replaces emoji)", () => {
      const tab = makeTabElement({ pinned: true, storedEmoji: "🔴" });
      handler.unpinTab(tab);
      const label = tab.querySelector("label");
      const labelSpan = tab.querySelector("label span");
      expect(label.removeAttribute).toHaveBeenCalledWith("data-emoji");
      expect(labelSpan.removeAttribute).toHaveBeenCalledWith("data-emoji");
    });

    it("calls reorderTabs after unpinning", () => {
      const tab = makeTabElement({ pinned: true });
      handler.unpinTab(tab);
      expect(mockTabManager.reorderTabs).toHaveBeenCalled();
    });

    it("calls saveTabs after unpinning", () => {
      const tab = makeTabElement({ pinned: true });
      handler.unpinTab(tab);
      expect(mockTabManager.saveTabs).toHaveBeenCalled();
    });
  });

  describe("Unified architecture — FloatingMenu delegates to TabPinHandler via TabManager", () => {
    it("TabPinHandler resolves the pin anchor from the STAR, never from text", () => {
      const tab1 = makeTabElement({ name: "No emoji here", storedEmoji: "🔵" });
      handler.pinTab(tab1);
      const label = tab1.querySelector("label");
      expect(label.appendChild).toHaveBeenCalled();
      expect(label.setAttribute).not.toHaveBeenCalled();
    });

    it("FloatingMenu has no pinTab/unpinTab methods of its own", () => {
      // Verify by reading the source file (kept from the original audit)
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(
        path.resolve(__dirname, "../../ui/floatingMenu.js"),
        "utf-8"
      );

      const hasPinTabMethod = /\bpinned?Tab\s*\(/.test(
        src.replace(/handlePinTab/g, "")
      );
      expect(hasPinTabMethod).toBe(false);

      expect(src).toContain("window.tabManager");
      expect(src).toContain("handlePinTab");
    });

    it("the emoji resolution chain (param → detect → stored → random) is GONE", () => {
      // The old chain used all four sources; now even an explicit emoji
      // argument produces zero attribute writes.
      const tab = makeTabElement({ name: "🚀 Lanzamiento", storedEmoji: "🌟" });
      handler.pinTab(tab, "🟠");

      expect(tab.querySelector("label").setAttribute).not.toHaveBeenCalled();
    });
  });

  describe("Centralization validation", () => {
    it("TabPinHandler is a separate class that remains the single source of truth", () => {
      expect(handler).toBeInstanceOf(TabPinHandler);
      expect(typeof handler.pinTab).toBe("function");
      expect(typeof handler.unpinTab).toBe("function");
    });

    it("TabPinHandler requires a tabManager reference", () => {
      expect(handler.tabManager).toBe(mockTabManager);
    });

    it("TabPinHandler calls saveTabs and reorderTabs (centralized persistence)", () => {
      const tab = makeTabElement();
      handler.pinTab(tab);
      expect(mockTabManager.saveTabs).toHaveBeenCalledTimes(1);
      expect(mockTabManager.reorderTabs).toHaveBeenCalledTimes(1);
    });
  });
});
