// src/features/contextual-menu/contextual-menu.js
// Context menu system for text and tabs

import { detectEmojiInText, getRandomPinEmoji } from "../../lib/scripts/utils/emojiDetector.js";
import { FormattingUtils } from "../../lib/scripts/utils/formatting.js";

export class ContextMenu {
  constructor(options = {}) {
    this.options = {
      enableTextContext: true,
      enableTabContext: true,
      enableMiddleClickClose: true,
      debug: true,
      ...options,
    };

    this.contextMenu = null;
    this.activeEditableElement = null;
    this.activeSelection = null;
    this.activeTabElement = null;
  }

  async init() {
    try {
      // 1. Find the menu item
      this.contextMenu = await this.waitForElement("#context-menu");

      // 2. Configure according to flags
      if (this.options.enableTextContext || this.options.enableTabContext) {
        this.setupContextMenu();
      }

      return this;
    } catch (error) {
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

  setupContextMenu() {
    // Do not add listener on touch (mobile) devices
    if ("ontouchstart" in window) {
      this.log("📱 Menú contextual deshabilitado en mobile");
      return;
    }

    // Show context menu on right click
    document.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.handleContextMenu(e);
    });

    // Hide menu on click
    document.addEventListener("click", () => {
      this.hideContextMenu();
    });

    // Manage menu actions
    this.contextMenu.addEventListener("click", (e) => {
      this.handleMenuAction(e);
    });
  }

  handleContextMenu(e) {
    const target = e.target;

    // Check if it is editable content
    const isContentEditable = target.closest(".tab-list__item--content");

    // Check if it's a tab label
    const isTabLabel = target.closest(".tab-list__item label");

    if (isContentEditable && this.options.enableTextContext) {
      this.showTextContextMenu(e, isContentEditable);
    } else if (isTabLabel && this.options.enableTabContext) {
      this.showTabContextMenu(e, isTabLabel);
    }
  }

  showTextContextMenu(e, editableElement) {
    // Save the active editable element
    this.activeEditableElement = editableElement;

    // Check if there is text selection
    const selection = window.getSelection();
    const hasSelection = selection.toString().length > 0;

    // Save the caret/selection range so paste and commands respect it
    if (selection.rangeCount > 0) {
      this.activeSelection = selection.getRangeAt(0).cloneRange();
    }

    // Show/hide options based on context
    this.contextMenu.querySelectorAll(".context-menu__item").forEach((item) => {
      if (item.dataset.requiresSelection === "true") {
        item.classList.toggle("disabled", !hasSelection);
      }

      if (item.dataset.context === "tab") {
        item.style.display = "none";
      } else {
        item.style.display = "block";
      }
    });

    // Mostrar separadores
    this.contextMenu.querySelectorAll(".context-menu__separator").forEach((separator) => {
      separator.style.display = "block";
    });

    // Show menu at mouse position
    this.showMenuAt(e.pageX, e.pageY);

    // Apply i18n translations to the menu
    if (window.i18n && typeof window.i18n.applyTranslations === "function") {
      window.i18n.applyTranslations();
    }

    this.log("📝 Menú contextual de texto mostrado");
  }

  showTabContextMenu(e, tabLabel) {
    // Save the active tab item
    this.activeTabElement = tabLabel.closest(".tab-list__item");
    this.activeEditableElement = null;
    this.activeSelection = null;

    // Check if the tab is locked
    const isPinned = this.activeTabElement.classList.contains("pinned");

    // Show only tab options
    this.contextMenu.querySelectorAll(".context-menu__item").forEach((item) => {
      if (item.dataset.context === "tab") {
        item.style.display = "block";
      } else {
        item.style.display = "none";
      }
    });

    // Hide separators
    this.contextMenu.querySelectorAll(".context-menu__separator").forEach((separator) => {
      separator.style.display = "none";
    });

    // Show menu at mouse position
    this.showMenuAt(e.pageX, e.pageY);

    // Apply i18n translations to the menu
    if (window.i18n && typeof window.i18n.applyTranslations === "function") {
      window.i18n.applyTranslations();
    }

    this.log("📑 Menú contextual de pestaña mostrado");
  }

  showMenuAt(x, y) {
    this.contextMenu.style.display = "block";

    // Adjust position so it doesn't go off the screen
    const menuWidth = this.contextMenu.offsetWidth;
    const menuHeight = this.contextMenu.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let finalX = x;
    let finalY = y;

    if (x + menuWidth > windowWidth) {
      finalX = windowWidth - menuWidth - 10;
    }

    if (y + menuHeight > windowHeight) {
      finalY = windowHeight - menuHeight - 10;
    }

    this.contextMenu.style.left = `${finalX}px`;
    this.contextMenu.style.top = `${finalY}px`;
  }

  hideContextMenu() {
    this.contextMenu.style.display = "none";
    this.activeEditableElement = null;
    this.activeSelection = null;
    this.activeTabElement = null;
  }

  handleMenuAction(e) {
    const menuItem = e.target.closest(".context-menu__item");
    if (!menuItem || menuItem.classList.contains("disabled")) {
      return;
    }

    const action = menuItem.dataset.action;

    if (action === "pin-tab" && this.activeTabElement) {
      this.handlePinTab(this.activeTabElement);
    } else if (this.activeEditableElement) {
      this.handleTextAction(action);
    }

    this.hideContextMenu();
  }

  handleTextAction(action) {
    // Ensure the element has focus
    this.activeEditableElement.focus();

    // Restore selection if it exists
    if (this.activeSelection) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(this.activeSelection);
    }

    // Execute the corresponding command
    switch (action) {
      case "copy":
      case "cut":
        document.execCommand(action, false, null);
        break;

      case "paste":
        navigator.clipboard.readText().then((text) => {
          this.activeEditableElement.focus();
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

      default:
        // italic, underline, etc.
        document.execCommand(action, false, null);
    }

    this.log(`📝 Acción de texto ejecutada: ${action}`);
  }

  handlePinTab(tabElement) {
    const isPinned = tabElement.classList.contains("pinned");

    if (isPinned) {
      this.unpinTab(tabElement);
    } else {
      this.pinTab(tabElement);
    }
  }

  pinTab(tabElement) {
    // Check if there is an emoticon in the name text
    const labelSpan = tabElement.querySelector("label span");
    const tabName = labelSpan.textContent.trim();
    const emojiInText = detectEmojiInText(tabName);

    // Usar emoji detectado o uno aleatorio
    const emoji = emojiInText || getRandomPinEmoji();

    // Mark as pinned
    tabElement.classList.add("pinned");
    const label = tabElement.querySelector("label");
    label.setAttribute("data-emoji", emoji);
    labelSpan.setAttribute("data-emoji", emoji);

    // Reorganize tabs
    this.reorderTabs();

    // Save changes (you will need to access the TabManager)
    this.saveTabChanges();

    this.log("📍 Pestaña fijada:", tabName);
  }

  unpinTab(tabElement) {
    // Remove pinned mark
    tabElement.classList.remove("pinned");
    const label = tabElement.querySelector("label");
    const labelSpan = tabElement.querySelector("label span");

    label.removeAttribute("data-emoji");
    labelSpan.removeAttribute("data-emoji");

    // Reorganize tabs
    this.reorderTabs();

    // Save changes
    this.saveTabChanges();

    this.log("📍 Pestaña desfijada");
  }

  reorderTabs() {
    const tabList = document.querySelector(".tab-list");
    const createTabButton = document.getElementById("create-tab");
    const tabAnchor = document.querySelector("#tab-list-anchor");

    if (!tabList) return;

    const allTabs = Array.from(tabList.querySelectorAll(".tab-list__item"));

    // Separate fixed and normal lashes
    const pinnedTabs = allTabs.filter((tab) => tab.classList.contains("pinned"));
    const normalTabs = allTabs.filter((tab) => !tab.classList.contains("pinned"));

    // Remove all tabs from the DOM
    allTabs.forEach((tab) => tab.remove());

    // Obtener el elemento de referencia para insertBefore
    const referenceElement = tabAnchor || createTabButton;

    // Reinsert in order: first the fixed ones, then the normal ones
    if (referenceElement) {
      pinnedTabs.forEach((tab) => {
        tabList.insertBefore(tab, referenceElement);
      });

      normalTabs.forEach((tab) => {
        tabList.insertBefore(tab, referenceElement);
      });
    } else {
      // If there is no reference, use appendChild
      pinnedTabs.forEach((tab) => {
        tabList.appendChild(tab);
      });

      normalTabs.forEach((tab) => {
        tabList.appendChild(tab);
      });
    }

    this.log("🔄 Pestañas reordenadas");
  }

  saveTabChanges() {
    // This function needs to access the TabManager to save.

    // For now, it triggers a global event that the TabManager can listen for.
    const event = new CustomEvent("tabsChanged");
    document.dispatchEvent(event);
  }

  log(...args) {
    if (this.options.debug) {
    }
  }

  debug() {
    return {
      options: this.options,
      elements: {
        contextMenu: !!this.contextMenu,
        activeEditable: !!this.activeEditableElement,
        activeTab: !!this.activeTabElement,
      },
    };
  }
}
