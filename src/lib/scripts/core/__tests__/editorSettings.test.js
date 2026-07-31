import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { EditorSettings } from "../editorSettings.js";

describe("EditorSettings", () => {
  let editorSettings;

  beforeEach(() => {
    vi.clearAllMocks();

    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };

    vi.spyOn(document.documentElement.style, "setProperty").mockImplementation(
      () => {},
    );

    editorSettings = new EditorSettings();
  });

  describe("constructor", () => {
    it("should initialize with null radios", () => {
      expect(editorSettings.widthRadios).toBeNull();
      expect(editorSettings.bgRadios).toBeNull();
    });
  });

  describe("init", () => {
    it("should call all setup methods in order", () => {
      const setupWidthSpy = vi
        .spyOn(editorSettings, "setupWidthSelector")
        .mockImplementation(() => {});
      const setupBgSpy = vi
        .spyOn(editorSettings, "setupBackgroundSelector")
        .mockImplementation(() => {});
      const setupFontSpy = vi
        .spyOn(editorSettings, "setupFontSizeListener")
        .mockImplementation(() => {});
      const restoreSpy = vi
        .spyOn(editorSettings, "restoreSettings")
        .mockImplementation(() => {});

      editorSettings.init();

      expect(setupWidthSpy).toHaveBeenCalled();
      expect(setupBgSpy).toHaveBeenCalled();
      expect(setupFontSpy).toHaveBeenCalled();
      expect(restoreSpy).toHaveBeenCalled();
    });
  });

  describe("setupWidthSelector", () => {
    it("should return early when no radios exist", () => {
      document.querySelectorAll = vi.fn(() => []);
      editorSettings.setupWidthSelector();
      expect(editorSettings.widthRadios.length).toBe(0);
    });

    it("should query width radios from DOM", () => {
      const querySpy = vi.fn(() => []);
      document.querySelectorAll = querySpy;
      editorSettings.setupWidthSelector();
      expect(querySpy).toHaveBeenCalledWith('input[name="editor-width"]');
    });

    it("should attach change listener to each radio", () => {
      const radio1 = { id: "width-default", addEventListener: vi.fn() };
      const radio2 = { id: "width-stretch", addEventListener: vi.fn() };
      document.querySelectorAll = vi.fn(() => [radio1, radio2]);
      document.querySelector = vi.fn(() => null);

      editorSettings.setupWidthSelector();

      expect(radio1.addEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      );
      expect(radio2.addEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      );
    });
  });

  describe("setupBackgroundSelector", () => {
    it("should return early when no radios exist", () => {
      document.querySelectorAll = vi.fn(() => []);
      editorSettings.setupBackgroundSelector();
      expect(editorSettings.bgRadios.length).toBe(0);
    });

    it("should query bg radios from DOM", () => {
      const querySpy = vi.fn(() => []);
      document.querySelectorAll = querySpy;
      editorSettings.setupBackgroundSelector();
      expect(querySpy).toHaveBeenCalledWith('input[name="editor-bg"]');
    });

    it("should attach change listener to each radio", () => {
      const radio1 = { id: "bg-flat", addEventListener: vi.fn() };
      const radio2 = { id: "bg-underline", addEventListener: vi.fn() };
      document.querySelectorAll = vi.fn(() => [radio1, radio2]);
      document.querySelector = vi.fn(() => null);

      editorSettings.setupBackgroundSelector();

      expect(radio1.addEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      );
      expect(radio2.addEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      );
    });
  });

  describe("setupFontSizeListener", () => {
    it("should return early when no radios exist", () => {
      document.querySelectorAll = vi.fn(() => []);
      editorSettings.setupFontSizeListener();
    });

    it("should attach change listener to each radio", () => {
      const radio = { id: "option-base-text", addEventListener: vi.fn() };
      document.querySelectorAll = vi.fn(() => [radio]);
      editorSettings.setupFontSizeListener();
      expect(radio.addEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      );
    });

    it("should wire preventLabelAutoScroll on font size radios", () => {
      const radio = {
        id: "option-medium-text",
        checked: false,
        addEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
      const label = { addEventListener: vi.fn() };
      document.querySelectorAll = vi.fn(() => [radio]);
      document.querySelector = vi.fn(() => label);

      editorSettings.setupFontSizeListener();

      const clickHandler = label.addEventListener.mock.calls.find((c) => c[0] === "click")[1];
      const mockEvent = { preventDefault: vi.fn() };
      clickHandler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(radio.checked).toBe(true);
      expect(radio.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "change", bubbles: true }),
      );
    });
  });

  describe("preventLabelAutoScroll", () => {
    it("should attach click listener to each label", () => {
      const label1 = { addEventListener: vi.fn() };
      const label2 = { addEventListener: vi.fn() };
      document.querySelector = vi.fn((selector) => {
        if (selector.includes("width-default")) return label1;
        if (selector.includes("width-stretch")) return label2;
        return null;
      });

      const radios = [
        { id: "width-default" },
        { id: "width-stretch" },
      ];
      editorSettings.preventLabelAutoScroll(radios);

      expect(label1.addEventListener).toHaveBeenCalledWith(
        "click",
        expect.any(Function),
      );
      expect(label2.addEventListener).toHaveBeenCalledWith(
        "click",
        expect.any(Function),
      );
    });

    it("should preventDefault and set checked on label click", () => {
      const clickHandler = vi.fn();
      const radio = { id: "width-default", checked: false, dispatchEvent: vi.fn() };
      const label = {
        addEventListener: vi.fn((event, handler) => {
          if (event === "click") clickHandler.mockImplementation(handler);
        }),
      };
      document.querySelector = vi.fn(() => label);

      editorSettings.preventLabelAutoScroll([radio]);

      const mockEvent = { preventDefault: vi.fn() };
      clickHandler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(radio.checked).toBe(true);
      expect(radio.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "change" }),
      );
    });

    it("should skip radios without associated label", () => {
      document.querySelector = vi.fn(() => null);
      const radio = { id: "nonexistent" };

      expect(() => {
        editorSettings.preventLabelAutoScroll([radio]);
      }).not.toThrow();
    });
  });

  describe("syncRadioGroup", () => {
    it("should check only the matching radio", () => {
      const radio1 = { id: "width-default", checked: false };
      const radio2 = { id: "width-stretch", checked: false };
      editorSettings.widthRadios = [radio1, radio2];

      editorSettings.syncRadioGroup(editorSettings.widthRadios, "width-default");

      expect(radio1.checked).toBe(true);
      expect(radio2.checked).toBe(false);
    });

    it("should return early when radios is null", () => {
      expect(() => {
        editorSettings.syncRadioGroup(null, "width-default");
      }).not.toThrow();
    });
  });

  describe("restoreSettings", () => {
    it("should restore width from localStorage and apply", () => {
      localStorage.getItem.mockImplementation((key) => {
        if (key === "editorWidth") return "stretch";
        return null;
      });

      const mockWrapper = { classList: { toggle: vi.fn() } };
      document.querySelectorAll = vi.fn(() => [mockWrapper]);

      editorSettings.restoreSettings();

      expect(editorSettings.applyWidth).toBeDefined();
      expect(localStorage.setItem).toHaveBeenCalledWith(
        "editorWidth",
        "stretch",
      );
    });

    it("should skip invalid width values", () => {
      localStorage.getItem.mockImplementation((key) => {
        if (key === "editorWidth") return "invalid";
        return null;
      });

      editorSettings.restoreSettings();

      expect(localStorage.setItem).not.toHaveBeenCalledWith(
        "editorWidth",
        "invalid",
      );
    });

    it("should use default when no localStorage values", () => {
      localStorage.getItem.mockReturnValue(null);

      editorSettings.restoreSettings();

      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        "--tn-paper-line-spacing",
        "28px",
      );
    });
  });

  describe("updateLineSpacing", () => {
    it("should persist fontSize to localStorage", () => {
      editorSettings.updateLineSpacing("medium");
      expect(localStorage.setItem).toHaveBeenCalledWith("fontSize", "medium");
    });

    it("should calculate line spacing for base font size", () => {
      editorSettings.updateLineSpacing("base");
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        "--tn-paper-line-spacing",
        "28px",
      );
    });

    it("should calculate line spacing for medium font size", () => {
      editorSettings.updateLineSpacing("medium");
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        "--tn-paper-line-spacing",
        "35px",
      );
    });

    it("should calculate line spacing for large font size", () => {
      editorSettings.updateLineSpacing("large");
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        "--tn-paper-line-spacing",
        expect.stringContaining("44."),
      );
    });

    it("should fall back to base for unknown sizes", () => {
      editorSettings.updateLineSpacing("unknown");
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        "--tn-paper-line-spacing",
        "28px",
      );
    });
  });

  describe("applyWidth", () => {
    it("should save to localStorage", () => {
      document.querySelectorAll = vi.fn(() => []);
      editorSettings.applyWidth("stretch");
      expect(localStorage.setItem).toHaveBeenCalledWith(
        "editorWidth",
        "stretch",
      );
    });

    it("should add stretch class when value is stretch", () => {
      const mockWrapper = { classList: { toggle: vi.fn() } };
      document.querySelectorAll = vi.fn(() => [mockWrapper]);
      editorSettings.applyWidth("stretch");
      expect(mockWrapper.classList.toggle).toHaveBeenCalledWith(
        "stretch",
        true,
      );
    });

    it("should remove stretch class when value is default", () => {
      const mockWrapper = { classList: { toggle: vi.fn() } };
      document.querySelectorAll = vi.fn(() => [mockWrapper]);
      editorSettings.applyWidth("default");
      expect(mockWrapper.classList.toggle).toHaveBeenCalledWith(
        "stretch",
        false,
      );
    });

    it("should handle empty DOM", () => {
      document.querySelectorAll = vi.fn(() => []);
      expect(() => editorSettings.applyWidth("stretch")).not.toThrow();
      expect(localStorage.setItem).toHaveBeenCalledWith(
        "editorWidth",
        "stretch",
      );
    });
  });

  describe("applyBackground", () => {
    it("should save to localStorage", () => {
      document.querySelectorAll = vi.fn(() => []);
      editorSettings.applyBackground("underline");
      expect(localStorage.setItem).toHaveBeenCalledWith(
        "editorBackground",
        "underline",
      );
    });

    it("should remove all bg classes and add new one", () => {
      const mockEl = {
        classList: {
          remove: vi.fn(),
          add: vi.fn(),
        },
      };
      document.querySelectorAll = vi.fn(() => [mockEl]);
      editorSettings.applyBackground("underline");

      expect(mockEl.classList.remove).toHaveBeenCalledWith("bg-flat");
      expect(mockEl.classList.remove).toHaveBeenCalledWith("bg-underline");
      expect(mockEl.classList.remove).toHaveBeenCalledWith("bg-grid");
      expect(mockEl.classList.add).toHaveBeenCalledWith("bg-underline");
    });

    it("should not add any class for flat", () => {
      const mockEl = {
        classList: {
          remove: vi.fn(),
          add: vi.fn(),
        },
      };
      document.querySelectorAll = vi.fn(() => [mockEl]);
      editorSettings.applyBackground("flat");

      expect(mockEl.classList.remove).toHaveBeenCalledWith("bg-flat");
      expect(mockEl.classList.remove).toHaveBeenCalledWith("bg-underline");
      expect(mockEl.classList.remove).toHaveBeenCalledWith("bg-grid");
      expect(mockEl.classList.add).not.toHaveBeenCalled();
    });

    it("should handle empty DOM", () => {
      document.querySelectorAll = vi.fn(() => []);
      expect(() =>
        editorSettings.applyBackground("underline"),
      ).not.toThrow();
      expect(localStorage.setItem).toHaveBeenCalledWith(
        "editorBackground",
        "underline",
      );
    });
  });
});
