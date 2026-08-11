import { describe, it, expect, beforeEach, vi } from "vitest";
import { TabPinHandler } from "../tabPinHandler.js";

function makeTabElement({ pinned = false, name = "", storedEmoji = null } = {}) {
  const label = { setAttribute: vi.fn(), getAttribute: vi.fn(() => storedEmoji), removeAttribute: vi.fn() };
  const labelSpan = { setAttribute: vi.fn(), getAttribute: vi.fn(() => storedEmoji), textContent: name, removeAttribute: vi.fn() };
  return {
    classList: { contains: vi.fn(() => pinned), add: vi.fn(), remove: vi.fn() },
    querySelector: vi.fn((selector) => {
      if (selector === "label") return label;
      if (selector === "label span") return labelSpan;
      return null;
    }),
  };
}

describe("TabPinHandler", () => {
  let handler;
  let mockTabManager;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTabManager = {
      reorderTabs: vi.fn(),
      saveTabs: vi.fn(),
    };

    handler = new TabPinHandler(mockTabManager);

    document.dispatchEvent = vi.fn();
  });

  describe("pinTab", () => {
    it("should add pinned class and set data-emoji with an explicit emoji", () => {
      const tabElement = makeTabElement();

      handler.pinTab(tabElement, "🔴");

      expect(tabElement.classList.add).toHaveBeenCalledWith("pinned");
      expect(tabElement.querySelector("label").setAttribute).toHaveBeenCalledWith("data-emoji", "🔴");
      expect(tabElement.querySelector("label span").setAttribute).toHaveBeenCalledWith("data-emoji", "🔴");
    });

    it("should prefer an emoji typed in the tab name over a stored data-emoji", () => {
      const tabElement = makeTabElement({ name: "🚀 Proyecto", storedEmoji: "🌟" });

      handler.pinTab(tabElement);

      expect(tabElement.querySelector("label").setAttribute).toHaveBeenCalledWith("data-emoji", "🚀");
      expect(tabElement.querySelector("label span").setAttribute).toHaveBeenCalledWith("data-emoji", "🚀");
    });

    it("should use the existing data-emoji when the tab name has no emoji", () => {
      const tabElement = makeTabElement({ name: "Compras", storedEmoji: "🔵" });

      handler.pinTab(tabElement);

      expect(tabElement.querySelector("label").setAttribute).toHaveBeenCalledWith("data-emoji", "🔵");
    });

    it("should fall back to a random pin emoji when there is no emoji available", () => {
      const tabElement = makeTabElement({ name: "Compras" });

      handler.pinTab(tabElement);

      const label = tabElement.querySelector("label");
      expect(label.setAttribute).toHaveBeenCalled();
      const [, emoji] = label.setAttribute.mock.calls[0];
      expect(emoji).toEqual(expect.any(String));
      expect(emoji.length).toBeGreaterThan(0);
    });

    it("should call reorderTabs and saveTabs", () => {
      const tabElement = makeTabElement();

      handler.pinTab(tabElement, "📌");

      expect(mockTabManager.reorderTabs).toHaveBeenCalled();
      expect(mockTabManager.saveTabs).toHaveBeenCalled();
    });

    it("should not dispatch tabsChanged", () => {
      const tabElement = makeTabElement();

      handler.pinTab(tabElement, "📌");

      expect(document.dispatchEvent).not.toHaveBeenCalled();
    });
  });

  describe("unpinTab", () => {
    it("should remove the pinned class but keep data-emoji", () => {
      const tabElement = makeTabElement();

      handler.unpinTab(tabElement);

      expect(tabElement.classList.remove).toHaveBeenCalledWith("pinned");
      const label = tabElement.querySelector("label");
      const labelSpan = tabElement.querySelector("label span");
      expect(label.removeAttribute).not.toHaveBeenCalled();
      expect(labelSpan.removeAttribute).not.toHaveBeenCalled();
    });

    it("should call reorderTabs and saveTabs", () => {
      const tabElement = makeTabElement();

      handler.unpinTab(tabElement);

      expect(mockTabManager.reorderTabs).toHaveBeenCalled();
      expect(mockTabManager.saveTabs).toHaveBeenCalled();
    });

    it("should not dispatch tabsChanged", () => {
      const tabElement = makeTabElement();

      handler.unpinTab(tabElement);

      expect(document.dispatchEvent).not.toHaveBeenCalled();
    });
  });
});
