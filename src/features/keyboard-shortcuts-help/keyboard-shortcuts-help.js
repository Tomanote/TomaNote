// src/features/keyboard-shortcuts-help/keyboard-shortcuts-help.js
// Keyboard shortcuts help overlay

export class KeyboardShortcutsHelp {
  constructor(options = {}) {
    this.options = {
      debug: true,
      ...options,
    };

    this.modal = null;
    this.contentContainer = null;
    this.isOpen = false;
  }

  async init() {
    this.modal = document.getElementById("keyboardShortcutsHelp");
    if (!this.modal) {
      this.log("Modal no encontrado");
      return this;
    }

    this.contentContainer = document.getElementById("ksHelpContent");

    this.setupEventListeners();
    this.render();

    this.log("KeyboardShortcutsHelp inicializado");
    return this;
  }

  setupEventListeners() {
    if (!this.modal) return;

    this.modal.addEventListener("cancel", (e) => {
      e.preventDefault();
      this.close();
    });

    this.modal.addEventListener("click", (e) => {
      const backdrop = e.target.closest("[data-action='close']");
      if (backdrop) {
        this.close();
      }
    });
  }

  render() {
    if (!this.contentContainer) return;

    const shortcuts = window.keyboardShortcuts?.getShortcutsByCategory() || [];
    if (shortcuts.length === 0) {
      this.contentContainer.innerHTML =
        '<div class="ks-help__empty" style="padding:2rem;text-align:center;color:var(--tn-theme-contrast);opacity:0.6;font-size:0.875rem">No shortcuts available</div>';
      return;
    }

    const grouped = {};
    const categoryOrder = ["tabs", "navigation", "editor"];
    const categoryLabels = {
      tabs: window.i18n?.t("shortcuts.category.tabs") || "Tabs",
      navigation: window.i18n?.t("shortcuts.category.navigation") || "Navigation",
      editor: window.i18n?.t("shortcuts.category.editor") || "Editor",
    };

    for (const s of shortcuts) {
      const cat = s.category || "other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(s);
    }

    let html = "";
    for (const cat of categoryOrder) {
      const items = grouped[cat];
      if (!items || items.length === 0) continue;

      html += `<div class="ks-help__category">`;
      html += `<h3 class="ks-help__category-title">${categoryLabels[cat] || cat}</h3>`;

      for (const item of items) {
        const label = item.label || item.key;
        html += `<div class="ks-help__item">`;
        html += `<span class="ks-help__item-label">${item.description || label}</span>`;
        html += `<kbd class="ks-help__kbd">${label}</kbd>`;
        html += `</div>`;
      }

      html += `</div>`;
    }

    this.contentContainer.innerHTML = html;
  }

  open() {
    if (!this.modal) return;
    this.modal.showModal();
    this.isOpen = true;
    this.log("Opened");
  }

  close() {
    if (!this.modal) return;
    this.modal.close();
    this.isOpen = false;
    this.log("Closed");
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.render();
      this.open();
    }
  }

  log(...args) {
    if (this.options.debug) {
      console.log("[KeyboardShortcutsHelp]", ...args);
    }
  }
}
