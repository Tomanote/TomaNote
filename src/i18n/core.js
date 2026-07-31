// src/i18n/core.js
// Interanational central system for modules JS
import es from "../locales/es.json";
import en from "../locales/en.json";
import { devLogger } from "../lib/scripts/utils/devLogger.js";

class I18nManager {
  constructor() {
    this.lang = null;
    this.t = null;
    this.translations = { es, en };
    this.initialized = false;
  }

  init() {
    if (typeof window === "undefined") {
      return;
    }

    const savedLang = localStorage.getItem("appLang");
    if (savedLang && this.translations[savedLang]) {
      this.lang = savedLang;
    } else {
      const browserLang = navigator?.language?.toLowerCase() ?? "en";
      this.lang = browserLang.startsWith("es") ? "es" : "en";
    }

    this.t = (key) => {
      const translation = this.translations[this.lang]?.[key];
      if (translation !== undefined) return translation;

      const fallback = this.translations["es"]?.[key];
      if (fallback !== undefined) return fallback;

      devLogger.warn(`[i18n] Missing translation: "${key}"`);
      return key;
    };

    this.applyTranslations();

    this.initialized = true;
  }

  applyTranslations() {
    if (typeof document === "undefined" || !document.querySelectorAll) {
      return;
    }
    const elements = document.querySelectorAll("[data-i18n]");
    elements.forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) {
        el.textContent = this.t(key);
      }
    });
  }

  getLang() {
    return this.lang;
  }

  setLang(lang) {
    if (this.translations[lang]) {
      this.lang = lang;
      this.applyTranslations();
    }
  }

  has(key) {
    return this.translations[this.lang]?.[key] !== undefined;
  }

  getAvailableLangs() {
    return Object.keys(this.translations);
  }
}

export const i18n = new I18nManager();
window.i18n = i18n;
