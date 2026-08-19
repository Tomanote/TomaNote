import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FloatingMenu } from "../floating-menu.js";

describe("FloatingMenu", () => {
  let floatingMenu;
  let mockFloatingMenu;
  let mockTabList;
  let mockToolsButton;

  beforeEach(() => {
    mockToolsButton = {
      classList: { add: vi.fn(), remove: vi.fn() },
      style: {},
    };

    mockFloatingMenu = {
      addEventListener: vi.fn(),
      querySelector: vi.fn().mockReturnValue(null),
      querySelectorAll: vi.fn().mockReturnValue([]),
    };

    mockTabList = {
      addEventListener: vi.fn(),
      querySelector: vi.fn(),
    };

    global.document = {
      querySelector: vi.fn().mockImplementation((selector) => {
        if (selector === ".tn-navbar") return mockFloatingMenu;
        if (selector === ".tab-list") return mockTabList;
        return null;
      }),
      querySelectorAll: vi.fn().mockReturnValue([]),
      getElementById: vi.fn().mockReturnValue(mockToolsButton),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      createElement: vi.fn((tag) => ({
        tagName: tag.toUpperCase(),
        dataset: {},
        style: {},
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
          contains: vi.fn(),
        },
        appendChild: vi.fn(),
        remove: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        querySelector: vi.fn(),
        querySelectorAll: vi.fn().mockReturnValue([]),
        closest: vi.fn(),
        focus: vi.fn(),
        scrollIntoView: vi.fn(),
        getBoundingClientRect: vi.fn().mockReturnValue({ width: 100, height: 50, left: 0, top: 0 }),
        setAttribute: vi.fn(),
        getAttribute: vi.fn(),
        removeAttribute: vi.fn(),
        className: "",
      })),
    };

    global.CustomEvent = class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    };

    floatingMenu = new FloatingMenu({ debug: false });
    floatingMenu.floatingMenu = mockFloatingMenu;
    floatingMenu.tabList = mockTabList;
    floatingMenu.toolsButton = mockToolsButton;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("updateButtonStates", () => {
    it("The toolsButton should be displayed when a tab is active.", () => {
      mockTabList.querySelector = vi.fn().mockReturnValue({
        closest: vi.fn().mockReturnValue({}),
      });

      floatingMenu.updateButtonStates();

      expect(mockToolsButton.classList.remove).toHaveBeenCalledWith("tn-tools-hidden");
      expect(mockToolsButton.style.display).toBe("");
    });

    it("You should hide the toolsButton when there is no active tab.", () => {
      mockTabList.querySelector = vi.fn().mockReturnValue(null);

      floatingMenu.updateButtonStates();

      expect(mockToolsButton.classList.add).toHaveBeenCalledWith("tn-tools-hidden");
      expect(mockToolsButton.style.display).toBe("none");
    });

    it("should disable tab action buttons when there is no active tab", () => {
      const mockBtn = {
        classList: { add: vi.fn(), remove: vi.fn() },
        setAttribute: vi.fn(),
        removeAttribute: vi.fn(),
      };

      mockFloatingMenu.querySelectorAll = vi.fn().mockReturnValue([mockBtn]);
      mockTabList.querySelector = vi.fn().mockReturnValue(null);

      floatingMenu.updateButtonStates();

      expect(mockBtn.classList.add).toHaveBeenCalledWith("disabled");
      expect(mockBtn.setAttribute).toHaveBeenCalledWith("disabled", "true");
    });

    it("must be enable tab action buttons when a tab is active", () => {
      const mockBtn = {
        classList: { add: vi.fn(), remove: vi.fn() },
        setAttribute: vi.fn(),
        removeAttribute: vi.fn(),
      };

      mockFloatingMenu.querySelectorAll = vi.fn().mockReturnValue([mockBtn]);
      mockTabList.querySelector = vi.fn().mockReturnValue({
        closest: vi.fn().mockReturnValue({}),
      });

      floatingMenu.updateButtonStates();

      expect(mockBtn.classList.remove).toHaveBeenCalledWith("disabled");
      expect(mockBtn.removeAttribute).toHaveBeenCalledWith("disabled");
    });
  });

  describe("getActiveTab", () => {
    it("must return null if there is no tabList", () => {
      floatingMenu.tabList = null;
      expect(floatingMenu.getActiveTab()).toBeNull();
    });

    it("should return null if no radio is selected", () => {
      mockTabList.querySelector = vi.fn().mockReturnValue(null);
      expect(floatingMenu.getActiveTab()).toBeNull();
    });
  });

  describe("setupTabChangeListener", () => {
    it("You need to add a listener for tab switching.", () => {
      floatingMenu.setupTabChangeListener();

      expect(mockTabList.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });

    it("Need to add a listener for the tabsChanged event", () => {
      floatingMenu.setupTabChangeListener();

      expect(global.document.addEventListener).toHaveBeenCalledWith("tabsChanged", expect.any(Function));
    });
  });

  describe("handleDeleteTab", () => {
    it("You must call deleteTabElement from tabManager", () => {
      const mockTabElement = {};

      global.window = {
        tabManager: {
          deleteTabElement: vi.fn(),
        },
      };

      floatingMenu.handleDeleteTab(mockTabElement);

      expect(global.window.tabManager.deleteTabElement).toHaveBeenCalledWith(mockTabElement);
    });

    it("should not be call deleteTabElement if tabManager is unavailable", () => {
      const mockTabElement = {};

      global.window = {};

      floatingMenu.handleDeleteTab(mockTabElement);
    });
  });

  describe("handlePinTab", () => {
    it("should delegate pinning to window.tabManager.pinTab when the tab is not pinned", () => {
      const mockTabElement = {
        classList: { contains: vi.fn().mockReturnValue(false) },
      };

      global.window = {
        tabManager: {
          pinTab: vi.fn(),
          unpinTab: vi.fn(),
        },
      };

      floatingMenu.handlePinTab(mockTabElement);

      expect(global.window.tabManager.pinTab).toHaveBeenCalledWith(mockTabElement);
      expect(global.window.tabManager.unpinTab).not.toHaveBeenCalled();
    });

    it("should delegate unpinning to window.tabManager.unpinTab when the tab is pinned", () => {
      const mockTabElement = {
        classList: { contains: vi.fn().mockReturnValue(true) },
      };

      global.window = {
        tabManager: {
          pinTab: vi.fn(),
          unpinTab: vi.fn(),
        },
      };

      floatingMenu.handlePinTab(mockTabElement);

      expect(global.window.tabManager.unpinTab).toHaveBeenCalledWith(mockTabElement);
      expect(global.window.tabManager.pinTab).not.toHaveBeenCalled();
    });

    it("should not fail if tabManager is unavailable", () => {
      const mockTabElement = {
        classList: { contains: vi.fn().mockReturnValue(false) },
      };

      global.window = {};

      expect(() => floatingMenu.handlePinTab(mockTabElement)).not.toThrow();
    });
  });

  describe("setupButtonHandlers", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("Need to add a click listener to the floatingMenu", () => {
      floatingMenu.setupButtonHandlers();

      expect(mockFloatingMenu.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
    });

    it("Need to add a mousedown listener to the floatingMenu", () => {
      floatingMenu.setupButtonHandlers();

      expect(mockFloatingMenu.addEventListener).toHaveBeenCalledWith("mousedown", expect.any(Function));
    });
  });

  describe("handleEditNameTab", () => {
    it("Must be call startEditingTabName from the tabManager", () => {
      const mockEditButton = {};
      const mockTabElement = {
        querySelector: vi.fn().mockReturnValue(mockEditButton),
      };

      global.window = {
        tabManager: {
          startEditingTabName: vi.fn(),
        },
      };

      floatingMenu.handleEditNameTab(mockTabElement);

      expect(global.window.tabManager.startEditingTabName).toHaveBeenCalledWith(mockEditButton);
    });

    it("Should not call startEditingTabName if tabManager is unavailable", () => {
      const mockTabElement = {
        querySelector: vi.fn().mockReturnValue({}),
      };

      global.window = {};

      floatingMenu.handleEditNameTab(mockTabElement);
    });

    it("Should not call startEditingTabName if the edit button does not exist.", () => {
      const mockTabElement = {
        querySelector: vi.fn().mockReturnValue(null),
      };

      global.window = {
        tabManager: {
          startEditingTabName: vi.fn(),
        },
      };

      floatingMenu.handleEditNameTab(mockTabElement);

      expect(global.window.tabManager.startEditingTabName).not.toHaveBeenCalled();
    });
  });

  describe("handleBottomBarAction - search", () => {
    it("should open command palette when action is search", () => {
      global.window = {
        commandPalette: { open: vi.fn() },
      };

      floatingMenu.closeBottomBarSubmenus = vi.fn();
      floatingMenu.log = vi.fn();

      floatingMenu.handleBottomBarAction("search", {});

      expect(global.window.commandPalette.open).toHaveBeenCalled();
    });

    it("should close bottom bar submenus after search action", () => {
      global.window = {
        commandPalette: { open: vi.fn() },
      };

      floatingMenu.closeBottomBarSubmenus = vi.fn();
      floatingMenu.log = vi.fn();

      floatingMenu.handleBottomBarAction("search", {});

      expect(floatingMenu.closeBottomBarSubmenus).toHaveBeenCalled();
    });

    it("should not require an active editor for search", () => {
      global.window = {
        commandPalette: { open: vi.fn() },
      };

      floatingMenu.getActiveEditable = vi.fn().mockReturnValue(null);
      floatingMenu.closeBottomBarSubmenus = vi.fn();
      floatingMenu.log = vi.fn();

      floatingMenu.handleBottomBarAction("search", {});

      expect(global.window.commandPalette.open).toHaveBeenCalled();
      expect(floatingMenu.getActiveEditable).not.toHaveBeenCalled();
    });
  });

  describe("handleBottomBarAction - settings", () => {
    it("should open settings modal when action is settings", () => {
      const mockShowModal = vi.fn();
      global.document.querySelector = vi.fn().mockReturnValue({ showModal: mockShowModal });

      global.window = {};

      floatingMenu.closeBottomBarSubmenus = vi.fn();
      floatingMenu.log = vi.fn();

      floatingMenu.handleBottomBarAction("settings", {});

      expect(global.document.querySelector).toHaveBeenCalledWith("dialog#info-notepad");
      expect(mockShowModal).toHaveBeenCalled();
    });

    it("should close bottom bar submenus after settings action", () => {
      global.document.querySelector = vi.fn().mockReturnValue({ showModal: vi.fn() });

      global.window = {};

      floatingMenu.closeBottomBarSubmenus = vi.fn();
      floatingMenu.log = vi.fn();

      floatingMenu.handleBottomBarAction("settings", {});

      expect(floatingMenu.closeBottomBarSubmenus).toHaveBeenCalled();
    });

    it("should not require an active editor for settings", () => {
      global.document.querySelector = vi.fn().mockReturnValue({ showModal: vi.fn() });

      global.window = {};

      floatingMenu.getActiveEditable = vi.fn().mockReturnValue(null);
      floatingMenu.closeBottomBarSubmenus = vi.fn();
      floatingMenu.log = vi.fn();

      floatingMenu.handleBottomBarAction("settings", {});

      expect(global.document.querySelector).toHaveBeenCalledWith("dialog#info-notepad");
      expect(floatingMenu.getActiveEditable).not.toHaveBeenCalled();
    });

    it("should handle missing settings modal gracefully", () => {
      global.document.querySelector = vi.fn().mockReturnValue(null);

      global.window = {};

      floatingMenu.closeBottomBarSubmenus = vi.fn();
      floatingMenu.log = vi.fn();

      expect(() => {
        floatingMenu.handleBottomBarAction("settings", {});
      }).not.toThrow();
    });
  });
});