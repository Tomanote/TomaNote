// src/lib/scripts/ui/keyboardShortcuts.js
// Desktop keyboard shortcut system with centralized registry

import { devLogger } from "../utils/devLogger.js";
import { FormattingUtils } from "../utils/formatting.js";

export class KeyboardShortcuts {
  constructor(options = {}) {
    this.options = {
      debug: true,
      ...options,
    };

    this.isDesktop = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(pointer: fine)').matches
      : true;
    this.shortcuts = [];
    this.boundHandler = null;
  }

  async init() {
    this.log('init() llamado. isDesktop =', this.isDesktop, '| matchMedia(pointer:fine) =', window.matchMedia?.('(pointer: fine)').matches);

    if (!this.isDesktop) {
      this.log("❌ ABORTANDO init — isDesktop es false. No se registrará keydown.");
      return this;
    }

    this.registerDefaults();
    this.log("✅ registerDefaults() ejecutado. Shortcuts registrados:", this.shortcuts.length);

    this.boundHandler = (e) => this.handleKeydown(e);
    document.addEventListener("keydown", this.boundHandler, { capture: true });
    this.log("✅ addEventListener registrado con capture: true");

    return this;
  }

  registerShortcut(config) {
    this.shortcuts.push({
      key: config.key,
      modifiers: config.modifiers || {},
      location: config.location ?? undefined,
      handler: config.handler,
      scope: config.scope || "global",
      preventDefault: config.preventDefault !== false,
      skipWhenInputFocused: config.skipWhenInputFocused !== false,
      label: config.label || "",
      description: config.description || "",
      category: config.category || "",
    });
  }

  handleKeydown(e) {
    this.log('🔑 Tecla presionada:', { key: e.key, altKey: e.altKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, metaKey: e.metaKey, location: e.location, target: e.target?.tagName });

    if (!document.hasFocus()) {
      this.log('🚫 BLOQUEADO por !document.hasFocus()');
      return;
    }

    for (const s of this.shortcuts) {
      if (!this.matchesKey(e, s)) {
        if (s.key === e.key) {
          this.log('⚡ Key coincide pero modifiers NO:', s.label || s.key, 'modifiers esperados:', JSON.stringify(s.modifiers), '| estado real:', { ctrlKey: e.ctrlKey, altKey: e.altKey, shiftKey: e.shiftKey, metaKey: e.metaKey, location: e.location });
        }
        continue;
      }

      if (s.scope !== "system" && this.isModalOpen()) {
        this.log('🚫 BLOQUEADO por modal abierto:', s.label || s.key);
        continue;
      }

      if (s.skipWhenInputFocused && this.isInputFocused()) {
        this.log('🚫 BLOQUEADO por input enfocado:', s.label || s.key, 'activeElement:', document.activeElement?.tagName, 'contentEditable:', document.activeElement?.isContentEditable);
        continue;
      }

      this.log('✅ EJECUTANDO shortcut:', s.label || s.key);
      if (s.preventDefault) e.preventDefault();
      s.handler(e);
      return;
    }
  }

  matchesKey(e, s) {
    if (e.key !== s.key) return false;
    if (s.location !== undefined && e.location !== s.location) return false;
    const m = s.modifiers;

    if (m.ctrl !== undefined && e.ctrlKey !== m.ctrl) return false;
    if (m.alt !== undefined) {
      if (e.altKey !== !!m.alt) return false;
    }
    if (m.shift !== undefined && e.shiftKey !== m.shift) return false;
    if (m.meta !== undefined && e.metaKey !== m.meta) return false;

    return true;
  }

  isModalOpen() {
    if (window.commandPalette?.isOpen) return true;
    const modal = document.getElementById("info-notepad");
    if (modal?.hasAttribute("open")) return true;
    return false;
  }

  isInputFocused() {
    const el = document.activeElement;
    if (!el) {
      this.log('isInputFocused: no activeElement → false');
      return false;
    }
    const tag = el.tagName;
    const result = tag === "INPUT" || tag === "TEXTAREA";
    this.log('isInputFocused:', result, '| tag:', tag, '| isContentEditable:', el.isContentEditable);
    return result;
  }

  getShortcutsByCategory() {
    return this.shortcuts.filter((s) => s.label && s.category);
  }

  // ===== DEFAULT SHORTCUTS =====

  registerDefaults() {
    // --- Escape: priority chain ---
    this.registerShortcut({
      key: "Escape",
      modifiers: {},
      scope: "system",
      preventDefault: false,
      skipWhenInputFocused: false,
      handler: (e) => this.handleEscape(e),
    });

    // --- Ctrl+K: Command Palette ---
    this.registerShortcut({
      key: "k",
      modifiers: { ctrl: true, alt: false, shift: false, meta: false },
      scope: "system",
      skipWhenInputFocused: false,
      label: "Ctrl+K",
      description: "shortcuts.desc.commandPalette",
      category: "navigation",
      handler: () => {
        window.commandPalette?.toggle();
      },
    });

    // --- Alt+N: New tab ---
    this.registerShortcut({
      key: "n",
      modifiers: { alt: true, ctrl: false, shift: false, meta: false },
      label: "Alt+N",
      description: "shortcuts.desc.newTab",
      category: "tabs",
      handler: () => {
        window.tabManager?.createTab();
      },
    });

    // --- Alt+W: Close active tab ---
    this.registerShortcut({
      key: "w",
      modifiers: { alt: true, ctrl: false, shift: false, meta: false },
      label: "Alt+W",
      description: "shortcuts.desc.closeTab",
      category: "tabs",
      handler: () => {
        const activeTab = document.querySelector('.tab-list input[type="radio"]:checked');
        if (activeTab) {
          activeTab.checked = false;
          document.dispatchEvent(new CustomEvent("tabsChanged"));
        }
      },
    });

    // --- Alt+, : Previous tab ---
    this.registerShortcut({
      key: ",",
      modifiers: { alt: true, ctrl: false, shift: false, meta: false },
      location: 0,
      label: "Alt+,",
      description: "shortcuts.desc.previousTab",
      category: "tabs",
      handler: () => {
        const tabs = document.querySelectorAll('.tab-list input[type="radio"]');
        if (tabs.length === 0) return;
        const current = document.querySelector('.tab-list input[type="radio"]:checked');
        let idx = current ? Array.from(tabs).indexOf(current) : -1;
        idx = (idx - 1 + tabs.length) % tabs.length;
        tabs[idx].checked = true;
        document.dispatchEvent(new CustomEvent("tabsChanged"));
      },
    });

    // --- Alt+. : Next tab ---
    this.registerShortcut({
      key: ".",
      modifiers: { alt: true, ctrl: false, shift: false, meta: false },
      location: 0,
      label: "Alt+.",
      description: "shortcuts.desc.nextTab",
      category: "tabs",
      handler: () => {
        const tabs = document.querySelectorAll('.tab-list input[type="radio"]');
        if (tabs.length === 0) return;
        const current = document.querySelector('.tab-list input[type="radio"]:checked');
        let idx = current ? Array.from(tabs).indexOf(current) : -1;
        idx = (idx + 1) % tabs.length;
        tabs[idx].checked = true;
        document.dispatchEvent(new CustomEvent("tabsChanged"));
      },
    });

    // --- Alt+1...9: Jump to tab ---
    for (let i = 1; i <= 9; i++) {
      this.registerShortcut({
        key: String(i),
        modifiers: { alt: true, ctrl: false, shift: false, meta: false },
        location: 0,
        label: `Alt+${i}`,
        description: "shortcuts.desc.jumpToTab",
        category: "tabs",
        handler: () => {
          const tabs = document.querySelectorAll('.tab-list input[type="radio"]');
          if (tabs.length >= i) {
            tabs[i - 1].checked = true;
            document.dispatchEvent(new CustomEvent("tabsChanged"));
          }
        },
      });
    }

    // --- Alt+S: Open Settings ---
    this.registerShortcut({
      key: "s",
      modifiers: { alt: true, ctrl: false, shift: false, meta: false },
      label: "Alt+S",
      description: "shortcuts.desc.openSettings",
      category: "navigation",
      handler: () => {
        const modal = document.querySelector("dialog#info-notepad");
        if (modal) modal.showModal();
      },
    });

    // --- Alt+T: Rename active tab ---
    this.registerShortcut({
      key: "t",
      modifiers: { alt: true, ctrl: false, shift: false, meta: false },
      label: "Alt+T",
      description: "shortcuts.desc.renameTab",
      category: "tabs",
      handler: () => {
        const activeTab = document.querySelector('.tab-list input[type="radio"]:checked');
        if (!activeTab) return;
        const tabItem = activeTab.closest(".tab-list__item");
        const editButton = tabItem?.querySelector(".edit-name-tab");
        if (editButton) {
          editButton.click();
        }
      },
    });

    // --- Alt+P: Pin/Unpin active tab ---
    this.registerShortcut({
      key: "p",
      modifiers: { alt: true, ctrl: false, shift: false, meta: false },
      label: "Alt+P",
      description: "shortcuts.desc.pinTab",
      category: "tabs",
      handler: () => {
        const activeTab = document.querySelector('.tab-list input[type="radio"]:checked');
        if (!activeTab) return;
        const tabElement = activeTab.closest(".tab-list__item");
        if (!tabElement) return;
        if (tabElement.classList.contains("pinned")) {
          window.tabManager?.unpinTab(tabElement);
        } else {
          window.tabManager?.pinTab(tabElement);
        }
      },
    });

    // --- Alt+E: Toggle editor width ---
    this.registerShortcut({
      key: "e",
      modifiers: { alt: true, ctrl: false, shift: false, meta: false },
      label: "Alt+E",
      description: "shortcuts.desc.toggleEditorWidth",
      category: "editor",
      handler: () => {
        const current = localStorage.getItem("editorWidth") || "default";
        const next = current === "default" ? "stretch" : "default";
        window.editorSettings?.applyWidth(next);
        localStorage.setItem("editorWidth", next);
      },
    });

    // --- Ctrl+S: Save (visual feedback) ---
    this.registerShortcut({
      key: "s",
      modifiers: { ctrl: true, alt: false, shift: false, meta: false },
      skipWhenInputFocused: false,
      label: "Ctrl+S",
      description: "shortcuts.desc.save",
      category: "editor",
      handler: () => {
        window.saveIndicator?.trigger();
      },
    });

    // --- Ctrl+B: Bold (uses custom Range-based cycling) ---
    this.registerShortcut({
      key: "b",
      modifiers: { ctrl: true, alt: false, shift: false, meta: false },
      label: "Ctrl+B",
      description: "shortcuts.desc.bold",
      category: "editor",
      handler: () => {
        FormattingUtils.cycleBold();
      },
    });

    // --- Ctrl+I: Italic ---
    this.registerShortcut({
      key: "i",
      modifiers: { ctrl: true, alt: false, shift: false, meta: false },
      label: "Ctrl+I",
      description: "shortcuts.desc.italic",
      category: "editor",
      handler: () => {
        document.execCommand("italic", false, null);
      },
    });

    // --- Ctrl+U: Underline ---
    this.registerShortcut({
      key: "u",
      modifiers: { ctrl: true, alt: false, shift: false, meta: false },
      label: "Ctrl+U",
      description: "shortcuts.desc.underline",
      category: "editor",
      handler: () => {
        document.execCommand("underline", false, null);
      },
    });

    // --- Alt+/ : Show shortcuts help ---
    this.registerShortcut({
      key: "/",
      modifiers: { alt: true, ctrl: false, shift: false, meta: false },
      label: "Alt+/",
      description: "shortcuts.desc.shortcutsHelp",
      category: "navigation",
      handler: () => {
        window.keyboardShortcutsHelp?.toggle();
      },
    });

    // --- Alt+Backspace: Delete active tab ---
    this.registerShortcut({
      key: "Backspace",
      modifiers: { alt: true, ctrl: false, shift: false, meta: false },
      label: "Alt+Backspace",
      description: "shortcuts.desc.deleteTab",
      category: "tabs",
      handler: async () => {
        const activeTab = document.querySelector('.tab-list input[type="radio"]:checked');
        if (!activeTab) return;
        const tabElement = activeTab.closest(".tab-list__item");
        if (tabElement) {
          window.tabManager?.deleteTabElement(tabElement);
        }
      },
    });
  }

  // ===== ESCAPE HANDLER =====

  handleEscape(e) {
    const palette = document.getElementById("commandPalette");
    if (palette?.hasAttribute("open") || window.commandPalette?.isOpen) {
      this.log("Command Palette abierto - ignorando ESC");
      return;
    }

    const settingsModal = document.getElementById("info-notepad");
    if (settingsModal?.hasAttribute("open")) {
      this.log("Modal de settings abierto - ignorando ESC");
      return;
    }

    const editingLabel = document.querySelector('label[contenteditable="true"]');
    if (editingLabel) {
      this.log("Modo de edición activo - saliendo del modo edición");
      editingLabel.removeAttribute("contenteditable");
      if (window.tabManager?.saveTabs) {
        window.tabManager.saveTabs();
      }
      return;
    }

    const activeTab = document.querySelector('.tab-list input[type="radio"]:checked');
    if (activeTab) {
      this.log("Cerrando pestaña activa");
      activeTab.checked = false;
      document.dispatchEvent(new CustomEvent("tabsChanged"));
    }
  }

  // ===== CLEANUP =====

  destroy() {
    if (this.boundHandler) {
      document.removeEventListener("keydown", this.boundHandler, { capture: true });
      this.boundHandler = null;
    }
    this.shortcuts = [];
  }

  log(...args) {
    if (this.options.debug) {
      devLogger.log("[KeyboardShortcuts]", ...args);
    }
  }
}
