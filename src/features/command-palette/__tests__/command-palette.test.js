import { describe, it, expect, beforeEach, vi } from "vitest";
import { CommandPalette } from "../command-palette.js";

describe("CommandPalette", () => {
  let commandPalette;
  let mockModal;
  let mockInput;
  let mockResultsContainer;

  beforeEach(() => {
    vi.clearAllMocks();

    mockModal = {
      showModal: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      hasAttribute: vi.fn().mockReturnValue(false),
    };

    mockInput = {
      value: "",
      focus: vi.fn(),
      addEventListener: vi.fn(),
    };

    mockResultsContainer = {
      innerHTML: "",
      querySelectorAll: vi.fn().mockReturnValue([]),
      addEventListener: vi.fn(),
    };

    document.getElementById = vi.fn((id) => {
      if (id === "commandPalette") return mockModal;
      if (id === "commandPaletteInput") return mockInput;
      if (id === "commandPaletteResults") return mockResultsContainer;
      return null;
    });

    commandPalette = new CommandPalette({ debug: false });
    commandPalette.modal = mockModal;
    commandPalette.input = mockInput;
    commandPalette.resultsContainer = mockResultsContainer;
  });

  // ===== INIT =====
  describe("init", () => {
    it("should return this if modal does not exist", async () => {
      document.getElementById.mockReturnValue(null);
      const instance = new CommandPalette({ debug: false });
      const result = await instance.init();
      expect(result).toBe(instance);
    });

    it("should set up event listeners when modal exists", async () => {
      await commandPalette.init();
      expect(mockModal.addEventListener).toHaveBeenCalled();
      expect(mockInput.addEventListener).toHaveBeenCalled();
      expect(mockResultsContainer.addEventListener).toHaveBeenCalled();
    });

    it("should register input, keydown, cancel, and click listeners", async () => {
      await commandPalette.init();
      const inputEvents = mockInput.addEventListener.mock.calls.map((c) => c[0]);
      const modalEvents = mockModal.addEventListener.mock.calls.map((c) => c[0]);
      const resultsEvents = mockResultsContainer.addEventListener.mock.calls.map((c) => c[0]);
      expect(inputEvents).toContain("input");
      expect(inputEvents).toContain("keydown");
      expect(modalEvents).toContain("cancel");
      expect(modalEvents).toContain("click");
      expect(resultsEvents).toContain("click");
    });
  });

  // ===== OPEN / CLOSE / TOGGLE =====
  describe("open", () => {
    it("should call showModal and set isOpen to true", () => {
      vi.useFakeTimers();
      commandPalette.open();
      expect(mockModal.showModal).toHaveBeenCalled();
      expect(commandPalette.isOpen).toBe(true);
      vi.runAllTimers();
      expect(mockInput.focus).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("should reset input value and activeIndex", () => {
      mockInput.value = "old query";
      commandPalette.activeIndex = 5;
      commandPalette.open();
      expect(mockInput.value).toBe("");
      expect(commandPalette.activeIndex).toBe(-1);
    });

    it("should call showInitialState to display empty prompt", () => {
      window.i18n = { t: vi.fn((key) => key) };
      commandPalette.open();
      expect(mockResultsContainer.innerHTML).toContain("command-palette.empty");
    });
  });

  describe("close", () => {
    it("should call close and set isOpen to false", () => {
      commandPalette.isOpen = true;
      commandPalette.close();
      expect(mockModal.close).toHaveBeenCalled();
      expect(commandPalette.isOpen).toBe(false);
    });

    it("should reset input, results, and activeIndex", () => {
      mockInput.value = "test";
      commandPalette.results = [{ tabId: "tab-1" }];
      commandPalette.activeIndex = 2;
      commandPalette.close();
      expect(mockInput.value).toBe("");
      expect(commandPalette.results).toEqual([]);
      expect(commandPalette.activeIndex).toBe(-1);
    });

    it("should handle null input gracefully", () => {
      commandPalette.input = null;
      commandPalette.isOpen = true;
      commandPalette.close();
      expect(mockModal.close).toHaveBeenCalled();
      expect(commandPalette.isOpen).toBe(false);
    });

    it("should handle null modal gracefully", () => {
      commandPalette.modal = null;
      commandPalette.isOpen = true;
      commandPalette.close();
      expect(commandPalette.isOpen).toBe(true);
    });
  });

  describe("toggle", () => {
    it("should open when closed", () => {
      commandPalette.isOpen = false;
      commandPalette.toggle();
      expect(mockModal.showModal).toHaveBeenCalled();
      expect(commandPalette.isOpen).toBe(true);
    });

    it("should close when open", () => {
      commandPalette.isOpen = true;
      commandPalette.toggle();
      expect(mockModal.close).toHaveBeenCalled();
      expect(commandPalette.isOpen).toBe(false);
    });
  });

  // ===== SEARCH =====
  describe("handleSearch", () => {
    beforeEach(() => {
      window.tabManager = {
        tabsData: [
          { id: "body-tab-1", name: "Shopping List", content: "<p>Milk, eggs, bread</p>" },
          { id: "body-tab-2", name: "Meeting Notes", content: "<p>Discuss project timeline</p>" },
          { id: "body-tab-3", name: "Ideas", content: "<p>New app idea: <b>shopping</b> assistant</p>" },
          { id: "body-tab-4", name: "Vacation Plan", content: "<ul><li>Paris</li><li>Tokyo</li><li>New York</li></ul>" },
        ],
      };

      window.i18n = {
        t: vi.fn((key) => {
          const translations = {
            "command-palette.empty": "Type to search...",
            "command-palette.no-results": "No results found",
          };
          return translations[key] || key;
        }),
      };
    });

    it("should show initial state when query is empty", () => {
      commandPalette.handleSearch("");
      expect(mockResultsContainer.innerHTML).toContain("Type to search...");
      expect(commandPalette.results).toEqual([]);
    });

    it("should show initial state when query is whitespace only", () => {
      commandPalette.handleSearch("   ");
      expect(mockResultsContainer.innerHTML).toContain("Type to search...");
    });

    it("should find tabs by name", () => {
      commandPalette.handleSearch("shopping");
      expect(commandPalette.results.length).toBe(2);
      expect(commandPalette.results[0].tabId).toBe("body-tab-1");
      expect(commandPalette.results[0].matchType).toBe("name");
      expect(commandPalette.results[1].tabId).toBe("body-tab-3");
      expect(commandPalette.results[1].matchType).toBe("content");
    });

    it("should find tabs by content only", () => {
      commandPalette.handleSearch("timeline");
      expect(commandPalette.results.length).toBe(1);
      expect(commandPalette.results[0].tabId).toBe("body-tab-2");
      expect(commandPalette.results[0].matchType).toBe("content");
    });

    it("should find tabs by content with HTML tags", () => {
      commandPalette.handleSearch("paris");
      expect(commandPalette.results.length).toBe(1);
      expect(commandPalette.results[0].tabId).toBe("body-tab-4");
      expect(commandPalette.results[0].matchType).toBe("content");
    });

    it("should show no results when nothing matches", () => {
      commandPalette.handleSearch("xyznonexistent");
      expect(commandPalette.results.length).toBe(0);
      expect(mockResultsContainer.innerHTML).toContain("No results found");
    });

    it("should be case insensitive", () => {
      commandPalette.handleSearch("MEETING");
      expect(commandPalette.results.length).toBe(1);
      expect(commandPalette.results[0].tabId).toBe("body-tab-2");
    });

    it("should set activeIndex to 0 when results found", () => {
      commandPalette.handleSearch("shop");
      expect(commandPalette.activeIndex).toBe(0);
    });

    it("should set activeIndex to -1 when no results", () => {
      commandPalette.handleSearch("nothing");
      expect(commandPalette.activeIndex).toBe(-1);
    });

    it("should show snippet for content-only matches", () => {
      commandPalette.handleSearch("timeline");
      expect(commandPalette.results[0].snippet).toContain("timeline");
    });

    it("should not show snippet when name matches", () => {
      commandPalette.handleSearch("shopping");
      expect(commandPalette.results[0].snippet).toBe("");
      expect(commandPalette.results[0].matchType).toBe("name");
    });

    it("should handle tabs with empty content", () => {
      window.tabManager.tabsData.push({ id: "body-tab-5", name: "Empty", content: "" });
      commandPalette.handleSearch("empty");
      expect(commandPalette.results.length).toBe(1);
      expect(commandPalette.results[0].matchType).toBe("name");
    });

    it("should handle tabs with null content", () => {
      window.tabManager.tabsData.push({ id: "body-tab-6", name: "Null Tab", content: null });
      commandPalette.handleSearch("null tab");
      expect(commandPalette.results.length).toBe(1);
    });
  });

  // ===== HTML STRIPPING =====
  describe("stripHtml", () => {
    it("should remove simple HTML tags", () => {
      expect(commandPalette.stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
    });

    it("should handle empty content", () => {
      expect(commandPalette.stripHtml("")).toBe("");
    });

    it("should handle nested HTML", () => {
      expect(commandPalette.stripHtml('<div class="test"><span>Text</span> <i>italic</i></div>')).toBe("Text italic");
    });

    it("should handle HTML with attributes", () => {
      expect(commandPalette.stripHtml('<a href="http://example.com" target="_blank">link</a>')).toBe("link");
    });

    it("should handle br tags", () => {
      expect(commandPalette.stripHtml("Line 1<br>Line 2")).toBe("Line 1Line 2");
    });

    it("should handle complex real-world HTML from editor", () => {
      const html = '<p>This is a <b>bold</b> and <i>italic</i> text with <a href="#">a link</a></p>';
      expect(commandPalette.stripHtml(html)).toBe("This is a bold and italic text with a link");
    });
  });

  // ===== SNIPPET EXTRACTION =====
  describe("extractSnippet", () => {
    it("should extract text around the match with ellipsis for long text", () => {
      const text = "Alpha Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliet Kilo Lima Mike November Oscar";
      const snippet = commandPalette.extractSnippet(text, "delta");
      expect(snippet.toLowerCase()).toContain("delta");
      expect(snippet).toContain("...");
    });

    it("should return empty string if query not found", () => {
      const snippet = commandPalette.extractSnippet("Hello world", "xyz");
      expect(snippet).toBe("");
    });

    it("should not add leading ellipsis when match is near the start", () => {
      const snippet = commandPalette.extractSnippet("Search results here today and tomorrow", "search");
      expect(snippet.toLowerCase()).toContain("search");
      expect(snippet.startsWith("...")).toBe(false);
    });

    it("should be case insensitive", () => {
      const snippet = commandPalette.extractSnippet("Hello WORLD test", "world");
      expect(snippet.toLowerCase()).toContain("world");
    });

    it("should handle match at the very end", () => {
      const text = "Alpha Bravo Charlie Delta Echo";
      const snippet = commandPalette.extractSnippet(text, "echo");
      expect(snippet.toLowerCase()).toContain("echo");
    });

    it("should handle single character query", () => {
      const text = "Alpha Bravo Charlie";
      const snippet = commandPalette.extractSnippet(text, "b");
      expect(snippet.toLowerCase()).toContain("b");
    });

    it("should wrap matched text in mark tags", () => {
      const text = "Alpha Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliet Kilo Lima Mike November Oscar";
      const snippet = commandPalette.extractSnippet(text, "delta");
      expect(snippet).toContain("<mark>");
      expect(snippet).toContain("</mark>");
    });
  });

  // ===== HIGHLIGHT =====
  describe("highlightMatch", () => {
    it("should wrap matched text in mark tags", () => {
      const result = commandPalette.highlightMatch("Shopping List", "shop");
      expect(result).toContain("<mark>");
      expect(result).toContain("Shop");
    });

    it("should return escaped text when no match", () => {
      const result = commandPalette.highlightMatch("Hello World", "test");
      expect(result).toBe("Hello World");
    });

    it("should handle empty query", () => {
      const result = commandPalette.highlightMatch("Hello", "");
      expect(result).toBe("Hello");
    });

    it("should be case insensitive", () => {
      const result = commandPalette.highlightMatch("Shopping List", "SHOP");
      expect(result).toContain("<mark>");
    });

    it("should escape HTML in text before highlighting", () => {
      const result = commandPalette.highlightMatch("Hello <script>alert('xss')</script>", "script");
      expect(result).toContain("<mark>");
      expect(result).not.toContain("<script>");
    });

    it("should highlight only the first occurrence", () => {
      const result = commandPalette.highlightMatch("test test test", "test");
      const marks = result.match(/<mark>/g);
      expect(marks.length).toBe(1);
    });
  });

  describe("highlightSnippet", () => {
    it("should wrap matched text in mark tags", () => {
      const result = commandPalette.highlightSnippet("This is a test snippet", "test");
      expect(result).toContain("<mark>test</mark>");
    });

    it("should return escaped text when no match", () => {
      const result = commandPalette.highlightSnippet("Hello world", "xyz");
      expect(result).toContain("Hello world");
      expect(result).not.toContain("<mark>");
    });

    it("should be case insensitive", () => {
      const result = commandPalette.highlightSnippet("This is a Test", "test");
      expect(result).toContain("<mark>Test</mark>");
    });
  });

  // ===== ESCAPE HTML =====
  describe("escapeHtml", () => {
    it("should escape angle brackets", () => {
      expect(commandPalette.escapeHtml("<script>alert('xss')</script>")).toBe("&lt;script&gt;alert('xss')&lt;/script&gt;");
    });

    it("should handle normal text", () => {
      expect(commandPalette.escapeHtml("Hello World")).toBe("Hello World");
    });

    it("should escape ampersand", () => {
      expect(commandPalette.escapeHtml("a & b")).toBe("a &amp; b");
    });

    it("should handle empty string", () => {
      expect(commandPalette.escapeHtml("")).toBe("");
    });
  });

  // ===== NAVIGATION =====
  describe("moveSelection", () => {
    it("should move selection down", () => {
      commandPalette.results = [
        { tabId: "tab-1", tabName: "Tab 1" },
        { tabId: "tab-2", tabName: "Tab 2" },
      ];
      commandPalette.activeIndex = -1;
      commandPalette.moveSelection(1);
      expect(commandPalette.activeIndex).toBe(0);
    });

    it("should wrap around to end when at beginning", () => {
      commandPalette.results = [
        { tabId: "tab-1", tabName: "Tab 1" },
        { tabId: "tab-2", tabName: "Tab 2" },
      ];
      commandPalette.activeIndex = 0;
      commandPalette.moveSelection(-1);
      expect(commandPalette.activeIndex).toBe(1);
    });

    it("should wrap around to beginning when at end", () => {
      commandPalette.results = [
        { tabId: "tab-1", tabName: "Tab 1" },
        { tabId: "tab-2", tabName: "Tab 2" },
      ];
      commandPalette.activeIndex = 1;
      commandPalette.moveSelection(1);
      expect(commandPalette.activeIndex).toBe(0);
    });

    it("should not move when results are empty", () => {
      commandPalette.results = [];
      commandPalette.activeIndex = -1;
      commandPalette.moveSelection(1);
      expect(commandPalette.activeIndex).toBe(-1);
    });

    it("should move multiple steps", () => {
      commandPalette.results = [
        { tabId: "tab-1", tabName: "Tab 1" },
        { tabId: "tab-2", tabName: "Tab 2" },
        { tabId: "tab-3", tabName: "Tab 3" },
      ];
      commandPalette.activeIndex = 0;
      commandPalette.moveSelection(1);
      commandPalette.moveSelection(1);
      expect(commandPalette.activeIndex).toBe(2);
    });
  });

  describe("updateActiveVisual", () => {
    it("should handle null resultsContainer gracefully", () => {
      commandPalette.resultsContainer = null;
      expect(() => commandPalette.updateActiveVisual()).not.toThrow();
    });

    it("should toggle active class on items", () => {
      const mockItems = [
        { classList: { toggle: vi.fn() }, scrollIntoView: vi.fn() },
        { classList: { toggle: vi.fn() }, scrollIntoView: vi.fn() },
      ];
      mockResultsContainer.querySelectorAll.mockReturnValue(mockItems);
      commandPalette.activeIndex = 1;

      commandPalette.updateActiveVisual();

      expect(mockItems[0].classList.toggle).toHaveBeenCalledWith("command-palette__result--active", false);
      expect(mockItems[1].classList.toggle).toHaveBeenCalledWith("command-palette__result--active", true);
    });
  });

  // ===== OPEN TAB (FIXED) =====
  describe("openTab", () => {
    it("should set radio.checked to true and close palette", () => {
      const mockRadio = { checked: false };
      document.getElementById = vi.fn((id) => {
        if (id === "body-tab-1") return mockRadio;
        return null;
      });
      document.dispatchEvent = vi.fn();

      commandPalette.isOpen = true;

      commandPalette.openTab("body-tab-1");

      expect(mockRadio.checked).toBe(true);
      expect(commandPalette.isOpen).toBe(false);
    });

    it("should dispatch tabsChanged event", () => {
      const mockRadio = { checked: false };
      document.getElementById = vi.fn((id) => {
        if (id === "body-tab-1") return mockRadio;
        return null;
      });
      const dispatchedEvents = [];
      document.dispatchEvent = vi.fn((e) => dispatchedEvents.push(e));

      commandPalette.openTab("body-tab-1");

      expect(dispatchedEvents.some((e) => e.type === "tabsChanged")).toBe(true);
    });

    it("should return early if element not found", () => {
      document.getElementById = vi.fn(() => null);
      document.dispatchEvent = vi.fn();
      commandPalette.isOpen = true;

      commandPalette.openTab("nonexistent-tab");

      expect(commandPalette.isOpen).toBe(true);
      expect(document.dispatchEvent).not.toHaveBeenCalled();
    });

    it("should close palette after opening tab", () => {
      const mockRadio = { checked: false };
      document.getElementById = vi.fn((id) => {
        if (id === "body-tab-1") return mockRadio;
        return null;
      });
      document.dispatchEvent = vi.fn();
      commandPalette.isOpen = true;
      commandPalette.results = [{ tabId: "body-tab-1" }];

      commandPalette.openTab("body-tab-1");

      expect(commandPalette.isOpen).toBe(false);
      expect(mockRadio.checked).toBe(true);
    });
  });

  // ===== KEYBOARD NAVIGATION =====
  describe("handleKeyNavigation", () => {
    it("should close on Escape", () => {
      commandPalette.isOpen = true;
      const event = { key: "Escape", preventDefault: vi.fn(), stopPropagation: vi.fn() };
      commandPalette.handleKeyNavigation(event);
      expect(commandPalette.isOpen).toBe(false);
    });

    it("should move selection down on ArrowDown", () => {
      commandPalette.results = [
        { tabId: "tab-1", tabName: "Tab 1" },
        { tabId: "tab-2", tabName: "Tab 2" },
      ];
      commandPalette.activeIndex = -1;
      const event = { key: "ArrowDown", preventDefault: vi.fn() };
      commandPalette.handleKeyNavigation(event);
      expect(commandPalette.activeIndex).toBe(0);
    });

    it("should move selection up on ArrowUp", () => {
      commandPalette.results = [
        { tabId: "tab-1", tabName: "Tab 1" },
        { tabId: "tab-2", tabName: "Tab 2" },
      ];
      commandPalette.activeIndex = 1;
      const event = { key: "ArrowUp", preventDefault: vi.fn() };
      commandPalette.handleKeyNavigation(event);
      expect(commandPalette.activeIndex).toBe(0);
    });

    it("should call selectActive on Enter", () => {
      commandPalette.results = [{ tabId: "tab-1", tabName: "Tab 1" }];
      commandPalette.activeIndex = 0;
      commandPalette.isOpen = true;

      const mockRadio = { checked: false };
      document.getElementById = vi.fn((id) => {
        if (id === "tab-1") return mockRadio;
        return null;
      });
      document.dispatchEvent = vi.fn();

      const event = { key: "Enter", preventDefault: vi.fn() };
      commandPalette.handleKeyNavigation(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockRadio.checked).toBe(true);
      expect(commandPalette.isOpen).toBe(false);
    });

    it("should not select on Enter when activeIndex is -1", () => {
      commandPalette.results = [{ tabId: "tab-1", tabName: "Tab 1" }];
      commandPalette.activeIndex = -1;
      commandPalette.isOpen = true;

      document.getElementById = vi.fn(() => null);
      document.dispatchEvent = vi.fn();

      const event = { key: "Enter", preventDefault: vi.fn() };
      commandPalette.handleKeyNavigation(event);

      expect(commandPalette.isOpen).toBe(true);
    });

    it("should do nothing for unhandled keys", () => {
      commandPalette.isOpen = true;
      const event = { key: "a", preventDefault: vi.fn() };
      commandPalette.handleKeyNavigation(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  // ===== SELECT ACTIVE =====
  describe("selectActive", () => {
    it("should open the active tab", () => {
      commandPalette.results = [{ tabId: "tab-1", tabName: "Tab 1" }];
      commandPalette.activeIndex = 0;
      commandPalette.isOpen = true;

      const mockRadio = { checked: false };
      document.getElementById = vi.fn((id) => {
        if (id === "tab-1") return mockRadio;
        return null;
      });
      document.dispatchEvent = vi.fn();

      commandPalette.selectActive();

      expect(mockRadio.checked).toBe(true);
      expect(commandPalette.isOpen).toBe(false);
    });

    it("should do nothing when activeIndex is -1", () => {
      commandPalette.results = [{ tabId: "tab-1", tabName: "Tab 1" }];
      commandPalette.activeIndex = -1;
      commandPalette.isOpen = true;

      document.getElementById = vi.fn(() => null);
      document.dispatchEvent = vi.fn();

      commandPalette.selectActive();

      expect(commandPalette.isOpen).toBe(true);
    });

    it("should do nothing when results are empty", () => {
      commandPalette.results = [];
      commandPalette.activeIndex = 0;
      commandPalette.isOpen = true;

      document.getElementById = vi.fn(() => null);
      document.dispatchEvent = vi.fn();

      commandPalette.selectActive();

      expect(commandPalette.isOpen).toBe(true);
    });
  });

  // ===== INTEGRATION: SEARCH + SELECT FLOW =====
  describe("full search and select flow", () => {
    beforeEach(() => {
      window.tabManager = {
        tabsData: [
          { id: "body-tab-1", name: "Shopping List", content: "<p>Milk, eggs, bread</p>" },
          { id: "body-tab-2", name: "Meeting Notes", content: "<p>Discuss project timeline</p>" },
          { id: "body-tab-3", name: "Ideas", content: "<p>New app idea: <b>shopping</b> assistant</p>" },
        ],
      };

      window.i18n = {
        t: vi.fn((key) => {
          const translations = {
            "command-palette.empty": "Type to search...",
            "command-palette.no-results": "No results found",
          };
          return translations[key] || key;
        }),
      };
    });

    it("search → find results → select first → tab opens", () => {
      const mockRadio1 = { checked: false };
      const mockRadio2 = { checked: false };
      document.getElementById = vi.fn((id) => {
        if (id === "commandPalette") return mockModal;
        if (id === "commandPaletteInput") return mockInput;
        if (id === "commandPaletteResults") return mockResultsContainer;
        if (id === "body-tab-1") return mockRadio1;
        if (id === "body-tab-3") return mockRadio2;
        return null;
      });
      document.dispatchEvent = vi.fn();

      commandPalette.handleSearch("shopping");

      expect(commandPalette.results.length).toBe(2);
      expect(commandPalette.activeIndex).toBe(0);

      commandPalette.selectActive();

      expect(mockRadio1.checked).toBe(true);
      expect(commandPalette.isOpen).toBe(false);
    });

    it("search → navigate with ArrowDown → Enter → correct tab opens", () => {
      const mockRadio1 = { checked: false };
      const mockRadio2 = { checked: false };
      document.getElementById = vi.fn((id) => {
        if (id === "commandPalette") return mockModal;
        if (id === "commandPaletteInput") return mockInput;
        if (id === "commandPaletteResults") return mockResultsContainer;
        if (id === "body-tab-1") return mockRadio1;
        if (id === "body-tab-3") return mockRadio2;
        return null;
      });
      document.dispatchEvent = vi.fn();

      commandPalette.handleSearch("shopping");
      expect(commandPalette.activeIndex).toBe(0);

      const arrowEvent = { key: "ArrowDown", preventDefault: vi.fn() };
      commandPalette.handleKeyNavigation(arrowEvent);
      expect(commandPalette.activeIndex).toBe(1);

      const enterEvent = { key: "Enter", preventDefault: vi.fn() };
      commandPalette.handleKeyNavigation(enterEvent);

      expect(mockRadio2.checked).toBe(true);
      expect(commandPalette.isOpen).toBe(false);
    });

    it("search → Escape → palette closes → no tab opens", () => {
      const mockRadio = { checked: false };
      document.getElementById = vi.fn((id) => {
        if (id === "commandPalette") return mockModal;
        if (id === "commandPaletteInput") return mockInput;
        if (id === "commandPaletteResults") return mockResultsContainer;
        if (id === "body-tab-1") return mockRadio;
        return null;
      });
      document.dispatchEvent = vi.fn();

      commandPalette.handleSearch("shopping");

      const escEvent = { key: "Escape", preventDefault: vi.fn(), stopPropagation: vi.fn() };
      commandPalette.handleKeyNavigation(escEvent);

      expect(mockRadio.checked).toBe(false);
      expect(commandPalette.isOpen).toBe(false);
    });
  });

  // ===== RENDER RESULTS =====
  describe("renderResults", () => {
    it("should generate HTML with result buttons", () => {
      commandPalette.results = [
        { tabId: "body-tab-1", tabName: "Shopping List", snippet: "", matchType: "name" },
      ];
      commandPalette.activeIndex = 0;

      commandPalette.renderResults("xyz");

      expect(mockResultsContainer.innerHTML).toContain("body-tab-1");
      expect(mockResultsContainer.innerHTML).toContain("Shopping List");
      expect(mockResultsContainer.innerHTML).toContain("data-action=\"open-tab\"");
    });

    it("should show title badge for name matches", () => {
      commandPalette.results = [
        { tabId: "body-tab-1", tabName: "Shopping", snippet: "", matchType: "name" },
      ];
      commandPalette.activeIndex = 0;

      commandPalette.renderResults("shopping");

      expect(mockResultsContainer.innerHTML).toContain("command-palette__result-badge--name");
      expect(mockResultsContainer.innerHTML).toContain("title");
    });

    it("should show content badge for content matches", () => {
      commandPalette.results = [
        { tabId: "body-tab-2", tabName: "Notes", snippet: "Discuss <mark>timeline</mark>", matchType: "content" },
      ];
      commandPalette.activeIndex = 0;

      commandPalette.renderResults("timeline");

      expect(mockResultsContainer.innerHTML).toContain("command-palette__result-badge--content");
      expect(mockResultsContainer.innerHTML).toContain("content");
    });

    it("should include snippet HTML when present", () => {
      commandPalette.results = [
        { tabId: "body-tab-2", tabName: "Notes", snippet: "...project <mark>timeline</mark>...", matchType: "content" },
      ];
      commandPalette.activeIndex = 0;

      commandPalette.renderResults("timeline");

      expect(mockResultsContainer.innerHTML).toContain("command-palette__result-snippet");
      expect(mockResultsContainer.innerHTML).toContain("timeline");
    });

    it("should not include snippet when empty", () => {
      commandPalette.results = [
        { tabId: "body-tab-1", tabName: "Shopping", snippet: "", matchType: "name" },
      ];
      commandPalette.activeIndex = 0;

      commandPalette.renderResults("shopping");

      expect(mockResultsContainer.innerHTML).not.toContain("command-palette__result-snippet");
    });

    it("should add active class to active result", () => {
      commandPalette.results = [
        { tabId: "body-tab-1", tabName: "Tab 1", snippet: "", matchType: "name" },
        { tabId: "body-tab-2", tabName: "Tab 2", snippet: "", matchType: "name" },
      ];
      commandPalette.activeIndex = 1;

      commandPalette.renderResults("tab");

      expect(mockResultsContainer.innerHTML).toContain("command-palette__result--active");
    });

    it("should show no results message when empty", () => {
      commandPalette.results = [];
      commandPalette.renderResults("nothing");
      expect(mockResultsContainer.innerHTML).toContain("No results found");
    });
  });

  // ===== SHOW STATES =====
  describe("showInitialState", () => {
    it("should show empty message from i18n", () => {
      window.i18n = { t: vi.fn((key) => "translated-" + key) };
      commandPalette.showInitialState();
      expect(mockResultsContainer.innerHTML).toContain("translated-command-palette.empty");
    });

    it("should show fallback message when i18n not available", () => {
      window.i18n = undefined;
      commandPalette.showInitialState();
      expect(mockResultsContainer.innerHTML).toContain("Type to search your notes...");
    });

    it("should reset results and activeIndex", () => {
      commandPalette.results = [{ tabId: "tab-1" }];
      commandPalette.activeIndex = 5;
      commandPalette.showInitialState();
      expect(commandPalette.results).toEqual([]);
      expect(commandPalette.activeIndex).toBe(-1);
    });
  });

  describe("showNoResults", () => {
    it("should show no results message with query", () => {
      window.i18n = { t: vi.fn((key) => "No results") };
      commandPalette.showNoResults("test query");
      expect(mockResultsContainer.innerHTML).toContain("No results");
      expect(mockResultsContainer.innerHTML).toContain("test query");
    });

    it("should show no results message without query", () => {
      window.i18n = { t: vi.fn((key) => "No results") };
      commandPalette.showNoResults();
      expect(mockResultsContainer.innerHTML).toContain("No results");
    });

    it("should reset results and activeIndex", () => {
      commandPalette.results = [{ tabId: "tab-1" }];
      commandPalette.activeIndex = 5;
      commandPalette.showNoResults("test");
      expect(commandPalette.results).toEqual([]);
      expect(commandPalette.activeIndex).toBe(-1);
    });
  });
});
