// src/lib/scripts/ui/settingsModal.js
import { devLogger } from "../utils/devLogger.js";

export class SettingsModal {
  constructor(options = {}) {
    this.options = {
      debug: true,
      ...options,
    };
    this.modal = null;
    this.langSelect = null;
    this.langForm = null;
  }

  async init() {
    this.modal = document.getElementById("info-notepad");
    if (!this.modal) {
      if (this.options.debug) {
        devLogger.error("[SettingsModal] Modal not found");
      }
      return this;
    }

    this.setupTabs();
    this.setupLanguageSelector();
    this.setupKeyboardNav();

    if (this.options.debug) {
      devLogger.log("[SettingsModal] Initialized successfully");
    }

    return this;
  }

  setupTabs() {
    const navItems = this.modal.querySelectorAll(".nav-item");
    const tabs = this.modal.querySelectorAll(".settings-tab");

    navItems.forEach((item) => {
      item.addEventListener("click", () => {
        const tabId = item.dataset.tab;
        if (tabId) {
          this.switchTab(tabId, navItems, tabs);
        }
      });
    });
  }

  switchTab(tabId, navItems, tabs) {
    navItems.forEach((item) => item.classList.remove("active"));
    tabs.forEach((tab) => tab.classList.remove("active"));

    const selectedTab = this.modal.querySelector(`#${tabId}-tab`);
    const selectedNav = this.modal.querySelector(`[data-tab="${tabId}"]`);

    if (selectedTab) {
      selectedTab.classList.add("active");
    }
    if (selectedNav) {
      selectedNav.classList.add("active");
    }
  }

  setupLanguageSelector() {
    this.langSelect = document.getElementById("lang-select");
    this.langForm = this.modal.querySelector("form");

    if (this.langSelect && window.i18n) {
      this.langSelect.value = window.i18n.getLang() || "en";

      this.langSelect.addEventListener("change", (e) => {
        const newLang = e.target.value;
        window.i18n.setLang(newLang);
      });
    }

    if (this.langForm) {
      this.langForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (this.langSelect && window.i18n) {
          const selectedLang = this.langSelect.value;
          localStorage.setItem("appLang", selectedLang);
          window.i18n.setLang(selectedLang);
        }
        this.modal.close();
      });
    }
  }

  setupKeyboardNav() {
    if (!this.modal) return;

    this.modal.addEventListener("keydown", (e) => {
      const navItems = this.modal.querySelectorAll(".nav-item");
      const tabs = this.modal.querySelectorAll(".settings-tab");
      if (navItems.length === 0) return;

      const activeEl = document.activeElement;
      const isNavFocused = activeEl && activeEl.classList.contains("nav-item");

      let currentIndex = isNavFocused ? Array.from(navItems).indexOf(activeEl) : 0;
      if (currentIndex < 0) currentIndex = 0;

      // Arrow keys: navigate nav-items only when a nav-item is focused
      if (isNavFocused) {
        let newIndex = -1;

        switch (e.key) {
          case "ArrowDown":
          case "ArrowRight":
            e.preventDefault();
            newIndex = (currentIndex + 1) % navItems.length;
            break;
          case "ArrowUp":
          case "ArrowLeft":
            e.preventDefault();
            newIndex = (currentIndex - 1 + navItems.length) % navItems.length;
            break;
          case "Home":
            e.preventDefault();
            newIndex = 0;
            break;
          case "End":
            e.preventDefault();
            newIndex = navItems.length - 1;
            break;
        }

        if (newIndex >= 0 && newIndex < navItems.length) {
          const target = navItems[newIndex];
          const tabId = target.dataset.tab;
          if (tabId) {
            this.switchTab(tabId, navItems, tabs);
          }
          target.focus();
          return;
        }
      }

      // Enter/Space on nav-item: switch tab AND focus first interactive element in content
      if ((e.key === "Enter" || e.key === " ") && isNavFocused) {
        e.preventDefault();
        const tabId = activeEl.dataset.tab;
        if (tabId) {
          this.switchTab(tabId, navItems, tabs);
          this._focusFirstContent(tabId);
        }
        return;
      }

      // Escape from content: return focus to active nav-item
      if (e.key === "Escape" && activeEl && this._isInsideContent(activeEl)) {
        e.preventDefault();
        const nav = this.modal.querySelector(".nav-item.active");
        if (nav) nav.focus();
        return;
      }
    });
  }

  _getFocusableElements(container) {
    return container.querySelectorAll(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"]), summary'
    );
  }

  _focusFirstContent(tabId) {
    const panel = this.modal.querySelector(`#${tabId}-tab`);
    if (!panel) return;
    const focusable = this._getFocusableElements(panel);
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  }

  _isInsideContent(el) {
    const content = this.modal?.querySelector(".settings-content");
    if (!content) return false;
    return content.contains(el);
  }
}
