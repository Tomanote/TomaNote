import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SaveIndicator } from "../save-indicator.js";

describe("SaveIndicator", () => {
  let saveIndicator;
  let mockElement;
  let listeners;

  function makeActiveTabMock(hasTab) {
    document.querySelector = vi.fn((selector) => {
      if (selector === '.tab-list input[type="radio"]:checked') {
        return hasTab ? { checked: true } : null;
      }
      return null;
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();

    listeners = {};
    mockElement = {
      classList: { add: vi.fn(), remove: vi.fn() },
    };

    document.getElementById = vi.fn((id) => {
      if (id === "save-indicator") return mockElement;
      return null;
    });
    document.addEventListener = vi.fn((event, handler) => {
      listeners[event] = handler;
    });
    document.removeEventListener = vi.fn();

    makeActiveTabMock(true);

    saveIndicator = new SaveIndicator({ debug: false });
    saveIndicator.element = mockElement;
    saveIndicator.setupListeners();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("init", () => {
    it("should return this when the element does not exist", async () => {
      document.getElementById = vi.fn().mockReturnValue(null);
      document.addEventListener.mockClear();
      saveIndicator.element = null;
      const result = await saveIndicator.init();
      expect(result).toBe(saveIndicator);
      expect(document.addEventListener).not.toHaveBeenCalled();
    });

    it("should set up listeners when the element exists", async () => {
      const result = await saveIndicator.init();
      expect(result).toBe(saveIndicator);
      expect(document.addEventListener).toHaveBeenCalledWith("input", expect.any(Function), true);
      expect(document.addEventListener).toHaveBeenCalledWith("tabsChanged", expect.any(Function));
    });
  });

  describe("schedule", () => {
    it("should show the indicator after the debounce delay", () => {
      saveIndicator.schedule();
      expect(mockElement.classList.add).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);

      expect(mockElement.classList.add).toHaveBeenCalledWith("is-visible");
    });

    it("should reset the debounce timer on repeated input", () => {
      saveIndicator.schedule();
      vi.advanceTimersByTime(3000);
      saveIndicator.schedule();
      vi.advanceTimersByTime(3000);

      expect(mockElement.classList.add).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2000);

      expect(mockElement.classList.add).toHaveBeenCalledWith("is-visible");
    });

    it("should not show the indicator when there is no active tab", () => {
      makeActiveTabMock(false);

      saveIndicator.schedule();
      vi.advanceTimersByTime(5000);

      expect(mockElement.classList.add).not.toHaveBeenCalled();
    });
  });

  describe("trigger", () => {
    it("should show the indicator immediately", () => {
      saveIndicator.trigger();

      expect(mockElement.classList.add).toHaveBeenCalledWith("is-visible");
    });

    it("should cancel a pending debounce", () => {
      saveIndicator.schedule();
      saveIndicator.trigger();
      vi.advanceTimersByTime(5000);

      expect(mockElement.classList.add).toHaveBeenCalledTimes(1);
    });

    it("should do nothing when there is no active tab", () => {
      makeActiveTabMock(false);

      saveIndicator.trigger();

      expect(mockElement.classList.add).not.toHaveBeenCalled();
    });
  });

  describe("show / hide", () => {
    it("should hide the indicator after the visible delay", () => {
      saveIndicator.show();
      vi.advanceTimersByTime(1500);

      expect(mockElement.classList.remove).toHaveBeenCalledWith("is-visible");
    });

    it("should extend the visible time if show is called again", () => {
      saveIndicator.show();
      vi.advanceTimersByTime(1000);
      saveIndicator.show();
      vi.advanceTimersByTime(1000);

      expect(mockElement.classList.remove).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);

      expect(mockElement.classList.remove).toHaveBeenCalledWith("is-visible");
    });

    it("should do nothing when the element is missing", () => {
      saveIndicator.element = null;
      saveIndicator.show();
      expect(mockElement.classList.add).not.toHaveBeenCalled();
    });
  });

  describe("input listener", () => {
    it("should schedule on input in a content area", () => {
      const handler = listeners["input"];
      const spy = vi.spyOn(saveIndicator, "schedule");

      handler({ target: { classList: { contains: vi.fn().mockReturnValue(true) } } });

      expect(spy).toHaveBeenCalled();
    });

    it("should ignore input outside content areas", () => {
      const handler = listeners["input"];
      const spy = vi.spyOn(saveIndicator, "schedule");

      handler({ target: { classList: { contains: vi.fn().mockReturnValue(false) } } });

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("tabsChanged listener", () => {
    it("should hide and cancel when there is no active tab", () => {
      makeActiveTabMock(false);
      const handler = listeners["tabsChanged"];
      const spy = vi.spyOn(saveIndicator, "cancel");

      handler();

      expect(spy).toHaveBeenCalled();
      expect(mockElement.classList.remove).toHaveBeenCalledWith("is-visible");
    });

    it("should do nothing when there is an active tab", () => {
      makeActiveTabMock(true);
      const handler = listeners["tabsChanged"];
      const spy = vi.spyOn(saveIndicator, "cancel");

      handler();

      expect(spy).not.toHaveBeenCalled();
      expect(mockElement.classList.remove).not.toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    it("should remove event listeners and clear timers", () => {
      const inputHandler = vi.fn();
      const tabsChangedHandler = vi.fn();
      saveIndicator.boundInputHandler = inputHandler;
      saveIndicator.boundTabsChangedHandler = tabsChangedHandler;

      saveIndicator.destroy();

      expect(document.removeEventListener).toHaveBeenCalledWith("input", inputHandler, true);
      expect(document.removeEventListener).toHaveBeenCalledWith("tabsChanged", tabsChangedHandler);
      expect(saveIndicator.boundInputHandler).toBeNull();
      expect(saveIndicator.boundTabsChangedHandler).toBeNull();
    });
  });
});
