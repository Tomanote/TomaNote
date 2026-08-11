// src/lib/scripts/entry.js
// Secure modular entry point for Notepad
import { devLogger } from "./utils/devLogger.js";

export async function initNotepad() {
  // Security check: only run in browser
  if (typeof window === "undefined" || typeof document === "undefined") {
    devLogger.warn("⚠️  Entorno no compatible (SSR o Node.js), omitiendo...");
    return;
  }

  try {
    // 1. Load CRITICAL functions first (those that need to be available immediately)
    await loadCriticalFunctions();

    // 2. Initialize basic components
    await initializeBasicComponents();

    // 3. Initial content height calculation (after tabs + floatingNav are ready)
    window.floatingNavPosition?.getContentHeight();

    // 4. Load additional (less critical) modules
    await loadOptionalModules();

    // 5. Verify that everything is working
    await verifyFunctionality();
  } catch (error) {
    // Attempt minimal functionality
    try {
      await emergencyFallback();
    } catch (fallbackError) {
      showErrorMessage();
    }
  }
}

// ===== CRITICAL FUNCTIONS (must be loaded first) =====
async function loadCriticalFunctions() {
  // 1. Initialize internationalization system
  const { i18n } = await import("../../i18n/core.js");
  i18n.init();

  // 2. Share client language with SSR (so that .astro components can use it)
  window.__I18N_CONFIG = { lang: i18n.getLang() };

  // 3. Load custom font (most critical part)
  const { FontManager } = await import("./core/fontManager.js");
  window.fontManager = new FontManager();
  window.fontManager.loadCustomFont();
  window.fontManager.loadFontSize();
  window.fontManager.initFontSettingsUI();

  // 3. Configure theme system (dark/light mode)
  await setupThemeSystem();

  // 4. Configure Service Worker if available
  setupServiceWorker();
}

async function setupThemeSystem() {
  try {
    // Load ThemeManager
    const { ThemeManager } = await import("./core/themeManager.js");
    window.themeManager = new ThemeManager();
    await window.themeManager.init();

    // For backward compatibility, keep the old toggle if it exists
    const oldDarkModeToggle = document.getElementById("dark-mode-toggle");
    if (oldDarkModeToggle) {
      // Synchronize initial state
      const isLightMode = window.themeManager.getCurrentTheme() === "light";
      oldDarkModeToggle.checked = isLightMode;

      // Manage changes from the old toggle
      oldDarkModeToggle.addEventListener("change", (e) => {
        window.themeManager.toggleLightMode(e.target.checked);
      });

      // Listen for theme changes to update the toggle
      window.addEventListener("themeChanged", (e) => {
        const isLight = e.detail.theme === "light";
        oldDarkModeToggle.checked = isLight;
      });
    }
  } catch (error) {
    // Fallback to the old system
    setupDarkModeFallback();
  }
}

function setupDarkModeFallback() {
  const darkModeToggle = document.getElementById("dark-mode-toggle");
  if (!darkModeToggle) return;

  const savedMode = localStorage.getItem("darkMode");
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (savedMode !== null) {
    document.documentElement.classList.toggle("light-mode", savedMode === "false");
    darkModeToggle.checked = savedMode === "false";
  } else if (!systemPrefersDark) {
    document.documentElement.classList.add("light-mode");
    darkModeToggle.checked = true;
  }

  darkModeToggle.addEventListener("change", (e) => {
    const isLightMode = e.target.checked;
    document.documentElement.classList.toggle("light-mode", isLightMode);
    localStorage.setItem("darkMode", !isLightMode);
  });
}

function setupServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((reg) => {})
        .catch((err) => {});
    });
  }
}

// ===== BASIC COMPONENTS =====
async function initializeBasicComponents() {
  // For now, we'll list them here as internal functions.
  await initializeTabsSystem();
  await initializeContextMenu();
  await initializeFloatingMenu();
  await initializeKeyboardShortcuts();
  await initializeTabDragDrop();
  await initializeSettingsModal();
  await initializeCloseTabConfirmation();
  await initializeCommandPalette();
  await initializeFloatingNavPosition();
  await initializeEditorSettings();
  await initializeKeyboardShortcutsHelp();
  await initializeSaveIndicator();
}

async function initializeTabsSystem() {
  try {
    // Import dynamically for better performance
    const { TabManager } = await import("./core/tabs.js");

    // Create an instance for feature flags
    window.tabManager = new TabManager({
      enablePersistence: true,
      enableCreation: true,
      enableEditing: true,
      enableDeletion: true,
      enablePinning: true,
      enableContentEditing: true,
      enableAutoSave: true,
      anchorSelector: "#tab-list-anchor",
      debug: true,
    });

    // Init
    await window.tabManager.init();

    // Replace the clasical event for the real for app
    const createTabBtn = document.getElementById("create-tab");
    if (createTabBtn) {
      createTabBtn.onclick = null; // Remove the before listener
    }
  } catch (error) {
    // Fallback to the method basic
    const createTabBtn = document.getElementById("create-tab");
    if (createTabBtn) {
      createTabBtn.addEventListener("click", () => {});
    }

    throw error;
  }
}

async function initializeContextMenu() {
  try {
    const { ContextMenu } = await import("../../features/contextual-menu/contextual-menu.js");

    // Create an instance
    window.contextMenu = new ContextMenu({
      enableTextContext: true,
      enableTabContext: true,
      enableMiddleClickClose: true,
      debug: true,
    });

    // Init
    await window.contextMenu.init();

    document.addEventListener(
      "contextmenu",
      (e) => {
        // IMPORTANT: just prvent if is in our areas
        const isContentEditable = e.target.closest(".tab-list__item--content");
        const isTabLabel = e.target.closest(".tab-list__item label");

        if (isContentEditable || isTabLabel) {
          e.preventDefault();
        }
      },
      true
    ); // Use capture: true for capture the event early

    return window.contextMenu;
  } catch (error) {
    // Minimum fallback
    document.addEventListener("contextmenu", (e) => {
      const isContentEditable = e.target.closest(".tab-list__item--content");
      const isTabLabel = e.target.closest(".tab-list__item label");

      if (isContentEditable || isTabLabel) {
        e.preventDefault();
      }
    });

    throw error;
  }
}

async function initializeFloatingMenu() {
  try {
    const { FloatingMenu } = await import("../../features/floating-menu/floating-menu.js");

    window.floatingMenu = new FloatingMenu({
      debug: true,
    });

    await window.floatingMenu.init();

    return window.floatingMenu;
  } catch (error) {
    devLogger.error("❌ Error inicializando FloatingMenu:", error);
  }
}

async function initializeKeyboardShortcuts() {
  try {
    const { KeyboardShortcuts } = await import("./ui/keyboardShortcuts.js");

    window.keyboardShortcuts = new KeyboardShortcuts({
      debug: true,
    });

    await window.keyboardShortcuts.init();

    return window.keyboardShortcuts;
  } catch (error) {
    devLogger.error("❌ Error inicializando KeyboardShortcuts:", error);
  }
}

async function initializeKeyboardShortcutsHelp() {
  try {
    const { KeyboardShortcutsHelp } = await import("../../features/keyboard-shortcuts-help/keyboard-shortcuts-help.js");

    window.keyboardShortcutsHelp = new KeyboardShortcutsHelp({
      debug: true,
    });

    await window.keyboardShortcutsHelp.init();

    return window.keyboardShortcutsHelp;
  } catch (error) {
    devLogger.error("❌ Error inicializando KeyboardShortcutsHelp:", error);
  }
}

async function initializeTabDragDrop() {
  try {
    const { TabDragDrop } = await import("./ui/tabDragDrop.js");

    window.tabDragDrop = new TabDragDrop({
      debug: true,
    });

    await window.tabDragDrop.init();

    return window.tabDragDrop;
  } catch (error) {
    devLogger.error("❌ Error inicializando TabDragDrop:", error);
  }
}

async function initializeSettingsModal() {
  try {
    const { SettingsModal } = await import("./ui/settingsModal.js");

    window.settingsModal = new SettingsModal({
      debug: true,
    });

    await window.settingsModal.init();

    return window.settingsModal;
  } catch (error) {
    devLogger.error("❌ Error inicializando SettingsModal:", error);
  }
}

async function initializeCloseTabConfirmation() {
  try {
    const { CloseTabConfirmation } = await import("../../features/close-tab-confirmation/close-tab-confirmation.js");

    window.closeTabConfirmationModal = new CloseTabConfirmation();
    await window.closeTabConfirmationModal.init();

    devLogger.log("[CloseTabConfirmation] Initialized");
  } catch (error) {
    devLogger.error("❌ Error inicializando CloseTabConfirmation:", error);
  }
}

async function initializeFloatingNavPosition() {
  try {
    const { FloatingNavPosition } = await import("./ui/floatingNavPosition.js");

    window.floatingNavPosition = new FloatingNavPosition();
    window.floatingNavPosition.init();
  } catch (error) {
    devLogger.error("❌ Error inicializando FloatingNavPosition:", error);
  }
}

async function initializeCommandPalette() {
  try {
    const { CommandPalette } = await import("../../features/command-palette/command-palette.js");

    window.commandPalette = new CommandPalette({
      debug: true,
    });

    await window.commandPalette.init();

    return window.commandPalette;
  } catch (error) {
    devLogger.error("❌ Error inicializando CommandPalette:", error);
  }
}

async function initializeEditorSettings() {
  try {
    const { EditorSettings } = await import("./core/editorSettings.js");

    window.editorSettings = new EditorSettings();
    window.editorSettings.init();
  } catch (error) {
    devLogger.error("❌ Error inicializando EditorSettings:", error);
  }
}

async function initializeSaveIndicator() {
  try {
    const { SaveIndicator } = await import("../../features/save-indicator/save-indicator.js");

    window.saveIndicator = new SaveIndicator({
      debug: true,
    });

    await window.saveIndicator.init();

    return window.saveIndicator;
  } catch (error) {
    devLogger.error("❌ Error inicializando SaveIndicator:", error);
  }
}

// ===== OPTIONAL MODULES =====
async function loadOptionalModules() {
  try {
    // Try load modules for utilites
    const utilsModule = await import("./utils/domHelpers.js");

    const emojiModule = await import("./utils/emojiDetector.js");

    // Here you can add mor improt dynamics
    import("./core/fontManager.js");
    import("./core/tabs.js");
    import("./core/themeManager.js");
    import("../../features/contextual-menu/contextual-menu.js");
    import("./utils/domHelpers.js");
    import("./utils/emojiDetector.js");
  } catch (error) {
    // return false
  }
}

// ===== VERIFICATIÓN & FALLBACK =====
async function verifyFunctionality() {
  // Verify critical elements
  const criticalElements = [".tab-list", "#create-tab", "#context-menu"];

  const missingElements = [];

  criticalElements.forEach((selector) => {
    if (!document.querySelector(selector)) {
      missingElements.push(selector);
    }
  });

  if (missingElements.length > 0) {
    // throw new Error(`Critical elements not found: ${missingElements.join(', ')}`);
  }

  // Verify localStorage
  if (typeof localStorage === "undefined") {
    throw new Error("localStorage no disponible");
  }
}

async function emergencyFallback() {
  // minmum Functionality for that the appdont break completaly

  // 1. Allow the creation of basic tabs
  const createTabBtn = document.getElementById("create-tab");
  if (createTabBtn) {
    createTabBtn.onclick = () => {
      alert(window.i18n?.t("error.emergency-alert") ?? "Emergency mode: Limited functionality. Please reload the page.");
    };
  }

  // 2. Basic Dark mode
  const darkModeToggle = document.getElementById("dark-mode-toggle");
  if (darkModeToggle) {
    darkModeToggle.onchange = (e) => {
      document.documentElement.classList.toggle("light-mode", e.target.checked);
    };
  }

  devLogger.log("🆘 Modo emergencia activado");
}

function showErrorMessage() {
  // Create a visible but non-intrusive error message
  const errorDiv = document.createElement("div");
  errorDiv.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #f44336;
    color: white;
    padding: 10px 15px;
    border-radius: 5px;
    z-index: 9999;
    font-family: sans-serif;
    font-size: 14px;
    max-width: 300px;
  `;
  errorDiv.innerHTML = `
    <strong>${window.i18n?.t("error.title") ?? "⚠️ Technical error"}</strong><br>
    ${window.i18n?.t("error.message") ?? "Some features may not be available."}<br>
    <small>${window.i18n?.t("error.hint") ?? "Try reloading the page."}</small>
  `;

  document.body.appendChild(errorDiv);

  // Create a visible but non-intrusive error message
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.parentNode.removeChild(errorDiv);
    }
  }, 10000);
}

// Export functions for debugging
export const debug = {
  test: () => {
    return "OK";
  },
  checkElements: () => {
    const elements = {
      tabList: document.querySelector(".tab-list"),
      createTab: document.getElementById("create-tab"),
      darkModeToggle: document.getElementById("dark-mode-toggle"),
      contextMenu: document.getElementById("context-menu"),
    };
    return elements;
  },
};
