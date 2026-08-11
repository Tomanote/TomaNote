// src/features/floating-menu/floating-menu.js
// Floating menu system - connects buttons to existing functions

import { FormattingUtils } from "../../lib/scripts/utils/formatting.js";
import { devLogger } from "../../lib/scripts/utils/devLogger.js";

export class FloatingMenu {
  constructor(options = {}) {
    this.options = {
      debug: true,
      ...options,
    };

    this.floatingMenu = null;
    this.bottomBar = null;
    this.tabList = null;
    this.toolsButton = null;
    this.savedSelection = null;
  }

  async init() {
    try {
      this.floatingMenu = await this.waitForElement(".tn-navbar");
      this.tabList = await this.waitForElement(".tab-list");
      this.toolsButton = document.getElementById("tn-tools-button");

      // Bottom bar (mobile/tablet) — may not exist on desktop-only builds
      this.bottomBar = document.getElementById("bottom-bar");

      this.setupButtonHandlers();
      this.setupToolsButtonHandler();
      this.setupTabChangeListener();

      if (this.bottomBar) {
        this.setupBottomBarHandlers();
        this.log("✅ BottomBar vinculado al FloatingMenu");
      }

      this.log("✅ FloatingMenu inicializado");
      return this;
    } catch (error) {
      this.log("❌ Error inicializando FloatingMenu:", error);
      throw error;
    }
  }

  async waitForElement(selector, timeout = 3000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Elemento ${selector} no encontrado`));
      }, timeout);
    });
  }

  getActiveTab() {
    const checkedRadio = this.tabList?.querySelector('input[type="radio"]:checked');
    if (!checkedRadio) return null;
    return checkedRadio.closest(".tab-list__item");
  }

  getActiveEditable() {
    const activeTab = this.getActiveTab();
    return activeTab?.querySelector(".tab-list__item--content");
  }

  hasTextSelection() {
    const selection = window.getSelection();
    return selection && selection.toString().length > 0;
  }

  setupButtonHandlers() {
    this.floatingMenu.addEventListener("click", (e) => {
      const button = e.target.closest("button[data-floating-action]");
      if (!button) return;

      const action = button.dataset.floatingAction;

      if (action === "edit-name-tab" || action === "delete-tab" || action === "pin-tab") {
        const activeTab = this.getActiveTab();
        if (!activeTab) {
          this.log("⚠️ No hay pestaña activa para:", action);
          return;
        }

        if (action === "edit-name-tab") {
          this.handleEditNameTab(activeTab);
        } else if (action === "delete-tab") {
          this.handleDeleteTab(activeTab);
        } else if (action === "pin-tab") {
          this.handlePinTab(activeTab);
        }

        this.closeParentSubmenu(button);
      } else {
        this.handleTextAction(action, button);
      }
    });

    this.floatingMenu.addEventListener("mousedown", (e) => {
      const button = e.target.closest("button[data-floating-action]");
      if (!button) return;

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        this.savedSelection = selection.getRangeAt(0).cloneRange();
      }
    });
  }

  closeParentSubmenu(button) {
    const group = button.closest(".tn-horizontal-buttons");
    if (!group) return;

    const radio = group.querySelector('input[type="radio"]');
    if (radio && radio.checked) {
      radio.checked = false;
      this.log("🔒 Submenú cerrado");
    }
  }

  setupToolsButtonHandler() {
    const toolsButton = document.getElementById("tn-tools-button");
    if (toolsButton) {
      toolsButton.addEventListener("mousedown", (e) => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          this.savedSelection = selection.getRangeAt(0).cloneRange();
        }
      });

      toolsButton.addEventListener("click", () => {
        if (this.savedSelection) {
          setTimeout(() => {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(this.savedSelection);
            this.savedSelection = null;
          }, 0);
        }
      });
    }

    const submenuLabels = this.floatingMenu.querySelectorAll('label[for^="tn-open-options__"]');
    submenuLabels.forEach((label) => {
      label.addEventListener("mousedown", (e) => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          this.savedSelection = selection.getRangeAt(0).cloneRange();
        }
      });

      label.addEventListener("click", () => {
        if (this.savedSelection) {
          setTimeout(() => {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(this.savedSelection);
            this.savedSelection = null;
          }, 0);
        }
      });
    });

    this.log("🔧 Handler de Tools button configurado");
  }

  // ===========================================================================
  // Bottom bar handlers (mobile/tablet)
  // ===========================================================================

  setupBottomBarHandlers() {
    if (!this.bottomBar) return;

    // Delegate clicks on submenu trigger buttons
    this.bottomBar.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-submenu-trigger]");
      if (trigger) {
        e.preventDefault();
        this.toggleBottomBarSubmenu(trigger.dataset.submenuTrigger);
        return;
      }

      // Delegate clicks on submenu action buttons
      const actionButton = e.target.closest("button[data-floating-action]");
      if (actionButton) {
        const action = actionButton.dataset.floatingAction;
        this.handleBottomBarAction(action, actionButton);
        return;
      }

      // Create tab button
      const createBtn = e.target.closest("#bottom-bar-create-tab");
      if (createBtn) {
        const originalBtn = document.getElementById("create-tab");
        if (originalBtn) originalBtn.click();
      }
    });

    // Close submenus when tapping outside
    document.addEventListener("click", (e) => {
      if (!this.bottomBar.contains(e.target)) {
        this.closeBottomBarSubmenus();
      }
    });

    // Save selection before submenu interaction (same pattern as floating menu)
    this.bottomBar.addEventListener("mousedown", (e) => {
      const button = e.target.closest("button[data-floating-action]");
      if (!button) return;

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        this.savedSelection = selection.getRangeAt(0).cloneRange();
      }
    });

    this.log("📱 Bottom bar handlers configurados");
  }

  toggleBottomBarSubmenu(name) {
    const panel = this.bottomBar.querySelector(`[data-submenu-panel="submenu-${name}"]`);
    if (!panel) return;

    const isOpen = panel.classList.contains("tn-bottom-bar-submenu--open");

    // Close all first
    this.closeBottomBarSubmenus();

    // Toggle the target
    if (!isOpen) {
      panel.classList.add("tn-bottom-bar-submenu--open");
      panel.style.maxHeight = panel.scrollHeight + "px";
      this.log(`📱 Submenu abierto: ${name}`);
    }
  }

  closeBottomBarSubmenus() {
    if (!this.bottomBar) return;

    const panels = this.bottomBar.querySelectorAll(".tn-bottom-bar-submenu");
    panels.forEach((panel) => {
      panel.classList.remove("tn-bottom-bar-submenu--open");
      panel.style.maxHeight = "0";
    });
  }

  handleBottomBarAction(action, button) {
    if (action === "search") {
      window.commandPalette?.open();
      this.closeBottomBarSubmenus();
      this.log(`📝 Bottom bar acción ejecutada: ${action}`);
      return;
    }

    if (action === "settings") {
      document.querySelector("dialog#info-notepad")?.showModal();
      this.closeBottomBarSubmenus();
      this.log(`📝 Bottom bar acción ejecutada: ${action}`);
      return;
    }

    let savedRange = this.savedSelection;

    if (!savedRange) {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        savedRange = selection.getRangeAt(0).cloneRange();
      }
    }

    const editable = this.getActiveEditable();
    if (!editable) {
      this.log("⚠️ No hay editor de contenido activo (bottom bar)");
      return;
    }

    if (savedRange) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(savedRange);
      this.savedSelection = null;
    } else {
      editable.focus();
    }

    switch (action) {
      case "copy":
      case "cut":
        document.execCommand(action, false, null);
        break;

      case "paste":
        navigator.clipboard.readText().then((text) => {
          editable.focus();
          document.execCommand("insertText", false, text);
        });
        break;

      case "undo":
      case "redo":
        document.execCommand(action, false, null);
        break;

      case "bold":
        FormattingUtils.cycleBold();
        break;

      case "italic":
      case "underline":
        document.execCommand(action, false, null);
        break;

      case "edit-name-tab":
      case "delete-tab":
      case "pin-tab": {
        const activeTab = this.getActiveTab();
        if (!activeTab) return;

        if (action === "edit-name-tab") {
          this.handleEditNameTab(activeTab);
        } else if (action === "delete-tab") {
          this.handleDeleteTab(activeTab);
        } else if (action === "pin-tab") {
          this.handlePinTab(activeTab);
        }
        break;
      }

      default:
        this.log("⚠️ Acción desconocida (bottom bar):", action);
    }

    // Close submenu after action
    this.closeBottomBarSubmenus();

    this.log(`📝 Bottom bar acción ejecutada: ${action}`);
  }

  handleTextAction(action, button) {
    let savedRange = this.savedSelection;

    if (!savedRange) {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        savedRange = selection.getRangeAt(0).cloneRange();
      }
    }

    const editable = this.getActiveEditable();
    if (!editable) {
      this.log("⚠️ No hay editor de contenido activo");
      return;
    }

    if (savedRange) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(savedRange);
      this.savedSelection = null;
    } else {
      editable.focus();
    }

    switch (action) {
      case "copy":
      case "cut":
        document.execCommand(action, false, null);
        break;

      case "paste":
        navigator.clipboard.readText().then((text) => {
          editable.focus();
          document.execCommand("insertText", false, text);
        });
        break;

      case "undo":
      case "redo":
        document.execCommand(action, false, null);
        break;

      case "bold":
        FormattingUtils.cycleBold();
        break;

      case "italic":
      case "underline":
        document.execCommand(action, false, null);
        break;

      default:
        this.log("⚠️ Acción desconocida:", action);
    }

    if (button) {
      this.closeParentSubmenu(button);
    }

    this.log(`📝 Acción ejecutada: ${action}`);
  }

  handleEditNameTab(tabElement) {
    const editButton = tabElement.querySelector(".edit-name-tab");
    if (!editButton) {
      this.log("⚠️ Botón de edición no encontrado en la pestaña");
      return;
    }

    if (window.tabManager && typeof window.tabManager.startEditingTabName === "function") {
      window.tabManager.startEditingTabName(editButton);
      this.log("✏️ Editando nombre de pestaña");
    } else {
      this.log("⚠️ TabManager no disponible para editar nombre");
    }
  }

  handleDeleteTab(tabElement) {
    if (window.tabManager && typeof window.tabManager.deleteTabElement === "function") {
      window.tabManager.deleteTabElement(tabElement);
      this.log("🗑️ Eliminando pestaña");
    } else {
      this.log("⚠️ TabManager no disponible para eliminar pestaña");
    }
  }

  handlePinTab(tabElement) {
    const isPinned = tabElement.classList.contains("pinned");
    const method = isPinned ? "unpinTab" : "pinTab";

    if (window.tabManager && typeof window.tabManager[method] === "function") {
      window.tabManager[method](tabElement);
    } else {
      this.log("⚠️ TabManager no disponible para fijar/desfijar pestaña");
    }

    this.log("📍 Pestaña" + (isPinned ? " desfijada" : " fijada"));
  }

  setupTabChangeListener() {
    this.tabList?.addEventListener("change", (e) => {
      if (e.target.type === "radio") {
        this.updateButtonStates();
      }
    });

    document.addEventListener("tabsChanged", () => {
      this.updateButtonStates();
    });

    this.updateButtonStates();
  }

  updateButtonStates() {
    const activeTab = this.getActiveTab();
    const hasActiveTab = !!activeTab;
    const hasTextSelection = this.hasTextSelection();

    const tabActions = this.floatingMenu.querySelectorAll("[data-floating-action='edit-name-tab'], [data-floating-action='delete-tab']");

    tabActions.forEach((btn) => {
      if (hasActiveTab) {
        btn.classList.remove("disabled");
        btn.removeAttribute("disabled");
      } else {
        btn.classList.add("disabled");
        btn.setAttribute("disabled", "true");
      }
    });

    // Mobile: hide tools button when no tab active
    if (this.toolsButton) {
      if (hasActiveTab) {
        this.toolsButton.classList.remove("tn-tools-hidden");
        this.toolsButton.style.display = "";
      } else {
        this.toolsButton.classList.add("tn-tools-hidden");
        this.toolsButton.style.display = "none";
      }
    }

    // Desktop: hide tools container when no tab active
    const toolsContainer = this.floatingMenu?.querySelector(".tn-tools-container");
    if (toolsContainer) {
      toolsContainer.style.display = hasActiveTab ? "" : "none";
    }

    // Close sub-menus when no tab active
    if (!hasActiveTab) {
      const submenuRadios = this.floatingMenu?.querySelectorAll('input[type="radio"][name="options"]');
      submenuRadios?.forEach((radio) => (radio.checked = false));

      const mainCheckbox = document.getElementById("tn-open-options");
      if (mainCheckbox) mainCheckbox.checked = false;

      // Also close bottom bar submenus
      this.closeBottomBarSubmenus();
    }

    // Bottom bar: update tab-related button states
    if (this.bottomBar) {
      const bbTabActions = this.bottomBar.querySelectorAll("[data-floating-action='edit-name-tab'], [data-floating-action='delete-tab']");
      bbTabActions.forEach((btn) => {
        if (hasActiveTab) {
          btn.classList.remove("disabled");
          btn.removeAttribute("disabled");
        } else {
          btn.classList.add("disabled");
          btn.setAttribute("disabled", "true");
        }
      });
    }

    this.log(`🔄 Estados actualizados - Tab activa: ${hasActiveTab}, Selección: ${hasTextSelection}`);
  }

  log(...args) {
    if (this.options.debug) {
      devLogger.log("[FloatingMenu]", ...args);
    }
  }
}