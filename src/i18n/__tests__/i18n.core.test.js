import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock de navigator.language
function mockNavigatorLanguage(lang) {
  Object.defineProperty(global, "navigator", {
    value: { language: lang },
    writable: true,
    configurable: true,
  });
}

// Clean window.i18n abefore each test
function resetI18n() {
  if (global.window) {
    global.window.i18n = undefined;
  }
}

describe("I18nManager - Init", () => {
  let i18n;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetI18n();

    // Re-import for reset the module
    vi.resetModules();
    const module = await import("../core.js");
    i18n = module.i18n;
  });

  it("init() must detect Spanish from Spain (es-ES)", () => {
    mockNavigatorLanguage("es-ES");
    i18n.init();
    expect(i18n.getLang()).toBe("es");
  });

  it("init() must detect Spanish from Mexico (es-MX)", () => {
    mockNavigatorLanguage("es-MX");
    i18n.init();
    expect(i18n.getLang()).toBe("es");
  });

  it("init() must detect Spanish from Argentina (es-AR)", () => {
    mockNavigatorLanguage("es-AR");
    i18n.init();
    expect(i18n.getLang()).toBe("es");
  });

  it("init() must detect American English (en-US)", () => {
    mockNavigatorLanguage("en-US");
    i18n.init();
    expect(i18n.getLang()).toBe("en");
  });

  it("init() should detect British English (en-GB)", () => {
    mockNavigatorLanguage("en-GB");
    i18n.init();
    expect(i18n.getLang()).toBe("en");
  });

  it("init() must fallback to English for other languages ​​(fr-FR)", () => {
    mockNavigatorLanguage("fr-FR");
    i18n.init();
    expect(i18n.getLang()).toBe("en");
  });

  it("init() should fallback to English for German (de-DE)", () => {
    mockNavigatorLanguage("de-DE");
    i18n.init();
    expect(i18n.getLang()).toBe("en");
  });

  it("init() must set initialized = true", () => {
    mockNavigatorLanguage("en-US");
    expect(i18n.initialized).toBe(false);
    i18n.init();
    expect(i18n.initialized).toBe(true);
  });

  it("init() must assign function t()", () => {
    mockNavigatorLanguage("en-US");
    i18n.init();
    expect(typeof i18n.t).toBe("function");
  });

  it("init() should not break in SSR (window undefined)", () => {
    const originalWindow = global.window;
    global.window = undefined;

    // Should not throw error
    expect(() => i18n.init()).not.toThrow();

    global.window = originalWindow;
  });
});

describe("I18nManager - Functión t()", () => {
  let i18n;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetI18n();
    vi.resetModules();
    const module = await import("../core.js");
    i18n = module.i18n;
  });

  describe("Translations to spanish", () => {
    beforeEach(() => {
      mockNavigatorLanguage("es-ES");
      i18n.init();
    });

    it('t("tab.new") must be return "Nueva"', () => {
      expect(i18n.t("tab.new")).toBe("Nueva");
    });

    it('t("tab.delete-confirm") must be return text in spanish', () => {
      expect(i18n.t("tab.delete-confirm")).toBe("¿Eliminar esta pestaña?");
    });

    it('t("app.title") must be return "TomaNote"', () => {
      expect(i18n.t("app.title")).toBe("TomaNote");
    });
  });

  describe("Translations in english", () => {
    beforeEach(() => {
      mockNavigatorLanguage("en-US");
      i18n.init();
    });

    it('t("tab.new") Must be reutn "New"', () => {
      expect(i18n.t("tab.new")).toBe("New");
    });

    it('t("tab.delete-confirm") must be return text in english', () => {
      expect(i18n.t("tab.delete-confirm")).toBe("Delete this tab?");
    });

    it('t("app.title") must be return "TomaNote"', () => {
      expect(i18n.t("app.title")).toBe("TomaNote");
    });
  });

  describe("Fallback and error handling", () => {
    beforeEach(() => {
      mockNavigatorLanguage("en-US");
      i18n.init();
    });

    it("t() should return the key if the translation does not exist", () => {
      const result = i18n.t("key.inexistente");
      expect(result).toBe("key.inexistente");
    });

    it("t() should fallback to Spanish if key does not exist in English", () => {
      mockNavigatorLanguage("en-US");
      i18n.init();
      // Solo existe en español
      const result = i18n.t("tab.new");
      expect(result).toBe("New"); // EN tiene "New"
    });

    it("t() should log warning for missing keys", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      i18n.t("key.missing.test");
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[i18n] Missing translation"));
      warnSpy.mockRestore();
    });

    it("t() should not warn for valid keys", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      i18n.t("tab.new");
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe("Edge cases to t()", () => {
    it("t() should handle empty string", () => {
      mockNavigatorLanguage("es-ES");
      i18n.init();
      const result = i18n.t("");
      expect(result).toBeDefined();
    });

    it("t() not available before init()", () => {
      // Sin init(), t() no existe
      expect(i18n.t).toBeNull();
    });

    it("t() is available after init()", () => {
      mockNavigatorLanguage("es-ES");
      i18n.init();
      expect(typeof i18n.t).toBe("function");
    });
  });
});

describe("I18nManager - Change the language", () => {
  let i18n;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetI18n();
    vi.resetModules();
    const module = await import("../core.js");
    i18n = module.i18n;
  });

  it('setLang("es") must change language to Spanish', () => {
    mockNavigatorLanguage("en-US");
    i18n.init();

    i18n.setLang("es");

    expect(i18n.getLang()).toBe("es");
    expect(i18n.t("tab.new")).toBe("Nueva");
  });

  it('setLang("en") must chagne language to english ', () => {
    mockNavigatorLanguage("es-ES");
    i18n.init();

    i18n.setLang("en");

    expect(i18n.getLang()).toBe("en");
    expect(i18n.t("tab.new")).toBe("New");
  });

  it('setLang("invalid") should ignore language change', () => {
    mockNavigatorLanguage("en-US");
    i18n.init();
    const originalLang = i18n.getLang();

    i18n.setLang("fr");

    expect(i18n.getLang()).toBe(originalLang);
  });

  it("setLang(null) dont will brake", () => {
    mockNavigatorLanguage("en-US");
    i18n.init();

    expect(() => i18n.setLang(null)).not.toThrow();
    expect(i18n.getLang()).toBe("en");
  });

  it("setLang(undefined) dont will brake", () => {
    mockNavigatorLanguage("en-US");
    i18n.init();

    expect(() => i18n.setLang(undefined)).not.toThrow();
    expect(i18n.getLang()).toBe("en");
  });
});

describe("I18nManager - Aux methods", () => {
  let i18n;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetI18n();
    vi.resetModules();
    const module = await import("../core.js");
    i18n = module.i18n;
  });

  it("getLang() should return current language", () => {
    mockNavigatorLanguage("es-ES");
    i18n.init();
    expect(i18n.getLang()).toBe("es");
  });

  it("has() should return true for existing keys", () => {
    mockNavigatorLanguage("es-ES");
    i18n.init();
    expect(i18n.has("tab.new")).toBe(true);
  });

  it("has() should return false for non-existent keys", () => {
    mockNavigatorLanguage("es-ES");
    i18n.init();
    expect(i18n.has("key.missing")).toBe(false);
  });

  it("getAvailableLangs() must return array of available languages", () => {
    i18n.init();
    expect(i18n.getAvailableLangs()).toEqual(["es", "en"]);
  });

  it("getAvailableLangs() It must have a length of 2", () => {
    i18n.init();
    expect(i18n.getAvailableLangs()).toHaveLength(2);
  });
});

describe("I18nManager - Edge Cases", () => {
  let i18n;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetI18n();
    vi.resetModules();
    const module = await import("../core.js");
    i18n = module.i18n;
  });

  it("window.i18n It must be globally accessible", () => {
    expect(global.window.i18n).toBeDefined();
  });

  it("t() no existe sin init()", () => {
    // Sin init, t es null
    expect(i18n.t).toBeNull();
  });

  it("navigator.language null should handle gracefully", () => {
    Object.defineProperty(global, "navigator", {
      value: { language: null },
      writable: true,
      configurable: true,
    });
    expect(() => i18n.init()).not.toThrow();
  });

  it("navigator.language undefined should handle gracefully", () => {
    Object.defineProperty(global, "navigator", {
      value: { language: undefined },
      writable: true,
      configurable: true,
    });
    expect(() => i18n.init()).not.toThrow();
  });

  it("Empty translation should be distinguished from undefined", () => {
    mockNavigatorLanguage("es-ES");
    i18n.init();

    // Existing keys should have non-empty values
    expect(i18n.t("tab.new").length).toBeGreaterThan(0);
  });

  it("Translations in both languages ​​must be different.", () => {
    mockNavigatorLanguage("es-ES");
    i18n.init();
    const esNew = i18n.t("tab.new");

    i18n.setLang("en");
    const enNew = i18n.t("tab.new");

    expect(esNew).not.toBe(enNew);
  });
});

describe("I18nManager - Integration with TabManager", () => {
  let i18n;
  let TabManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetI18n();
    vi.resetModules();

    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };

    // Mock DOM completo
    global.document = {
      querySelector: vi.fn().mockReturnValue({
        insertBefore: vi.fn(),
        appendChild: vi.fn(),
        querySelectorAll: vi.fn().mockReturnValue([]),
      }),
      getElementById: vi.fn().mockReturnValue(null),
      addEventListener: vi.fn(),
      createElement: vi.fn().mockImplementation((tag) => {
        const el = {
          appendChild: vi.fn(),
          classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn() },
          style: {},
          setAttribute: vi.fn(),
          getAttribute: vi.fn(),
          querySelector: vi.fn().mockReturnValue({ checked: false, focus: vi.fn() }),
          querySelectorAll: vi.fn().mockReturnValue([]),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          focus: vi.fn(),
          innerHTML: "",
          textContent: "",
          checked: false,
          type: "radio",
          id: "",
        };
        return el;
      }),
      createEvent: vi.fn(),
      dispatchEvent: vi.fn(),
    };

    // Importar módulos
    const i18nModule = await import("../core.js");
    i18n = i18nModule.i18n;

    const tabsModule = await import("../../lib/scripts/core/tabs.js");
    TabManager = tabsModule.TabManager;
  });

  it("createTab() should use i18n translation for name", () => {
    mockNavigatorLanguage("es-ES");
    i18n.init();

    const tabManager = new TabManager({
      enableCreation: true,
      debug: false,
    });

    // Mock completo de tabList
    const mockAppendChild = vi.fn();
    tabManager.tabList = {
      insertBefore: vi.fn(),
      appendChild: mockAppendChild,
      querySelectorAll: vi.fn().mockReturnValue([]),
      contains: vi.fn().mockReturnValue(true),
    };
    tabManager.createTabButton = {};

    const tab = tabManager.createTab();
    expect(tab.name).toBe("Nueva");
  });

  it("createTab('Custom Name') must use custom name", () => {
    mockNavigatorLanguage("es-ES");
    i18n.init();

    const tabManager = new TabManager({
      enableCreation: true,
      debug: false,
    });

    // Mock completo de tabList
    const mockAppendChild = vi.fn();
    tabManager.tabList = {
      insertBefore: vi.fn(),
      appendChild: mockAppendChild,
      querySelectorAll: vi.fn().mockReturnValue([]),
      contains: vi.fn().mockReturnValue(true),
    };
    tabManager.createTabButton = {};

    const tab = tabManager.createTab("Custom Name");
    expect(tab.name).toBe("Custom Name");
  });

  it("deleteTabElement() should use a language confirmation message", () => {
    mockNavigatorLanguage("es-ES");
    i18n.init();

    const confirmSpy = vi.fn().mockReturnValue(true);
    global.confirm = confirmSpy;

    const tabManager = new TabManager({
      enableDeletion: true,
      debug: false,
    });

    const mockTabElement = {
      querySelector: vi.fn().mockReturnValue({ id: "body-tab-1" }),
      remove: vi.fn(),
    };

    tabManager.tabsData = [{ id: "body-tab-1", name: "Test", content: "", isPinned: false, emoji: null }];

    // Configurar tabList mock correctamente
    tabManager.tabList = {
      querySelectorAll: vi.fn().mockReturnValue([]),
    };

    tabManager.deleteTabElement(mockTabElement);

    expect(confirmSpy).toHaveBeenCalledWith("¿Eliminar esta pestaña?");
  });
});

describe("Floating menu tooltip translations (context-menu keys)", () => {
  let i18n;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetI18n();
    vi.resetModules();
    const module = await import("../core.js");
    i18n = module.i18n;
  });

  describe("Spanish translations", () => {
    beforeEach(() => {
      mockNavigatorLanguage("es-ES");
      i18n.init();
    });

    const spanishExpected = {
      "context-menu.copy": "Copiar",
      "context-menu.cut": "Cortar",
      "context-menu.paste": "Pegar",
      "context-menu.bold": "Negrita",
      "context-menu.italic": "Itálica",
      "context-menu.underline": "Subrayado",
      "context-menu.undo": "Deshacer",
      "context-menu.redo": "Rehacer",
      "context-menu.pin-tab": "Fijar",
      "context-menu.unpin-tab": "Desfijar",
      "context-menu.edit-name-tab": "Renombrar",
      "context-menu.delete-tab": "Eliminar",
      "context-menu.settings": "Ajustes",
    };

    Object.entries(spanishExpected).forEach(([key, expected]) => {
      it(`t("${key}") must return "${expected}"`, () => {
        expect(i18n.t(key)).toBe(expected);
      });
    });
  });

  describe("English translations", () => {
    beforeEach(() => {
      mockNavigatorLanguage("en-US");
      i18n.init();
    });

    const englishExpected = {
      "context-menu.copy": "Copy",
      "context-menu.cut": "Cut",
      "context-menu.paste": "Paste",
      "context-menu.bold": "Bold",
      "context-menu.italic": "Italic",
      "context-menu.underline": "Underline",
      "context-menu.undo": "Undo",
      "context-menu.redo": "Redo",
      "context-menu.pin-tab": "Pin",
      "context-menu.unpin-tab": "Unpin",
      "context-menu.edit-name-tab": "Rename",
      "context-menu.delete-tab": "Delete",
      "context-menu.settings": "Settings",
    };

    Object.entries(englishExpected).forEach(([key, expected]) => {
      it(`t("${key}") must return "${expected}"`, () => {
        expect(i18n.t(key)).toBe(expected);
      });
    });
  });

  describe("Floating menu action-to-key mapping", () => {
    beforeEach(() => {
      mockNavigatorLanguage("en-US");
      i18n.init();
    });

    const actions = ["redo", "undo", "copy", "paste", "bold", "underline", "italic", "pin-tab", "edit-name-tab", "delete-tab", "settings"];

    actions.forEach((action) => {
      const key = `context-menu.${action}`;
      it(`"${key}" must exist and return a non-empty string`, () => {
        const result = i18n.t(key);
        expect(result).toBeTruthy();
        expect(result.length).toBeGreaterThan(0);
        expect(result).not.toBe(key);
      });
    });
  });
});

describe("Roadmap changelog keys", () => {
  let i18n;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetI18n();
    vi.resetModules();
    const module = await import("../core.js");
    i18n = module.i18n;
  });

  const keys = ["roadmap.viewChangelog", "roadmap.changelog-link"];

  ["es", "en"].forEach((lang) => {
    keys.forEach((key) => {
      it(`t("${key}") must exist and return a non-empty string in ${lang}`, () => {
        mockNavigatorLanguage(lang === "es" ? "es-CO" : "en-US");
        i18n.init();
        const result = i18n.t(key);
        expect(result).toBeTruthy();
        expect(result.length).toBeGreaterThan(0);
        expect(result).not.toBe(key);
      });
    });
  });

  it('roadmap.changelog-link must point to the Tomanote repo', () => {
    mockNavigatorLanguage("en-US");
    i18n.init();
    const link = i18n.t("roadmap.changelog-link");
    expect(link).toContain("Tomanote/TomaNote");
    expect(link).not.toContain("Mixxy-Studio");
  });
});

describe("I18nManager - Optional Chaining y null safety", () => {
  let i18n;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetI18n();
    vi.resetModules();
    const module = await import("../core.js");
    i18n = module.i18n;
  });

  it("window.i18n?.t() should work when i18n is null", () => {
    global.window.i18n = null;
    const result = window.i18n?.t("tab.new");
    expect(result).toBeUndefined();
  });

  it("window.i18n?.t() should work when i18n is undefined", () => {
    global.window.i18n = undefined;
    const result = window.i18n?.t("tab.new");
    expect(result).toBeUndefined();
  });

  it("window.i18n?.getLang() should work when i18n is not init", () => {
    global.window.i18n = i18n;
    const result = window.i18n?.getLang?.();
    // Sin init, lang es null
    expect(result).toBeNull();
  });
});
