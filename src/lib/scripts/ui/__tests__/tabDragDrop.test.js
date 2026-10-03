import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TabDragDrop } from "../tabDragDrop.js";

vi.mock("sortablejs", () => ({
  default: vi.fn().mockImplementation(() => ({
    option: vi.fn(),
    destroy: vi.fn(),
  })),
}));

describe("TabDragDrop", () => {
  let tabDragDrop;
  let mockTabList;
  let dispatchEventSpy;
  let addEventListenerSpy;

  beforeEach(() => {
    addEventListenerSpy = vi.spyOn(document, "addEventListener");
    dispatchEventSpy = vi.fn();

    global.CustomEvent = class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    };

    global.window = {
      tabManager: {
        saveTabs: vi.fn(),
      },
    };

    mockTabList = {
      style: {},
      querySelectorAll: vi.fn().mockReturnValue([]),
      querySelector: vi.fn().mockReturnValue(null),
      insertBefore: vi.fn(),
      appendChild: vi.fn(),
    };

    global.document = {
      querySelector: vi.fn().mockReturnValue(mockTabList),
      getElementById: vi.fn(),
      addEventListener: addEventListenerSpy,
      dispatchEvent: dispatchEventSpy,
    };

    tabDragDrop = new TabDragDrop({ debug: false });
    tabDragDrop.tabList = mockTabList;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("It must initialize with default options", () => {
      const tdd = new TabDragDrop();
      expect(tdd.options.debug).toBe(true);
    });

    it("You must merge custom options", () => {
      const tdd = new TabDragDrop({ debug: false });
      expect(tdd.options.debug).toBe(false);
    });
  });

  describe("getSortableOptions", () => {
    it("must return Sortable options with callbacks", () => {
      const options = tabDragDrop.getSortableOptions();

      expect(options).toHaveProperty("animation");
      expect(options).toHaveProperty("ghostClass");
      expect(options).toHaveProperty("dragClass");
      expect(options).toHaveProperty("onStart");
      expect(options).toHaveProperty("onEnd");
    });
  });

  describe("handleDragStart", () => {
    it("must return Sortable options with callbacks", () => {
      const mockItem = {
        classList: { add: vi.fn() },
        querySelector: vi.fn().mockReturnValue(null),
      };

      tabDragDrop.handleDragStart({ item: mockItem });

      expect(mockItem.classList.add).toHaveBeenCalledWith("dragging");
    });

    it("You need to add the dragging-content class to the content.", () => {
      const mockContent = { classList: { add: vi.fn() } };
      const mockItem = {
        classList: { add: vi.fn() },
        querySelector: vi.fn().mockReturnValue(mockContent),
      };

      tabDragDrop.handleDragStart({ item: mockItem });

      expect(mockContent.classList.add).toHaveBeenCalledWith("dragging-content");
    });
  });

  describe("handleDragEnd", () => {
    it("You must remove the dragging class from the item.", () => {
      const mockItem = {
        classList: { remove: vi.fn() },
        querySelector: vi.fn().mockReturnValue(null),
      };

      tabDragDrop.handleDragEnd({ item: mockItem });

      expect(mockItem.classList.remove).toHaveBeenCalledWith("dragging");
    });

    it("should remove dragging-content class from content", () => {
      const mockContent = { classList: { remove: vi.fn() } };
      const mockItem = {
        classList: { remove: vi.fn() },
        querySelector: vi.fn().mockReturnValue(mockContent),
      };

      tabDragDrop.handleDragEnd({ item: mockItem });

      expect(mockContent.classList.remove).toHaveBeenCalledWith("dragging-content");
    });

    it("You must call saveTabs from tabManager", () => {
      const mockItem = {
        classList: { remove: vi.fn() },
        querySelector: vi.fn().mockReturnValue(null),
      };

      tabDragDrop.handleDragEnd({ item: mockItem });

      expect(global.window.tabManager.saveTabs).toHaveBeenCalled();
    });

    it("must dispatch the tabsChanged event upon completion of drag", () => {
      const mockItem = {
        classList: { remove: vi.fn() },
        querySelector: vi.fn().mockReturnValue(null),
      };

      tabDragDrop.handleDragEnd({ item: mockItem });

      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "tabsChanged",
        })
      );
    });
  });

  describe("canPull", () => {
    it("It should allow moving unfixed tabs", () => {
      const mockItem = { classList: { contains: vi.fn().mockReturnValue(false) } };
      const mockTo = { el: mockTabList };

      const result = tabDragDrop.canPull(mockTo, {}, mockItem);

      expect(result).toBe(true);
    });

    it("It should allow moving tabs that are not pinned to pinned tabs.", () => {
      const mockItem = { classList: { contains: vi.fn().mockReturnValue(false) } };
      const mockTo = { el: { classList: { contains: vi.fn().mockReturnValue(true) } } };

      const result = tabDragDrop.canPull(mockTo, {}, mockItem);

      expect(result).toBe(false);
    });
  });

  describe("canPut", () => {
    it("Allows tabs to be received by the main tabList", () => {
      const mockItem = { classList: { contains: vi.fn().mockReturnValue(false) } };
      const mockTo = { el: mockTabList };

      const result = tabDragDrop.canPut(mockTo, {}, mockItem);

      expect(result).toBe(true);
    });

    it("Allows pinned tabs to be received by pinned-tabs", () => {
      const mockItem = { classList: { contains: vi.fn().mockReturnValue(true) } };
      const mockTo = { el: { classList: { contains: vi.fn().mockReturnValue(true) } } };

      const result = tabDragDrop.canPut(mockTo, {}, mockItem);

      expect(result).toBe(true);
    });

    it("Rejects non-pinned tabs in pinned-tabs", () => {
      const mockItem = { classList: { contains: vi.fn().mockReturnValue(false) } };
      const mockTo = { el: { classList: { contains: vi.fn().mockReturnValue(true) } } };

      const result = tabDragDrop.canPut(mockTo, {}, mockItem);

      expect(result).toBe(false);
    });
  });

  describe("handleMove", () => {
    it("Returns true to allow the move", () => {
      const result = tabDragDrop.handleMove({});
      expect(result).toBe(true);
    });
  });

  describe("reorderPinnedAndNormal", () => {
    it("Separates pinned and regular tabs, reinserts with anchor", () => {
      const pinnedTab = { classList: { contains: (c) => c === "pinned" }, remove: vi.fn() };
      const normalTab = { classList: { contains: () => false }, remove: vi.fn() };
      mockTabList.querySelectorAll = vi.fn(() => [normalTab, pinnedTab]);
      const mockAnchor = { id: "tab-list-anchor" };
      mockTabList.querySelector = vi.fn(() => mockAnchor);
      mockTabList.contains = vi.fn(() => true);

      tabDragDrop.reorderPinnedAndNormal();

      expect(pinnedTab.remove).toHaveBeenCalled();
      expect(normalTab.remove).toHaveBeenCalled();
      expect(mockTabList.insertBefore).toHaveBeenCalledTimes(2);
      expect(mockTabList.insertBefore.mock.calls[0][0]).toBe(pinnedTab);
      expect(mockTabList.insertBefore.mock.calls[1][0]).toBe(normalTab);
    });

    it("Falls back to appendChild when there is no reference", () => {
      const pinnedTab = { classList: { contains: (c) => c === "pinned" }, remove: vi.fn() };
      const normalTab = { classList: { contains: () => false }, remove: vi.fn() };
      mockTabList.querySelectorAll = vi.fn(() => [pinnedTab, normalTab]);
      mockTabList.querySelector = vi.fn(() => null);

      tabDragDrop.reorderPinnedAndNormal();

      expect(mockTabList.appendChild).toHaveBeenCalledTimes(2);
    });
  });
});
