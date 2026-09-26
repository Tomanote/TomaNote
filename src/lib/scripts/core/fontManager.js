// src/lib/scripts/core/fontManager.js

export class FontManager {
  constructor() {
    this.defaultFont = "Inter";
    this.fontFallback = "sans-serif, serif";
    this.defaultSize = "base";
    this.sizeClasses = {
      base: "base-text",
      medium: "medium-text",
      large: "large-text",
    };
    this.fontUrls = {
      Inter: "https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,100..900;1,100..900&display=swap",
      Poppins: "https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap",
      Raleway: "https://fonts.googleapis.com/css2?family=Raleway:ital,wght@0,100..900;1,100..900&display=swap",
      "Open Sans": "https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap",
      Roboto: "https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap",
      Montserrat: "https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap",
    };
  }

  initFontSettingsUI() {
    const fontSelect = document.getElementById("font-select");
    const fontInput = document.getElementById("font-url-input");
    const customFontWrapper = document.getElementById("custom-font-url-wrapper");
    const customFontInstructions = document.getElementById("custom-font-instructions");
    const fontError = document.getElementById("font-url-error");
    const fontSizeRadios = document.querySelectorAll('input[name="options-font-size"]');

    if (!fontSelect) return;

    const savedFontName = localStorage.getItem("customFontName");
    const savedFontUrl = localStorage.getItem("customFontUrl");

    if (savedFontName && this.fontUrls[savedFontName]) {
      fontSelect.value = savedFontName;
    } else if (savedFontUrl) {
      fontSelect.value = "custom";
      if (fontInput) fontInput.value = savedFontUrl;
      if (customFontWrapper) customFontWrapper.style.display = "block";
      if (customFontInstructions) customFontInstructions.style.display = "block";
    } else {
      fontSelect.value = "Inter";
    }

    if (fontSelect && customFontWrapper) {
      fontSelect.addEventListener("change", () => {
        if (fontSelect.value === "custom") {
          customFontWrapper.style.display = "block";
          if (customFontInstructions) customFontInstructions.style.display = "block";
        } else {
          customFontWrapper.style.display = "none";
          if (customFontInstructions) customFontInstructions.style.display = "none";
          if (fontError) fontError.style.display = "none";
        }
      });
    }

    const savedFontSize = localStorage.getItem("fontSize");
    if (savedFontSize && fontSizeRadios) {
      fontSizeRadios.forEach((radio) => {
        if (radio.id === `option-${savedFontSize}-text`) {
          radio.checked = true;
        }
      });
    }

    if (fontSelect) {
      fontSelect.addEventListener("change", () => {
        const selectedFont = fontSelect.value;

        if (this.fontUrls[selectedFont]) {
          if (fontError) fontError.style.display = "none";
          this.changeNoteFont(this.fontUrls[selectedFont], selectedFont);
          return;
        }

        if (selectedFont === "custom" && fontInput) {
          const url = fontInput.value.trim();

          if (url === "") {
            if (fontError) {
              fontError.textContent = window.i18n.t("typo.first-option-alert");
              fontError.style.display = "inline-block";
            }
            return;
          }

          if (this.isValidGoogleFontsUrl(url)) {
            if (fontError) fontError.style.display = "none";
            const match = url.match(/[?&]family=([^:&]*)/);
            if (match && match[1]) {
              const family = decodeURIComponent(match[1].split(":")[0].replace(/\+/g, " "));
              this.changeNoteFont(url, family);
            }
            return;
          }

          if (fontError) {
            fontError.textContent = window.i18n.t("typo.first-option-alert");
            fontError.style.display = "inline-block";
          }
        }
      });
    }

    if (fontInput) {
      fontInput.addEventListener("input", () => {
        if (fontSelect && fontSelect.value === "custom") {
          const url = fontInput.value.trim();

          if (url === "") {
            return;
          }

          if (this.isValidGoogleFontsUrl(url)) {
            if (fontError) fontError.style.display = "none";
            const match = url.match(/[?&]family=([^:&]*)/);
            if (match && match[1]) {
              const family = decodeURIComponent(match[1].split(":")[0].replace(/\+/g, " "));
              this.changeNoteFont(url, family);
            }
          }
        }
      });
    }

    if (fontSizeRadios) {
      fontSizeRadios.forEach((radio) => {
        radio.addEventListener("change", () => {
          const selectedSize = Array.from(fontSizeRadios).find((r) => r.checked);
          const sizeValue = selectedSize ? selectedSize.id.replace("option-", "").replace("-text", "") : "base";
          this.changeFontSize(sizeValue);
        });
      });
    }
  }

  isValidGoogleFontsUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname === "fonts.googleapis.com" && parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  /**
   * Current connection status (milestone 0.5.8).
   * Prefers the centralized ConnectivityStore, falls back to navigator.onLine.
   * @returns {boolean}
   */
  isOnline() {
    try {
      const store = window.connectivity;
      if (store && typeof store.isOnline === "function") {
        return store.isOnline() !== false;
      }
    } catch {
      // store broken — fall through to navigator
    }
    return typeof navigator === "undefined" || navigator.onLine !== false;
  }

  /**
   * Inject a remote stylesheet with a silent failure path: if the request
   * errors (offline, timeout, blocked), the font family stack still resolves
   * through the local fallback — the app never crashes on a missing font.
   * @param {string} url
   * @param {string|null} family
   */
  injectFontLink(url, family) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.onerror = () => {
      // Intercept the network failure silently: keep the family applied with
      // its fallback stack so text remains readable.
      this.applyFontToNotes(family ?? this.defaultFont);
      if (typeof link.remove === "function") link.remove();
    };
    document.head.appendChild(link);
  }

  loadCustomFont() {
    let fontUrl = null;
    try {
      fontUrl = localStorage.getItem("customFontUrl");
    } catch {
      // localStorage unavailable (private mode / quota) — treat as no preference
      fontUrl = null;
    }

    if (!fontUrl) {
      this.applyFontToNotes(this.defaultFont);
      return;
    }

    const match = fontUrl.match(/[?&]family=([^:&]*)/);
    const family = match && match[1] ? decodeURIComponent(match[1].split(":")[0].replace(/\+/g, " ")) : null;
    const resolvedFamily = family ?? this.defaultFont;

    // Offline pre-loading: skip the remote request entirely, apply the local
    // fallback family immediately so the editor never renders unstyled.
    if (!this.isOnline()) {
      this.applyFontToNotes(resolvedFamily);
      return;
    }

    try {
      this.injectFontLink(fontUrl, family);
      this.applyFontToNotes(resolvedFamily);
      if (family) {
        try {
          localStorage.setItem("customFontName", family);
        } catch {
          // non-fatal: memory-only preference for this session
        }
      }
    } catch {
      this.applyFontToNotes(this.defaultFont);
    }
  }

  loadFontSize() {
    const savedSize = localStorage.getItem("fontSize") || this.defaultSize;
    this.applyFontSizeToEditor(savedSize);

    // Observe changes in the DOM to apply the size when new elements are created
    this.observeEditorElements();
  }

  observeEditorElements() {
    if (typeof MutationObserver === "undefined") return;

    const observer = new MutationObserver((mutations) => {
      const savedSize = localStorage.getItem("fontSize") || this.defaultSize;
      this.applyFontSizeToEditor(savedSize);
    });

    try {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    } catch (e) {
      // Ignore errors
    }
  }

  applyFontSizeToEditor(sizeValue) {
    const fontSizeMap = {
      base: "var(--tn-font-size-base)",
      medium: "var(--tn-font-size-medium)",
      large: "var(--tn-font-size-large)",
    };

    const fontSize = fontSizeMap[sizeValue] || fontSizeMap.base;

    // Apply via CSS variable (more robust)
    document.documentElement.style.setProperty("--tn-editor-font-size", fontSize);

    // Also apply via classes as fallback
    const sizeClass = this.sizeClasses[sizeValue] || this.sizeClasses.base;
    const editorElements = document.querySelectorAll(".tab-list__item--content");

    if (editorElements.length === 0) {
      return;
    }

    editorElements.forEach((element) => {
      Object.values(this.sizeClasses).forEach((cls) => {
        element.classList.remove(cls);
      });
      element.classList.add(sizeClass);
    });
  }

  applyFontToNotes(fontFamily) {
    // Update CSS variable
    document.documentElement.style.setProperty("--font-family-notes", `'${fontFamily}', ${this.fontFallback}`);

    // Apply to existing elements
    const noteElements = document.querySelectorAll(".tab-list__item--content, .tab-list__item label span");

    noteElements.forEach((element) => {
      element.style.fontFamily = `'${fontFamily}', ${this.fontFallback}`;
    });
  }

  changeNoteFont(fontUrl, fontName) {
    // Persist the preference first — LocalStorage is the source of truth.
    // Each write is individually guarded so a quota/private-mode failure still
    // applies the font in-session instead of silently discarding the change.
    try {
      localStorage.setItem("customFontUrl", fontUrl);
      localStorage.setItem("customFontName", fontName);
    } catch {
      // storage unavailable — keep going with in-memory state
    }

    try {
      this.applyFontToNotes(fontName);

      // Offline pre-loading: never request remote resources while offline.
      // The family + fallback stack renders immediately; the remote CSS will be
      // fetched on the next load when connectivity returns.
      if (!this.isOnline()) return true;

      this.injectFontLink(fontUrl, fontName);
      return true;
    } catch {
      return false;
    }
  }

  resetNoteFont() {
    localStorage.removeItem("customFontUrl");
    localStorage.removeItem("customFontName");
    this.applyFontToNotes(this.defaultFont);
  }

  changeFontSize(sizeValue) {
    if (!this.sizeClasses[sizeValue]) {
      return false;
    }
    localStorage.setItem("fontSize", sizeValue);
    this.applyFontSizeToEditor(sizeValue);
    return true;
  }

  resetFontSize() {
    localStorage.removeItem("fontSize");
    this.applyFontSizeToEditor(this.defaultSize);
  }
}
