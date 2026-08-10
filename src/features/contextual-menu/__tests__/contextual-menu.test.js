import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ContextMenu } from "../contextual-menu.js";

// Mockear dependencias
vi.mock("../../../lib/scripts/utils/emojiDetector.js", () => ({
  detectEmojiInText: vi.fn().mockReturnValue(false),
  getRandomPinEmoji: vi.fn().mockReturnValue("🔴"),
}));

// Mock de navigator.language
function mockNavigatorLanguage(lang) {
  Object.defineProperty(global, "navigator", {
    value: { language: lang },
    writable: true,
    configurable: true,
  });
}

// Reset i18n
function resetI18n() {
  if (global.window) {
    global.window.i18n = undefined;
  }
}

describe("ContextMenu", () => {
  let contextMenu;
  let mockElement;
  let mockEvent;

  beforeEach(() => {
    // Mock DOM elements
    mockElement = {
      style: { display: "none" },
      classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn() },
      getBoundingClientRect: vi.fn().mockReturnValue({ top: 100, left: 100 }),
      querySelectorAll: vi.fn().mockReturnValue([]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      focus: vi.fn(),
    };

    mockEvent = {
      preventDefault: vi.fn(),
      target: { tagName: "DIV", textContent: "test text" },
      clientX: 150,
      clientY: 150,
      button: 0,
    };

    // Mock document
    global.document = {
      querySelector: vi.fn().mockReturnValue(mockElement),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getElementById: vi.fn().mockReturnValue(mockElement),
      execCommand: vi.fn(),
      createElement: vi.fn().mockReturnValue(mockElement),
      createTextNode: vi.fn().mockReturnValue({ nodeType: 3 }),
      body: { appendChild: vi.fn() },
      elementFromPoint: vi.fn().mockReturnValue(mockElement),
      dispatchEvent: vi.fn(),
    };

    // Mock window
    global.window = {
      getComputedStyle: vi.fn().mockReturnValue({ position: "static" }),
      getSelection: vi.fn().mockReturnValue({
        toString: vi.fn().mockReturnValue("selected text"),
        isCollapsed: false,
        rangeCount: 1,
        getRangeAt: vi.fn().mockReturnValue({
          getBoundingClientRect: vi.fn().mockReturnValue({ top: 100, left: 100 }),
          cloneRange: vi.fn().mockReturnValue({}),
          deleteContents: vi.fn(),
          insertNode: vi.fn(),
          collapse: vi.fn(),
        }),
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
      }),
      innerWidth: 1920,
      innerHeight: 1080,
    };

    contextMenu = new ContextMenu({ debug: false });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with default options", () => {
      const menu = new ContextMenu();
      expect(menu.options.enableTextContext).toBe(true);
      expect(menu.options.enableTabContext).toBe(true);
    });

    it("should merge custom options", () => {
      const menu = new ContextMenu({ enableTextContext: false });
      expect(menu.options.enableTextContext).toBe(false);
      expect(menu.options.enableTabContext).toBe(true);
    });
  });

  describe("init", () => {
    it("should initialize correctly when element is found", async () => {
      await contextMenu.init();
      expect(contextMenu.contextMenu).toBe(mockElement);
    });

    it("should initialize immediately when element exists", async () => {
      await contextMenu.init();
      expect(contextMenu.contextMenu).toBe(mockElement);
    });
  });

  describe("showTextContextMenu", () => {
    beforeEach(async () => {
      await contextMenu.init();
    });

    it("should show menu for editable text", () => {
      const mockEditable = { focus: vi.fn() };
      contextMenu.showTextContextMenu(mockEvent, mockEditable);

      expect(contextMenu.activeEditableElement).toBe(mockEditable);
      expect(mockElement.style.display).toBe("block");
    });

    it("saves caret range even when there is no text selection", () => {
      global.window.getSelection = vi.fn().mockReturnValue({
        toString: vi.fn().mockReturnValue(""),
        isCollapsed: true,
        rangeCount: 1,
        getRangeAt: vi.fn().mockReturnValue({
          cloneRange: vi.fn().mockReturnValue({ caret: true }),
        }),
      });

      const mockEditable = { focus: vi.fn() };
      contextMenu.showTextContextMenu(mockEvent, mockEditable);

      expect(contextMenu.activeSelection).toEqual({ caret: true });
    });
  });

  describe("hideContextMenu", () => {
    beforeEach(async () => {
      await contextMenu.init();
    });

    it("should hide the menu", () => {
      contextMenu.hideContextMenu();

      expect(mockElement.style.display).toBe("none");
    });
  });

  describe("handleTextAction", () => {
    beforeEach(async () => {
      await contextMenu.init();
      contextMenu.activeEditableElement = { focus: vi.fn() };
    });

    it("should execute copy command", () => {
      contextMenu.handleTextAction("copy");

      expect(global.document.execCommand).toHaveBeenCalledWith("copy", false, null);
    });

    it("should execute paste command using clipboard and insertText", async () => {
      global.navigator = {
        clipboard: { readText: vi.fn().mockResolvedValue("pasted text") },
      };
      contextMenu.activeEditableElement = { focus: vi.fn() };

      await contextMenu.handleTextAction("paste");

      expect(global.navigator.clipboard.readText).toHaveBeenCalled();
      expect(global.document.execCommand).toHaveBeenCalledWith("insertText", false, "pasted text");
    });
  });

  describe("showTabContextMenu", () => {
    beforeEach(async () => {
      await contextMenu.init();
    });

    it("Establece activeTabElement y oculta items de texto", () => {
      const mockTabLabel = {
        closest: vi.fn().mockReturnValue({
          classList: { contains: vi.fn().mockReturnValue(false) },
        }),
      };
      const mockTextItem = { dataset: { context: "text" }, style: {} };
      const mockTabItem = { dataset: { context: "tab" }, style: {} };
      const mockSeparator = { style: {} };

      mockElement.querySelectorAll = vi.fn((sel) => {
        if (sel === ".context-menu__item") return [mockTextItem, mockTabItem];
        if (sel === ".context-menu__separator") return [mockSeparator];
        return [];
      });

      contextMenu.showTabContextMenu(mockEvent, mockTabLabel);

      expect(contextMenu.activeTabElement).toBeTruthy();
      expect(mockTabItem.style.display).toBe("block");
      expect(mockTextItem.style.display).toBe("none");
      expect(mockSeparator.style.display).toBe("none");
    });
  });

  describe("showMenuAt", () => {
    beforeEach(async () => {
      await contextMenu.init();
    });

    it("Posiciona el menú en la posición dada", () => {
      mockElement.offsetWidth = 200;
      mockElement.offsetHeight = 300;
      window.innerWidth = 1920;
      window.innerHeight = 1080;

      contextMenu.showMenuAt(100, 200);

      expect(mockElement.style.display).toBe("block");
      expect(mockElement.style.left).toBe("100px");
      expect(mockElement.style.top).toBe("200px");
    });

    it("Ajusta posición si el menú se sale por la derecha", () => {
      mockElement.offsetWidth = 200;
      mockElement.offsetHeight = 100;
      window.innerWidth = 500;
      window.innerHeight = 1080;

      contextMenu.showMenuAt(400, 100);

      expect(mockElement.style.left).toBe("290px");
    });

    it("Ajusta posición si el menú se sale por abajo", () => {
      mockElement.offsetWidth = 200;
      mockElement.offsetHeight = 300;
      window.innerWidth = 1920;
      window.innerHeight = 500;

      contextMenu.showMenuAt(100, 400);

      expect(mockElement.style.top).toBe("190px");
    });
  });

  describe("handleMenuAction", () => {
    beforeEach(async () => {
      await contextMenu.init();
    });

    it("Ignora clicks en elementos disabled", () => {
      const hideSpy = vi.spyOn(contextMenu, "hideContextMenu");
      const mockMenuItem = { classList: { contains: vi.fn().mockReturnValue(true) } };
      contextMenu.handleMenuAction({ target: { closest: vi.fn().mockReturnValue(mockMenuItem) } });
      expect(hideSpy).not.toHaveBeenCalled();
    });

    it("Ejecuta acción pin-tab si activeTabElement existe", () => {
      const mockTabElement = {
        classList: { contains: vi.fn().mockReturnValue(false), add: vi.fn() },
        querySelector: vi.fn().mockReturnValue({ textContent: "test", dataset: {}, setAttribute: vi.fn() }),
      };
      contextMenu.activeTabElement = mockTabElement;
      const pinTabSpy = vi.spyOn(contextMenu, "handlePinTab");

      const mockMenuItem = {
        classList: { contains: vi.fn().mockReturnValue(false) },
        dataset: { action: "pin-tab" },
      };
      contextMenu.handleMenuAction({ target: { closest: vi.fn().mockReturnValue(mockMenuItem) } });

      expect(pinTabSpy).toHaveBeenCalledWith(mockTabElement);
    });

    it("Ejecuta acción de texto si activeEditableElement existe", () => {
      contextMenu.activeEditableElement = { focus: vi.fn() };
      const handleTextActionSpy = vi.spyOn(contextMenu, "handleTextAction");

      const mockMenuItem = {
        classList: { contains: vi.fn().mockReturnValue(false) },
        dataset: { action: "copy" },
      };
      contextMenu.handleMenuAction({ target: { closest: vi.fn().mockReturnValue(mockMenuItem) } });

      expect(handleTextActionSpy).toHaveBeenCalledWith("copy");
    });

    it("Oculta el menú después de ejecutar la acción", () => {
      contextMenu.activeEditableElement = { focus: vi.fn() };

      const mockMenuItem = {
        classList: { contains: vi.fn().mockReturnValue(false) },
        dataset: { action: "copy" },
      };
      contextMenu.handleMenuAction({ target: { closest: vi.fn().mockReturnValue(mockMenuItem) } });

      expect(mockElement.style.display).toBe("none");
    });
  });

  describe("setupContextMenu", () => {
    it("should add event listeners", async () => {
      await contextMenu.init();

      expect(global.document.addEventListener).toHaveBeenCalledWith("contextmenu", expect.any(Function));
      expect(global.document.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
    });
  });
});

describe("ContextualMenu - I18n Translations", () => {
  let i18n;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetI18n();
    vi.resetModules();
    const module = await import("../../../i18n/core.js");
    i18n = module.i18n;
  });

  describe("Translations in Spanish (es)", () => {
    beforeEach(() => {
      mockNavigatorLanguage("es-ES");
      i18n.init();
    });

    it('t("context-menu.copy") must be return "Copiar"', () => {
      expect(i18n.t("context-menu.copy")).toBe("Copiar");
    });

    it('t("context-menu.cut") must be return "Cortar"', () => {
      expect(i18n.t("context-menu.cut")).toBe("Cortar");
    });

    it('t("context-menu.paste") must be return "Pegar"', () => {
      expect(i18n.t("context-menu.paste")).toBe("Pegar");
    });

    it('t("context-menu.bold") must be return "Negrita"', () => {
      expect(i18n.t("context-menu.bold")).toBe("Negrita");
    });

    it('t("context-menu.italic") must be return "Itálica"', () => {
      expect(i18n.t("context-menu.italic")).toBe("Itálica");
    });

    it('t("context-menu.underline") must be return "Subrayado"', () => {
      expect(i18n.t("context-menu.underline")).toBe("Subrayado");
    });

    it('t("context-menu.undo") must be return "Deshacer"', () => {
      expect(i18n.t("context-menu.undo")).toBe("Deshacer");
    });

    it('t("context-menu.redo") must be return "Rehacer"', () => {
      expect(i18n.t("context-menu.redo")).toBe("Rehacer");
    });

    it('t("context-menu.pin-tab") must be return "Fijar Pestaña"', () => {
      expect(i18n.t("context-menu.pin-tab")).toBe("Fijar Pestaña");
    });

    it('t("context-menu.unpin-tab") must be return "Desfijar Pestaña"', () => {
      expect(i18n.t("context-menu.unpin-tab")).toBe("Desfijar Pestaña");
    });
  });

  describe("Translations in English (en)", () => {
    beforeEach(() => {
      mockNavigatorLanguage("en-US");
      i18n.init();
    });

    it('t("context-menu.copy") must be return "Copy"', () => {
      expect(i18n.t("context-menu.copy")).toBe("Copy");
    });

    it('t("context-menu.cut") must be return "Cut"', () => {
      expect(i18n.t("context-menu.cut")).toBe("Cut");
    });

    it('t("context-menu.paste") must be return "Paste"', () => {
      expect(i18n.t("context-menu.paste")).toBe("Paste");
    });

    it('t("context-menu.bold") must be return "Bold"', () => {
      expect(i18n.t("context-menu.bold")).toBe("Bold");
    });

    it('t("context-menu.italic") must be return "Italic"', () => {
      expect(i18n.t("context-menu.italic")).toBe("Italic");
    });

    it('t("context-menu.underline") must be return "Underline"', () => {
      expect(i18n.t("context-menu.underline")).toBe("Underline");
    });

    it('t("context-menu.undo") must be return "Undo"', () => {
      expect(i18n.t("context-menu.undo")).toBe("Undo");
    });

    it('t("context-menu.redo") must be return "Redo"', () => {
      expect(i18n.t("context-menu.redo")).toBe("Redo");
    });

    it('t("context-menu.pin-tab") must be return "Pin Tab"', () => {
      expect(i18n.t("context-menu.pin-tab")).toBe("Pin Tab");
    });

    it('t("context-menu.unpin-tab") must be return "Unpin Tab"', () => {
      expect(i18n.t("context-menu.unpin-tab")).toBe("Unpin Tab");
    });
  });

  describe("Keys should be different between languages", () => {
    it("context-menu.copy should be different in es vs en", () => {
      mockNavigatorLanguage("es-ES");
      i18n.init();
      const esCopy = i18n.t("context-menu.copy");

      i18n.setLang("en");
      const enCopy = i18n.t("context-menu.copy");

      expect(esCopy).not.toBe(enCopy);
      expect(esCopy).toBe("Copiar");
      expect(enCopy).toBe("Copy");
    });
  });
});
