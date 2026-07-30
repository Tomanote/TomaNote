// src/features/command-palette/command-palette.js
// Command Palette - Global search and navigation

export class CommandPalette {
  constructor(options = {}) {
    this.options = {
      debug: true,
      ...options,
    };

    this.modal = null;
    this.input = null;
    this.resultsContainer = null;
    this.activeIndex = -1;
    this.results = [];
    this.isOpen = false;
  }

  async init() {
    this.modal = document.getElementById("commandPalette");
    if (!this.modal) return this;

    this.input = document.getElementById("commandPaletteInput");
    this.resultsContainer = document.getElementById("commandPaletteResults");

    this.setupEventListeners();
    this.log("CommandPalette initialized");
    return this;
  }

  setupEventListeners() {
    if (!this.input || !this.modal) return;

    this.input.addEventListener("input", () => {
      this.handleSearch(this.input.value);
    });

    this.input.addEventListener("keydown", (e) => {
      this.handleKeyNavigation(e);
    });

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

    this.resultsContainer.addEventListener("click", (e) => {
      const resultBtn = e.target.closest("[data-action='open-tab']");
      if (resultBtn) {
        const tabId = resultBtn.dataset.tabId;
        this.openTab(tabId);
      }
    });
  }

  open() {
    if (!this.modal) return;

    this.modal.showModal();
    this.isOpen = true;
    this.activeIndex = -1;
    this.input.value = "";
    this.showInitialState();

    requestAnimationFrame(() => {
      this.input.focus();
    });

    this.log("Command palette opened");
  }

  close() {
    if (!this.modal) return;

    this.modal.close();
    this.isOpen = false;
    this.activeIndex = -1;
    if (this.input) this.input.value = "";
    this.results = [];

    this.log("Command palette closed");
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  handleSearch(query) {
    const trimmed = query.trim();

    if (!trimmed) {
      this.showInitialState();
      return;
    }

    const tabManager = window.tabManager;
    if (!tabManager || !tabManager.tabsData) {
      this.showNoResults();
      return;
    }

    const lowerQuery = trimmed.toLowerCase();
    this.results = [];

    for (const tab of tabManager.tabsData) {
      const nameMatch = tab.name.toLowerCase().includes(lowerQuery);
      const plainContent = this.stripHtml(tab.content || "");
      const contentMatch = plainContent.toLowerCase().includes(lowerQuery);

      if (nameMatch || contentMatch) {
        let snippet = "";
        if (contentMatch && !nameMatch) {
          snippet = this.extractSnippet(plainContent, lowerQuery);
        }

        this.results.push({
          tabId: tab.id,
          tabName: tab.name,
          snippet: snippet,
          matchType: nameMatch ? "name" : "content",
        });
      }
    }

    this.activeIndex = this.results.length > 0 ? 0 : -1;
    this.renderResults(trimmed);
  }

  renderResults(query) {
    if (this.results.length === 0) {
      this.showNoResults(query);
      return;
    }

    const html = this.results
      .map((result, index) => {
        const nameHtml = this.highlightMatch(result.tabName, query);
        const snippetHtml = result.snippet
          ? `<p class="command-palette__result-snippet">${result.snippet}</p>`
          : "";
        const activeClass = index === this.activeIndex ? " command-palette__result--active" : "";
        const badgeLabel = result.matchType === "name" ? "title" : "content";

        return `
        <button class="command-palette__result${activeClass}" data-tab-id="${result.tabId}" data-action="open-tab" type="button" data-index="${index}">
          <div class="command-palette__result-header">
            <span class="command-palette__result-name">${nameHtml}</span>
            <span class="command-palette__result-badge command-palette__result-badge--${result.matchType}">${badgeLabel}</span>
          </div>
          ${snippetHtml}
        </button>
      `;
      })
      .join("");

    this.resultsContainer.innerHTML = html;
  }

  handleKeyNavigation(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.moveSelection(1);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      this.moveSelection(-1);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      this.selectActive();
      return;
    }
  }

  moveSelection(direction) {
    if (this.results.length === 0) return;

    this.activeIndex += direction;

    if (this.activeIndex < 0) {
      this.activeIndex = this.results.length - 1;
    } else if (this.activeIndex >= this.results.length) {
      this.activeIndex = 0;
    }

    this.updateActiveVisual();
  }

  updateActiveVisual() {
    if (!this.resultsContainer) return;

    const items = this.resultsContainer.querySelectorAll(".command-palette__result");
    items.forEach((item, i) => {
      item.classList.toggle("command-palette__result--active", i === this.activeIndex);
    });

    const activeItem = items[this.activeIndex];
    if (activeItem) {
      activeItem.scrollIntoView({ block: "nearest" });
    }
  }

  selectActive() {
    if (this.activeIndex < 0 || this.activeIndex >= this.results.length) return;

    const result = this.results[this.activeIndex];
    this.openTab(result.tabId);
  }

  openTab(tabId) {
    const radio = document.getElementById(tabId);
    if (!radio) return;

    radio.checked = true;

    document.dispatchEvent(new CustomEvent("tabsChanged"));

    this.close();
    this.log("Opened tab:", tabId);
  }

  stripHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }

  extractSnippet(plainText, query) {
    const lowerText = plainText.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) return "";

    const snippetRadius = 40;
    const start = Math.max(0, index - snippetRadius);
    const end = Math.min(plainText.length, index + lowerQuery.length + snippetRadius);

    let snippet = plainText.slice(start, end);

    if (start > 0) snippet = "..." + snippet;
    if (end < plainText.length) snippet = snippet + "...";

    return this.highlightSnippet(snippet, lowerQuery);
  }

  highlightMatch(text, query) {
    if (!query) return this.escapeHtml(text);

    const escaped = this.escapeHtml(text);
    const lowerText = escaped.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);

    if (idx === -1) return escaped;

    const before = escaped.slice(0, idx);
    const match = escaped.slice(idx, idx + query.length);
    const after = escaped.slice(idx + query.length);

    return `${before}<mark>${match}</mark>${after}`;
  }

  highlightSnippet(snippet, query) {
    const lowerSnippet = snippet.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerSnippet.indexOf(lowerQuery);

    if (idx === -1) return this.escapeHtml(snippet);

    const before = this.escapeHtml(snippet.slice(0, idx));
    const match = this.escapeHtml(snippet.slice(idx, idx + query.length));
    const after = this.escapeHtml(snippet.slice(idx + query.length));

    return `${before}<mark>${match}</mark>${after}`;
  }

  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  showInitialState() {
    const emptyMsg = window.i18n?.t("command-palette.empty") || "Type to search your notes...";
    this.resultsContainer.innerHTML = `<div class="command-palette__empty">${emptyMsg}</div>`;
    this.results = [];
    this.activeIndex = -1;
  }

  showNoResults(query = "") {
    const noResultsMsg = window.i18n?.t("command-palette.no-results") || "No results found";
    const display = query ? `${noResultsMsg} "${this.escapeHtml(query)}"` : noResultsMsg;
    this.resultsContainer.innerHTML = `<div class="command-palette__no-results">${display}</div>`;
    this.results = [];
    this.activeIndex = -1;
  }

  log(...args) {
    if (this.options.debug) {
      console.log("[CommandPalette]", ...args);
    }
  }
}
