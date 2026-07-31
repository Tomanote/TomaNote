// src/lib/scripts/core/editorSettings.js
// Editor width and paper background settings

const STORAGE_KEYS = {
  WIDTH: "editorWidth",
  BACKGROUND: "editorBackground",
};

const WIDTH_OPTIONS = ["default", "stretch"];
const BG_OPTIONS = ["flat", "underline", "grid"];
const BG_CLASSES = BG_OPTIONS.map((opt) => `bg-${opt}`);

const LINE_HEIGHT = 1.75;
const SELECTOR_INNER = ".tab-list__item--content > div";
const SELECTOR_CONTENT = ".tab-list__item--content";

const FONT_SIZE_PX = {
  base: 16,
  medium: 20,
  large: 25.6,
};

export class EditorSettings {
  constructor() {
    this.widthRadios = null;
    this.bgRadios = null;
  }

  init() {
    this.setupWidthSelector();
    this.setupBackgroundSelector();
    this.setupFontSizeListener();
    this.restoreSettings();
  }

  setupWidthSelector() {
    this.widthRadios = document.querySelectorAll('input[name="editor-width"]');
    if (!this.widthRadios.length) return;

    this.preventLabelAutoScroll(this.widthRadios);

    this.widthRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        const selected = Array.from(this.widthRadios).find((r) => r.checked);
        const value = selected ? selected.id.replace("width-", "") : "default";
        this.applyWidth(value);
      });
    });
  }

  setupBackgroundSelector() {
    this.bgRadios = document.querySelectorAll('input[name="editor-bg"]');
    if (!this.bgRadios.length) return;

    this.preventLabelAutoScroll(this.bgRadios);

    this.bgRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        const selected = Array.from(this.bgRadios).find((r) => r.checked);
        const value = selected ? selected.id.replace("bg-", "") : "flat";
        this.applyBackground(value);
      });
    });
  }

  setupFontSizeListener() {
    const fontSizeRadios = document.querySelectorAll('input[name="options-font-size"]');
    if (!fontSizeRadios.length) return;

    this.preventLabelAutoScroll(fontSizeRadios);

    fontSizeRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        const selected = Array.from(fontSizeRadios).find((r) => r.checked);
        const sizeValue = selected ? selected.id.replace("option-", "").replace("-text", "") : "base";
        this.updateLineSpacing(sizeValue);
      });
    });
  }

  restoreSettings() {
    const savedWidth = localStorage.getItem(STORAGE_KEYS.WIDTH);
    if (savedWidth && WIDTH_OPTIONS.includes(savedWidth)) {
      this.syncRadioGroup(this.widthRadios, `width-${savedWidth}`);
      this.applyWidth(savedWidth);
    }

    const savedBg = localStorage.getItem(STORAGE_KEYS.BACKGROUND);
    if (savedBg && BG_OPTIONS.includes(savedBg)) {
      this.syncRadioGroup(this.bgRadios, `bg-${savedBg}`);
      this.applyBackground(savedBg);
    }

    const savedFontSize = localStorage.getItem("fontSize") || "base";
    this.updateLineSpacing(savedFontSize);
  }

  syncRadioGroup(radios, checkedId) {
    if (!radios) return;
    radios.forEach((radio) => {
      radio.checked = radio.id === checkedId;
    });
  }

  preventLabelAutoScroll(radios) {
    radios.forEach((radio) => {
      const label = document.querySelector(`label[for="${radio.id}"]`);
      if (!label) return;
      label.addEventListener("click", (e) => {
        e.preventDefault();
        radio.checked = true;
        radio.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  }

  updateLineSpacing(sizeValue) {
    const fontSizePx = FONT_SIZE_PX[sizeValue] || FONT_SIZE_PX.base;
    const lineSpacing = fontSizePx * LINE_HEIGHT;
    document.documentElement.style.setProperty("--tn-paper-line-spacing", `${lineSpacing}px`);
  }

  applyWidth(value) {
    localStorage.setItem(STORAGE_KEYS.WIDTH, value);
    const wrappers = document.querySelectorAll(SELECTOR_INNER);
    wrappers.forEach((wrapper) => {
      wrapper.classList.toggle("stretch", value === "stretch");
    });
  }

  applyBackground(value) {
    localStorage.setItem(STORAGE_KEYS.BACKGROUND, value);
    const contentDivs = document.querySelectorAll(SELECTOR_CONTENT);
    contentDivs.forEach((el) => {
      BG_CLASSES.forEach((cls) => el.classList.remove(cls));
      if (value !== "flat") {
        el.classList.add(`bg-${value}`);
      }
    });
  }
}
