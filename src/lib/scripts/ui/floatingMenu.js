// src/lib/scripts/ui/floatingMenu.js
// Floating menu system - connects buttons to existing functions

import { FormattingUtils } from "../utils/formatting.js";
import { detectEmojiInText, getRandomPinEmoji } from "../utils/emojiDetector.js";
import { devLogger } from "../utils/devLogger.js";

export class FloatingMenu {
  constructor(options = {}) {
    this.options = {
      debug: true,
      ...options,
    };

    this.floatingMenu = null;
    this.tabList = null;
    this.toolsButton = null;
    this.savedSelection = null;
  }

  async init() {
    try {
      this.floatingMenu = await this.waitForElement(".tn-navbar");
      this.tabList = await this.waitForElement(".tab-list");
      this.toolsButton = document.getElementById("tn-tools-button");

      this.setupButtonHandlers();
      this.setupToolsButtonHandler();
      this.setupTabChangeListener();

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
      } else if (action === "search") {
        window.commandPalette?.open();
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
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(text));
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          } else {
            editable.focus();
            document.execCommand("insertText", false, text);
          }
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

    if (isPinned) {
      this.unpinTab(tabElement);
    } else {
      this.pinTab(tabElement);
    }

    this.log("📍 Pestaña" + (isPinned ? " desfijada" : " fijada"));
  }

  pinTab(tabElement) {
    const labelSpan = tabElement.querySelector("label span");
    const fallbackName = window.i18n?.t("tab.new") ?? "Nueva";
    const tabName = labelSpan?.textContent?.trim() || fallbackName;
    const emojiInText = detectEmojiInText(tabName);
    const emoji = emojiInText || getRandomPinEmoji();

    tabElement.classList.add("pinned");
    const label = tabElement.querySelector("label");
    if (label) label.setAttribute("data-emoji", emoji);
    if (labelSpan) labelSpan.setAttribute("data-emoji", emoji);

    if (window.tabManager && typeof window.tabManager.reorderTabs === "function") {
      window.tabManager.reorderTabs();
    }
    if (window.tabManager && typeof window.tabManager.saveTabs === "function") {
      window.tabManager.saveTabs();
    }
  }

  unpinTab(tabElement) {
    tabElement.classList.remove("pinned");
    const label = tabElement.querySelector("label");
    const labelSpan = tabElement.querySelector("label span");

    if (label) label.removeAttribute("data-emoji");
    if (labelSpan) labelSpan.removeAttribute("data-emoji");

    if (window.tabManager && typeof window.tabManager.reorderTabs === "function") {
      window.tabManager.reorderTabs();
    }
    if (window.tabManager && typeof window.tabManager.saveTabs === "function") {
      window.tabManager.saveTabs();
    }
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
    }

    this.log(`🔄 Estados actualizados - Tab activa: ${hasActiveTab}, Selección: ${hasTextSelection}`);
  }

  log(...args) {
    if (this.options.debug) {
      devLogger.log("[FloatingMenu]", ...args);
    }
  }
}
