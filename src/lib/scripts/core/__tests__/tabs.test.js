import { describe, it, expect, beforeEach, vi } from "vitest";
import { TabManager } from "../tabs.js";

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock;

// Mock window.i18n for deterministic tests
const i18nMock = {
  t: vi.fn((key) => {
    const translations = {
      "tab.new": "New",
      "tab.delete-confirm": "Delete this tab?",
      "tab.edit-name": "Edit name",
      "tab.delete": "Delete tab",
    };
    return translations[key] ?? key;
  }),
  getLang: vi.fn(() => "en"),
  has: vi.fn((key) => ["tab.new", "tab.delete-confirm"].includes(key)),
  initialized: true,
};
global.window = { i18n: i18nMock };

// Mock DOM elements
const mockTabList = {
  insertBefore: vi.fn(),
  querySelectorAll: vi.fn(() => []),
  querySelector: vi.fn(),
  contains: vi.fn(() => true),
  appendChild: vi.fn(),
};
const mockCreateTabButton = {};

function makeTabManager(overrides = {}) {
  const tm = new TabManager({
    enablePersistence: true,
    enableCreation: true,
    enableAutoSave: true,
    debug: false,
    ...overrides,
  });
  tm.tabList = { ...mockTabList, querySelectorAll: vi.fn(() => []), querySelector: vi.fn(), appendChild: vi.fn(), insertBefore: vi.fn(), contains: vi.fn(() => true) };
  tm.createTabButton = mockCreateTabButton;
  tm.createTabElement = vi.fn(() => {
    const div = document.createElement("div");
    const input = document.createElement("input");
    input.type = "radio";
    div.appendChild(input);
    const contentDiv = document.createElement("div");
    contentDiv.className = "tab-list__item--content";
    div.appendChild(contentDiv);
    return div;
  });
  return tm;
}

describe("TabManager - Lógica Básica", () => {
  let tabManager;

  beforeEach(() => {
    vi.clearAllMocks();
    i18nMock.t.mockClear();
    i18nMock.t.mockImplementation((key) => {
      const translations = {
        "tab.new": "New",
        "tab.delete-confirm": "Delete this tab?",
        "tab.edit-name": "Edit name",
        "tab.delete": "Delete tab",
      };
      return translations[key] ?? key;
    });

    tabManager = makeTabManager();
  });

  it("Crear una pestaña con datos por defecto", () => {
    const tab = tabManager.createTab();
    expect(tab.name).toBe("New");
    expect(tab.content).toBe("");
    expect(tab.id).toMatch(/^body-tab-\d+$/);
    expect(tab.updatedAt).toEqual(expect.any(Number));
  });

  it("Agregar pestañas al array interno", () => {
    tabManager.tabsData.push({ id: "1", name: "Nota 1", content: "", isPinned: false, emoji: null });
    tabManager.tabsData.push({ id: "2", name: "Nota 2", content: "", isPinned: false, emoji: null });
    expect(tabManager.getTabs()).toHaveLength(2);
  });

  it("Encontrar pestaña por ID", () => {
    const tab = { id: "test", name: "Test", content: "", isPinned: false, emoji: null };
    tabManager.tabsData.push(tab);
    expect(tabManager.findTabById("test")).toEqual(tab);
  });

  it("Retorna null si no encuentra pestaña por ID", () => {
    expect(tabManager.findTabById("nonexistent")).toBeUndefined();
  });

  it("Crear pestaña con nombre personalizado", () => {
    const tab = tabManager.createTab("Mi nota");
    expect(tab.name).toBe("Mi nota");
  });

  it("Crear pestaña con contenido y pinned", () => {
    const tab = tabManager.createTab("Pinned", "<p>contenido</p>", true, "📌");
    expect(tab.content).toBe("<p>contenido</p>");
    expect(tab.isPinned).toBe(true);
    expect(tab.emoji).toBe("📌");
  });

  it("No crear pestaña si enableCreation es false", () => {
    tabManager.options.enableCreation = false;
    const tab = tabManager.createTab("Test");
    expect(tab).toBeNull();
  });

  it("createTab incrementa tabIdCounter", () => {
    const initial = tabManager.tabIdCounter;
    tabManager.createTab();
    expect(tabManager.tabIdCounter).toBe(initial + 1);
  });

  it("createTab guarda en localStorage", () => {
    tabManager.createTab("Test");
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });
});

describe("TabManager - Eventos tabsChanged", () => {
  let tabManager;

  beforeEach(() => {
    vi.clearAllMocks();
    tabManager = makeTabManager({ enablePersistence: false, enableAutoSave: false });
  });

  it("createTab should dispatch tabsChanged event", () => {
    const dispatchSpy = vi.spyOn(document, "dispatchEvent");
    tabManager.createTab("Test Tab");
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "tabsChanged" }));
  });

  it("deleteTabElement should delegate to deletionHandler", async () => {
    const deleteTabElementSpy = vi.spyOn(tabManager.deletionHandler, "deleteTabElement");
    const mockTabElement = { foo: "bar" };
    await tabManager.deleteTabElement(mockTabElement);
    expect(deleteTabElementSpy).toHaveBeenCalledWith(mockTabElement);
  });
});

describe("TabManager - saveTabs", () => {
  let tabManager;

  beforeEach(() => {
    vi.clearAllMocks();
    tabManager = makeTabManager();
  });

  it("Guarda datos de las pestañas en localStorage", () => {
    const mockItem1 = {
      querySelector: vi.fn((sel) => {
        if (sel === ".tab-list__item--content") return { innerHTML: "<p>contenido 1</p>" };
        if (sel === "input") return { id: "body-tab-1" };
        if (sel === "label span") return { textContent: "Nota 1", dataset: {} };
        return null;
      }),
      classList: { contains: vi.fn().mockReturnValue(false) },
    };
    const mockItem2 = {
      querySelector: vi.fn((sel) => {
        if (sel === ".tab-list__item--content") return { innerHTML: "<p>contenido 2</p>" };
        if (sel === "input") return { id: "body-tab-2" };
        if (sel === "label span") return { textContent: "Nota 2", dataset: { emoji: "📌" } };
        return null;
      }),
      classList: { contains: vi.fn().mockReturnValue(true) },
    };

    tabManager.tabList.querySelectorAll = vi.fn(() => [mockItem1, mockItem2]);
    tabManager.saveTabs();

    expect(localStorageMock.setItem).toHaveBeenCalledWith("tabsData", expect.any(String));
    const saved = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
    expect(saved).toHaveLength(2);
    expect(saved[0].id).toBe("body-tab-1");
    expect(saved[0].name).toBe("Nota 1");
    expect(saved[0].isPinned).toBe(false);
    expect(saved[0].updatedAt).toEqual(expect.any(Number));
    expect(saved[1].isPinned).toBe(true);
    expect(saved[1].emoji).toBe("📌");
    expect(saved[1].updatedAt).toEqual(expect.any(Number));
  });

  it("Preserva updatedAt existente de cada pestaña al guardar", () => {
    tabManager.tabsData = [{ id: "body-tab-1", updatedAt: 111 }, { id: "body-tab-2", updatedAt: 222 }];

    const mockItem1 = {
      querySelector: vi.fn((sel) => {
        if (sel === ".tab-list__item--content") return { innerHTML: "<p>contenido 1</p>" };
        if (sel === "input") return { id: "body-tab-1" };
        if (sel === "label span") return { textContent: "Nota 1", dataset: {} };
        return null;
      }),
      classList: { contains: vi.fn().mockReturnValue(false) },
    };
    const mockItem2 = {
      querySelector: vi.fn((sel) => {
        if (sel === ".tab-list__item--content") return { innerHTML: "<p>contenido 2</p>" };
        if (sel === "input") return { id: "body-tab-2" };
        if (sel === "label span") return { textContent: "Nota 2", dataset: {} };
        return null;
      }),
      classList: { contains: vi.fn().mockReturnValue(false) },
    };

    tabManager.tabList.querySelectorAll = vi.fn(() => [mockItem1, mockItem2]);
    tabManager.saveTabs();

    const saved = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
    expect(saved[0].updatedAt).toBe(111);
    expect(saved[1].updatedAt).toBe(222);
  });

  it("No guarda si autoSave y persistence están deshabilitados", () => {
    tabManager.options.enableAutoSave = false;
    tabManager.options.enablePersistence = false;
    tabManager.saveTabs();
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });

  it("Guarda un array vacío si no hay pestañas", () => {
    tabManager.tabList.querySelectorAll = vi.fn(() => []);
    tabManager.saveTabs();
    expect(localStorageMock.setItem).toHaveBeenCalledWith("tabsData", "[]");
  });
});

describe("TabManager - markTabUpdated", () => {
  let tabManager;

  beforeEach(() => {
    vi.clearAllMocks();
    tabManager = makeTabManager();
  });

  it("Actualiza updatedAt solo de la pestaña editada", () => {
    tabManager.tabsData = [
      { id: "body-tab-1", name: "A", updatedAt: 1000 },
      { id: "body-tab-2", name: "B", updatedAt: 2000 },
    ];

    const contentElement = {
      closest: vi.fn(() => ({
        querySelector: vi.fn(() => ({ id: "body-tab-1" })),
      })),
    };

    tabManager.markTabUpdated(contentElement);

    expect(tabManager.tabsData[0].updatedAt).not.toBe(1000);
    expect(tabManager.tabsData[0].updatedAt).toEqual(expect.any(Number));
    expect(tabManager.tabsData[1].updatedAt).toBe(2000);
  });

  it("No hace nada si el elemento no pertenece a una pestaña", () => {
    const contentElement = { closest: vi.fn(() => null) };
    expect(() => tabManager.markTabUpdated(contentElement)).not.toThrow();
  });

  it("No actualiza si la pestaña no existe en tabsData", () => {
    const contentElement = {
      closest: vi.fn(() => ({
        querySelector: vi.fn(() => ({ id: "body-tab-99" })),
      })),
    };
    expect(() => tabManager.markTabUpdated(contentElement)).not.toThrow();
  });
});

describe("TabManager - restoreTabs", () => {
  let tabManager;

  beforeEach(() => {
    vi.clearAllMocks();
    tabManager = makeTabManager();
  });

  it("Restaura pestañas desde localStorage", () => {
    const savedTabs = [
      { id: "body-tab-1", name: "Nota 1", content: "<p>hola</p>", isPinned: false, emoji: null },
      { id: "body-tab-2", name: "Nota 2", content: "", isPinned: true, emoji: "📌" },
    ];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedTabs));
    tabManager.tabList.querySelectorAll = vi.fn(() => []);

    tabManager.restoreTabs();

    expect(tabManager.tabsData).toEqual(savedTabs);
    expect(tabManager.createTabElement).toHaveBeenCalledTimes(2);
  });

  it("Restaura array vacío si no hay datos guardados", () => {
    localStorageMock.getItem.mockReturnValue(null);
    tabManager.tabList.querySelectorAll = vi.fn(() => []);

    tabManager.restoreTabs();

    expect(tabManager.tabsData).toEqual([]);
    expect(tabManager.createTabElement).not.toHaveBeenCalled();
  });

  it("Restaura array vacío si JSON está corrupto", () => {
    localStorageMock.getItem.mockReturnValue("{invalid json");
    tabManager.tabList.querySelectorAll = vi.fn(() => []);

    tabManager.restoreTabs();

    expect(tabManager.tabsData).toEqual([]);
  });

  it("Elimina elementos DOM existentes antes de restaurar", () => {
    const removeFn = vi.fn();
    const existingItems = [{ remove: removeFn }, { remove: removeFn }];
    localStorageMock.getItem.mockReturnValue("[]");
    tabManager.tabList.querySelectorAll = vi.fn(() => existingItems);

    tabManager.restoreTabs();

    expect(removeFn).toHaveBeenCalledTimes(2);
  });
});

describe("TabManager - createTabElement", () => {
  let tabManager;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(undefined);
    tabManager = makeTabManager();
    // Restore real createTabElement
    tabManager.createTabElement = TabManager.prototype.createTabElement;
  });

  it("Crea un elemento con la estructura correcta", () => {
    const tabData = { id: "body-tab-1", name: "Mi Nota", content: "<p>contenido</p>", isPinned: false, emoji: null };
    const element = tabManager.createTabElement(tabData);

    expect(element.classList.contains("tab-list__item")).toBe(true);
    const radio = element.querySelector("input[type='radio']");
    expect(radio).toBeTruthy();
    expect(radio.id).toBe("body-tab-1");
    const span = element.querySelector("label span");
    expect(span.textContent).toBe("Mi Nota");
    const content = element.querySelector(".tab-list__item--content");
    expect(content.innerHTML).toBe("<div><p>contenido</p></div>");
  });

  it("Agrega clase pinned si isPinned es true", () => {
    const tabData = { id: "body-tab-2", name: "Fija", content: "", isPinned: true, emoji: "📌" };
    const element = tabManager.createTabElement(tabData);

    expect(element.classList.contains("pinned")).toBe(true);
    const label = element.querySelector("label");
    expect(label.getAttribute("data-emoji")).toBe("📌");
  });

  it("No agrega data-emoji si emoji es null", () => {
    const tabData = { id: "body-tab-3", name: "Sin emoji", content: "", isPinned: false, emoji: null };
    const element = tabManager.createTabElement(tabData);

    const label = element.querySelector("label");
    expect(label.getAttribute("data-emoji")).toBeNull();
  });

  it("Inserta antes de tabAnchor si existe", () => {
    const mockAnchor = { id: "tab-list-anchor" };
    tabManager.tabAnchor = mockAnchor;
    tabManager.tabList.contains = vi.fn(() => true);

    const tabData = { id: "body-tab-1", name: "Test", content: "", isPinned: false, emoji: null };
    tabManager.createTabElement(tabData);

    expect(tabManager.tabList.insertBefore).toHaveBeenCalledWith(expect.anything(), mockAnchor);
  });

  it("Inserta antes de createTabButton si no hay anchor", () => {
    tabManager.tabAnchor = null;
    tabManager.tabList.contains = vi.fn(() => true);

    const tabData = { id: "body-tab-1", name: "Test", content: "", isPinned: false, emoji: null };
    tabManager.createTabElement(tabData);

    expect(tabManager.tabList.insertBefore).toHaveBeenCalledWith(expect.anything(), mockCreateTabButton);
  });

  it("Usa appendChild como fallback si no hay referencia válida", () => {
    tabManager.tabAnchor = null;
    tabManager.tabList.contains = vi.fn(() => false);

    const tabData = { id: "body-tab-1", name: "Test", content: "", isPinned: false, emoji: null };
    tabManager.createTabElement(tabData);

    expect(tabManager.tabList.appendChild).toHaveBeenCalled();
  });

  it("Aplica ajustes guardados (stretch, bg, font-size) a la nueva pestaña", () => {
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === "editorWidth") return "stretch";
      if (key === "editorBackground") return "underline";
      if (key === "fontSize") return "medium";
      return undefined;
    });

    const tabData = { id: "body-tab-1", name: "Nota", content: "", isPinned: false, emoji: null };
    const element = tabManager.createTabElement(tabData);

    const innerDiv = element.querySelector(".tab-list__item--content > div");
    const contentDiv = element.querySelector(".tab-list__item--content");
    expect(innerDiv.classList.contains("stretch")).toBe(true);
    expect(contentDiv.classList.contains("bg-underline")).toBe(true);
    expect(contentDiv.classList.contains("medium-text")).toBe(true);
  });

  it("No aplica clases si localStorage no tiene ajustes", () => {
    localStorageMock.getItem.mockReturnValue(undefined);

    const tabData = { id: "body-tab-1", name: "Nota", content: "", isPinned: false, emoji: null };
    const element = tabManager.createTabElement(tabData);

    const innerDiv = element.querySelector(".tab-list__item--content > div");
    const contentDiv = element.querySelector(".tab-list__item--content");
    expect(innerDiv.classList.contains("stretch")).toBe(false);
    expect(contentDiv.classList.contains("bg-underline")).toBe(false);
    expect(contentDiv.classList.contains("medium-text")).toBe(false);
  });

  it("Ignora tamaño de fuente inválido", () => {
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === "fontSize") return "huge";
      return undefined;
    });

    const tabData = { id: "body-tab-1", name: "Nota", content: "", isPinned: false, emoji: null };
    const element = tabManager.createTabElement(tabData);

    const contentDiv = element.querySelector(".tab-list__item--content");
    expect(contentDiv.classList.contains("huge-text")).toBe(false);
  });
});

describe("TabManager - reorderTabs", () => {
  let tabManager;

  beforeEach(() => {
    vi.clearAllMocks();
    tabManager = makeTabManager();
  });

  it("Pone pestañas pinned primero, luego normales", () => {
    const pinnedTab = { classList: { contains: (c) => c === "pinned" }, remove: vi.fn() };
    const normalTab = { classList: { contains: () => false }, remove: vi.fn() };
    tabManager.tabList.querySelectorAll = vi.fn(() => [normalTab, pinnedTab]);
    tabManager.tabAnchor = { id: "anchor" };
    tabManager.tabList.contains = vi.fn(() => true);

    tabManager.reorderTabs();

    expect(pinnedTab.remove).toHaveBeenCalled();
    expect(normalTab.remove).toHaveBeenCalled();
    expect(tabManager.tabList.insertBefore).toHaveBeenCalledTimes(2);
    expect(tabManager.tabList.insertBefore.mock.calls[0][0]).toBe(pinnedTab);
    expect(tabManager.tabList.insertBefore.mock.calls[1][0]).toBe(normalTab);
  });

  it("Usa appendChild como fallback si no hay referencia", () => {
    const pinnedTab = { classList: { contains: (c) => c === "pinned" }, remove: vi.fn() };
    const normalTab = { classList: { contains: () => false }, remove: vi.fn() };
    tabManager.tabList.querySelectorAll = vi.fn(() => [pinnedTab, normalTab]);
    tabManager.tabAnchor = null;
    tabManager.tabList.contains = vi.fn(() => false);

    tabManager.reorderTabs();

    expect(tabManager.tabList.appendChild).toHaveBeenCalledTimes(2);
  });
});

describe("TabManager - updateTabIds", () => {
  let tabManager;

  beforeEach(() => {
    vi.clearAllMocks();
    tabManager = makeTabManager();
  });

  it("Renombra IDs de pestañas secuencialmente", () => {
    const input1 = { id: "body-tab-5" };
    const input2 = { id: "body-tab-10" };
    const label1 = { setAttribute: vi.fn() };
    const label2 = { setAttribute: vi.fn() };

    const item1 = { querySelector: vi.fn((sel) => sel === "input" ? input1 : label1) };
    const item2 = { querySelector: vi.fn((sel) => sel === "input" ? input2 : label2) };

    tabManager.tabList.querySelectorAll = vi.fn(() => [item1, item2]);

    tabManager.updateTabIds();

    expect(input1.id).toBe("body-tab-1");
    expect(label1.setAttribute).toHaveBeenCalledWith("for", "body-tab-1");
    expect(input2.id).toBe("body-tab-2");
    expect(label2.setAttribute).toHaveBeenCalledWith("for", "body-tab-2");
  });
});

describe("TabManager - updateTabIdCounter", () => {
  let tabManager;

  beforeEach(() => {
    vi.clearAllMocks();
    tabManager = makeTabManager();
  });

  it("Establece counter al número más alto + 1", () => {
    const input1 = { id: "body-tab-3" };
    const input2 = { id: "body-tab-7" };
    const item1 = { querySelector: vi.fn(() => input1) };
    const item2 = { querySelector: vi.fn(() => input2) };

    tabManager.tabList.querySelectorAll = vi.fn(() => [item1, item2]);
    tabManager.tabIdCounter = 1;

    tabManager.updateTabIdCounter();

    expect(tabManager.tabIdCounter).toBe(8);
  });

  it("No cambia counter si no hay pestañas", () => {
    tabManager.tabList.querySelectorAll = vi.fn(() => []);
    tabManager.tabIdCounter = 5;

    tabManager.updateTabIdCounter();

    expect(tabManager.tabIdCounter).toBe(5);
  });
});

describe("TabManager - debug", () => {
  let tabManager;

  beforeEach(() => {
    vi.clearAllMocks();
    tabManager = makeTabManager();
  });

  it("Retorna estructura de debug correcta", () => {
    tabManager.tabsData = [{ id: "1" }, { id: "2" }];
    tabManager.tabIdCounter = 3;

    const result = tabManager.debug();

    expect(result.tabsCount).toBe(2);
    expect(result.tabIdCounter).toBe(3);
    expect(result.options).toBeDefined();
    expect(result.elements.tabList).toBe(true);
    expect(result.elements.createTabButton).toBe(true);
  });
});

describe("TabManager - pinTab / unpinTab", () => {
  let tabManager;

  beforeEach(() => {
    vi.clearAllMocks();
    tabManager = makeTabManager({ enablePinning: true });
  });

  it("pinTab agrega clase pinned y data-emoji", () => {
    const label = { setAttribute: vi.fn() };
    const labelSpan = { setAttribute: vi.fn() };
    const tabElement = {
      classList: { add: vi.fn() },
      querySelector: vi.fn((sel) => {
        if (sel === "label") return label;
        if (sel === "label span") return labelSpan;
        return null;
      }),
    };

    tabManager.pinTab(tabElement, "🔴");

    expect(tabElement.classList.add).toHaveBeenCalledWith("pinned");
    expect(label.setAttribute).toHaveBeenCalledWith("data-emoji", "🔴");
    expect(labelSpan.setAttribute).toHaveBeenCalledWith("data-emoji", "🔴");
  });

  it("unpinTab remueve clase pinned y data-emoji", () => {
    const label = { removeAttribute: vi.fn() };
    const labelSpan = { removeAttribute: vi.fn() };
    const tabElement = {
      classList: { remove: vi.fn() },
      querySelector: vi.fn((sel) => {
        if (sel === "label") return label;
        if (sel === "label span") return labelSpan;
        return null;
      }),
    };

    tabManager.unpinTab(tabElement);

    expect(tabElement.classList.remove).toHaveBeenCalledWith("pinned");
    expect(label.removeAttribute).toHaveBeenCalledWith("data-emoji");
    expect(labelSpan.removeAttribute).toHaveBeenCalledWith("data-emoji");
  });

  it("pinTab no hace nada si enablePinning es false", () => {
    tabManager.options.enablePinning = false;
    const tabElement = {
      classList: { add: vi.fn() },
      querySelector: vi.fn(() => null),
    };

    tabManager.pinTab(tabElement, "🔴");

    expect(tabElement.classList.add).not.toHaveBeenCalledWith("pinned");
  });
});

describe("TabManager - startEditingTabName", () => {
  let tabManager;

  beforeEach(() => {
    vi.clearAllMocks();
    tabManager = makeTabManager();

    const selection = {
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
    };
    global.window.getSelection = vi.fn(() => selection);
  });

  it("Agrega clase editing y activa contenteditable al iniciar edición", () => {
    const span = document.createElement("span");
    span.textContent = "Nota larga que se recorta";
    const label = document.createElement("label");
    label.appendChild(span);
    const editButton = document.createElement("button");
    label.appendChild(editButton);
    const tabItem = document.createElement("div");
    tabItem.className = "tab-list__item";
    tabItem.appendChild(label);

    tabManager.startEditingTabName(editButton);

    expect(span.classList.contains("editing")).toBe(true);
    expect(label.getAttribute("contenteditable")).toBe("true");
  });
});
