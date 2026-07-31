import { describe, it, expect, beforeEach, vi } from "vitest";
import { ThemeManager } from "../themeManager.js";

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock;

describe("ThemeManager - Lógica Básica", () => {
  let themeManager;

  beforeEach(() => {
    vi.clearAllMocks();
    themeManager = new ThemeManager();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("light-mode");
  });

  it("Load theme saved in localStorage", () => {
    localStorageMock.getItem.mockReturnValue("dark");
    themeManager.loadSavedTheme();
    expect(themeManager.currentTheme).toBe("dark");
  });

  it("Use default theme if no save file is available", () => {
    localStorageMock.getItem.mockReturnValue(null);
    global.matchMedia = vi.fn().mockReturnValue({ matches: false });
    themeManager.loadSavedTheme();
    expect(themeManager.currentTheme).toBe("light");
  });

  it("Change theme correctly", () => {
    themeManager.switchTheme("cozy-rose");
    expect(themeManager.currentTheme).toBe("cozy-rose");
    expect(document.documentElement.getAttribute("data-theme")).toBe("cozy-rose");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("notepadTheme", "cozy-rose");
  });

  it("Returns a list of available themes", () => {
    const themes = themeManager.getThemes();
    expect(themes).toHaveLength(6);
    expect(themes[0]).toHaveProperty("id", "dark");
  });

  it("Returns current topic", () => {
    themeManager.currentTheme = "neon-orbit";
    expect(themeManager.getCurrentTheme()).toBe("neon-orbit");
  });
});

describe("ThemeManager - init", () => {
  let themeManager;

  beforeEach(() => {
    vi.clearAllMocks();
    themeManager = new ThemeManager();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("light-mode");
    localStorageMock.getItem.mockReturnValue("dark");
    global.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  it("Llama loadSavedTheme, applyTheme, setupEventListeners y setupAppearanceTab", async () => {
    const loadSpy = vi.spyOn(themeManager, "loadSavedTheme");
    const applySpy = vi.spyOn(themeManager, "applyTheme");
    const setupEventsSpy = vi.spyOn(themeManager, "setupEventListeners");
    const setupAppearanceSpy = vi.spyOn(themeManager, "setupAppearanceTab");

    await themeManager.init();

    expect(loadSpy).toHaveBeenCalled();
    expect(applySpy).toHaveBeenCalled();
    expect(setupEventsSpy).toHaveBeenCalled();
    expect(setupAppearanceSpy).toHaveBeenCalled();
  });

  it("Retorna this para chaining", async () => {
    const result = await themeManager.init();
    expect(result).toBe(themeManager);
  });
});

describe("ThemeManager - applyTheme", () => {
  let themeManager;

  beforeEach(() => {
    vi.clearAllMocks();
    themeManager = new ThemeManager();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("light-mode");
  });

  it("Establece data-theme en el html", () => {
    themeManager.applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("Agrega clase light-mode para tema light", () => {
    themeManager.applyTheme("light");
    expect(document.documentElement.classList.contains("light-mode")).toBe(true);
  });

  it("Remueve clase light-mode para otros temas", () => {
    document.documentElement.classList.add("light-mode");
    themeManager.applyTheme("dark");
    expect(document.documentElement.classList.contains("light-mode")).toBe(false);
  });

  it("Llama updateMetaThemeColor", () => {
    const spy = vi.spyOn(themeManager, "updateMetaThemeColor");
    themeManager.applyTheme("cozy-rose");
    expect(spy).toHaveBeenCalledWith("cozy-rose");
  });
});

describe("ThemeManager - switchTheme", () => {
  let themeManager;
  let dispatchSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    themeManager = new ThemeManager();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("light-mode");
    dispatchSpy = vi.fn();
    global.window.dispatchEvent = dispatchSpy;
    global.CustomEvent = class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    };
  });

  it("Cambia el tema y guarda en localStorage", () => {
    themeManager.switchTheme("chill-aqua");
    expect(themeManager.currentTheme).toBe("chill-aqua");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("notepadTheme", "chill-aqua");
  });

  it("No cambia tema con ID inválido", () => {
    themeManager.switchTheme("invalid-theme");
    expect(themeManager.currentTheme).toBe("dark");
  });

  it("Dispara evento themeChanged", () => {
    themeManager.switchTheme("neon-orbit");
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "themeChanged",
        detail: expect.objectContaining({ theme: "neon-orbit" }),
      })
    );
  });

  it("Aplica tema visualmente", () => {
    themeManager.switchTheme("wild-forest");
    expect(document.documentElement.getAttribute("data-theme")).toBe("wild-forest");
  });
});

describe("ThemeManager - updateMetaThemeColor", () => {
  let themeManager;

  beforeEach(() => {
    vi.clearAllMocks();
    themeManager = new ThemeManager();
    document.querySelectorAll = vi.fn(() => []);
    const existing = document.head.querySelector('meta[name="theme-color"]');
    if (existing) existing.remove();
  });

  it("Crea meta tag si no existe y setea content", () => {
    themeManager.updateMetaThemeColor("dark");

    const meta = document.head.querySelector('meta[name="theme-color"]');
    expect(meta).toBeTruthy();
    expect(meta.getAttribute("content")).toBe("#181A1B");
  });

  it("Actualiza content del meta tag existente", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", "old");
    document.head.appendChild(meta);

    themeManager.updateMetaThemeColor("cozy-rose");

    expect(meta.getAttribute("content")).toBe("#B85C80");
    meta.remove();
  });

  it("Usa dark como fallback para tema desconocido", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", "old");
    document.head.appendChild(meta);

    themeManager.updateMetaThemeColor("unknown-theme");

    expect(meta.getAttribute("content")).toBe("#181A1B");
    meta.remove();
  });
});

describe("ThemeManager - toggleDropdown / closeDropdown", () => {
  let themeManager;
  let mockDropdown;
  let mockToggleBtn;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    themeManager = new ThemeManager();

    mockDropdown = {
      style: { display: "none" },
      classList: { add: vi.fn(), remove: vi.fn() },
    };
    mockToggleBtn = {
      setAttribute: vi.fn(),
    };

    document.getElementById = vi.fn((id) => {
      if (id === "theme-dropdown") return mockDropdown;
      if (id === "theme-toggle-btn") return mockToggleBtn;
      return null;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("toggleDropdown abre el dropdown", () => {
    themeManager.toggleDropdown();

    expect(themeManager.isDropdownOpen).toBe(true);
    expect(mockDropdown.style.display).toBe("block");
    expect(mockToggleBtn.setAttribute).toHaveBeenCalledWith("aria-expanded", "true");
  });

  it("toggleDropdown cierra el dropdown después de abrir", () => {
    themeManager.isDropdownOpen = false;
    themeManager.toggleDropdown();
    themeManager.toggleDropdown();

    expect(themeManager.isDropdownOpen).toBe(false);
    expect(mockToggleBtn.setAttribute).toHaveBeenCalledWith("aria-expanded", "false");
  });

  it("closeDropdown cierra el dropdown", () => {
    themeManager.isDropdownOpen = true;
    themeManager.closeDropdown();

    expect(themeManager.isDropdownOpen).toBe(false);
    expect(mockDropdown.classList.remove).toHaveBeenCalledWith("show");
  });

  it("toggleDropdown no hace nada si no encuentra elementos", () => {
    document.getElementById = vi.fn(() => null);

    themeManager.toggleDropdown();

    expect(themeManager.isDropdownOpen).toBe(false);
  });
});

describe("ThemeManager - setupAppearanceTab", () => {
  let themeManager;

  beforeEach(() => {
    vi.clearAllMocks();
    themeManager = new ThemeManager();
    themeManager.currentTheme = "dark";
  });

  it("No hace nada si no hay radio buttons", () => {
    document.querySelectorAll = vi.fn(() => []);

    themeManager.setupAppearanceTab();

    expect(document.querySelectorAll).toHaveBeenCalledWith('input[name="themeColor"]');
  });

  it("Configura listeners change en los radio buttons", () => {
    const mockRadio1 = { id: "theme-color-dark", addEventListener: vi.fn() };
    const mockRadio2 = { id: "theme-color-light", addEventListener: vi.fn() };
    document.querySelectorAll = vi.fn(() => [mockRadio1, mockRadio2]);

    themeManager.setupAppearanceTab();

    expect(mockRadio1.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    expect(mockRadio2.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("Previene auto-scroll al hacer click en los labels de tema", () => {
    const mockRadio = {
      id: "theme-color-dark",
      checked: false,
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    const mockLabel = { addEventListener: vi.fn() };
    document.querySelectorAll = vi.fn(() => [mockRadio]);
    document.querySelector = vi.fn(() => mockLabel);

    themeManager.setupAppearanceTab();

    const clickHandler = mockLabel.addEventListener.mock.calls.find((c) => c[0] === "click")[1];
    const mockEvent = { preventDefault: vi.fn() };
    clickHandler(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockRadio.checked).toBe(true);
    expect(mockRadio.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "change", bubbles: true })
    );
  });
});

describe("ThemeManager - updateAppearanceTabUI", () => {
  let themeManager;

  beforeEach(() => {
    vi.clearAllMocks();
    themeManager = new ThemeManager();
  });

  it("Marca el radio correcto según el tema actual", () => {
    themeManager.currentTheme = "cozy-rose";
    const radio1 = { id: "theme-color-dark", checked: false };
    const radio2 = { id: "theme-color-rose", checked: false };
    document.querySelectorAll = vi.fn(() => [radio1, radio2]);

    themeManager.updateAppearanceTabUI();

    expect(radio1.checked).toBe(false);
    expect(radio2.checked).toBe(true);
  });
});

describe("ThemeManager - toggleLightMode", () => {
  let themeManager;

  beforeEach(() => {
    vi.clearAllMocks();
    themeManager = new ThemeManager();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("light-mode");
    global.window.dispatchEvent = vi.fn();
    global.CustomEvent = class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    };
    document.querySelectorAll = vi.fn(() => []);
  });

  it("Cambia a light si isLight es true", () => {
    themeManager.toggleLightMode(true);
    expect(themeManager.currentTheme).toBe("light");
  });

  it("Cambia a dark si isLight es false", () => {
    themeManager.toggleLightMode(false);
    expect(themeManager.currentTheme).toBe("dark");
  });
});

describe("ThemeManager - debug", () => {
  let themeManager;

  beforeEach(() => {
    vi.clearAllMocks();
    themeManager = new ThemeManager();
    localStorageMock.getItem.mockReturnValue("dark");
  });

  it("Retorna estructura de debug correcta", () => {
    const result = themeManager.debug();

    expect(result).toHaveProperty("currentTheme");
    expect(result).toHaveProperty("availableThemes");
    expect(result).toHaveProperty("savedTheme");
    expect(result).toHaveProperty("dataThemeAttr");
    expect(result).toHaveProperty("hasLightModeClass");
    expect(result.availableThemes).toHaveLength(6);
  });
});
