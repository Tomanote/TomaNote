export class ThemeManager {
  constructor() {
    this.themes = [
      { id: "dark", name: "Dark Mode", icon: "⚫", previewColor: "#181A1B" },
      { id: "light", name: "Light Mode", icon: "⚪", previewColor: "#E0D3C2" },
      {
        id: "cozy-rose",
        name: "Cozy Rose",
        icon: "🟣",
        previewColor: "#B85C80",
      },
      {
        id: "chill-aqua",
        name: "Chill Aqua",
        icon: "🔵",
        previewColor: "#76C9D4",
      },
      {
        id: "wild-forest",
        name: "Wild Forest",
        icon: "🟢",
        previewColor: "#8EBF7A",
      },
      {
        id: "neon-orbit",
        name: "Neon Orbit",
        icon: "🔴",
        previewColor: "#1A1A2E",
      },
    ];

    this.currentTheme = "dark";
    this.isDropdownOpen = false;
  }

  async init() {
    // Cargar tema guardado
    this.loadSavedTheme();

    // Crear UI del selector (deprecated, ahora se usa AppearanceTab)
    // this.createThemeSelectorUI();

    // Aplicar tema inicial
    this.applyTheme(this.currentTheme);

    // Configurar listeners
    this.setupEventListeners();

    // Configurar AppearanceTab si existe
    this.setupAppearanceTab();

    return this;
  }

  loadSavedTheme() {
    try {
      const savedTheme = localStorage.getItem("notepadTheme");
      if (savedTheme && this.themes.some((t) => t.id === savedTheme)) {
        this.currentTheme = savedTheme;
      } else {
        // Comprobar preferencia del sistema
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        this.currentTheme = systemPrefersDark ? "dark" : "light";
        localStorage.setItem("notepadTheme", this.currentTheme);
      }
    } catch (error) {
      console.warn("⚠️  Error cargando tema:", error);
      this.currentTheme = "dark";
    }
  }

  createThemeSelectorUI() {
    // Verificar si ya existe
    if (document.querySelector(".theme-selector-container")) {
      return;
    }

    // Encontrar donde insertar (junto al toggle antiguo)
    const themeWrapper = document.querySelector(".theme-selector-wrapper") || document.querySelector(".options-tab") || document.querySelector(".tab-list");

    if (!themeWrapper) {
      return;
    }

    // Crear HTML del selector
    const themeSelectorHTML = `
      <div class="theme-selector-container">
        <button 
          id="theme-toggle-btn" 
          class="theme-toggle-btn" 
          title="${window.i18n?.t("appearance.first-option") ?? "Theme Selection"}"
          aria-label="${window.i18n?.t("appearance.first-option") ?? "Theme Selection"}"
          aria-haspopup="true"
          aria-expanded="false"
        >
          <span id="theme-current-icon">🌙</span>
        </button>
        <div 
          id="theme-dropdown" 
          class="theme-dropdown" 
          role="menu" 
          aria-labelledby="theme-toggle-btn"
          style="display: none;"
        >
          <div class="theme-dropdown-header">
            <h4>${window.i18n?.t("appearance.first-option") ?? "Select Theme"}</h4>
          </div>
          <div class="theme-list" role="none">
            ${this.themes
              .map(
                (theme) => `
              <button 
                class="theme-option ${this.currentTheme === theme.id ? "active" : ""}" 
                data-theme="${theme.id}"
                role="menuitem"
                aria-label="${theme.name}"
                ${this.currentTheme === theme.id ? 'aria-current="true"' : ""}
              >
                <span class="theme-icon">${theme.icon}</span>
                <span class="theme-name">${theme.name}</span>
                <div class="theme-preview" data-theme="${theme.id}"></div>
              </button>
            `
              )
              .join("")}
          </div>
        </div>
      </div>
    `;

    // Insertar en el DOM
    themeWrapper.insertAdjacentHTML("beforeend", themeSelectorHTML);

    // Actualizar el ícono inicial
    this.updateThemeIcon();
  }

  setupEventListeners() {
    // Sincronizar con el toggle antiguo si existe (deprecated)
    const oldToggle = document.getElementById("dark-mode-toggle");
    if (oldToggle) {
      // Establecer estado inicial
      oldToggle.checked = this.currentTheme === "light";

      oldToggle.addEventListener("change", (e) => {
        this.toggleLightMode(e.target.checked);
      });
    }
  }

  setupAppearanceTab() {
    const themeRadios = document.querySelectorAll('input[name="themeColor"]');
    
    if (themeRadios.length === 0) {
      return;
    }

    // Mapear IDs de radio buttons a IDs de temas
    const radioToThemeMap = {
      "theme-color-dark": "dark",
      "theme-color-light": "light",
      "theme-color-rose": "cozy-rose",
      "theme-color-aqua": "chill-aqua",
      "theme-color-forest": "wild-forest",
      "theme-color-orbit": "neon-orbit",
    };

    // Establecer el radio button activo según el tema actual
    this.updateAppearanceTabUI();

    // Prevenir auto-scroll del modal al hacer clic en los labels (patch mobile)
    this.preventLabelAutoScroll(themeRadios);

    // Agregar event listeners a los radio buttons
    themeRadios.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        const themeId = radioToThemeMap[e.target.id];
        if (themeId) {
          this.switchTheme(themeId);
        }
      });
    });

    // Escuchar cambios de tema para actualizar la UI
    window.addEventListener("themeChanged", (e) => {
      this.updateAppearanceTabUI();
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

  updateAppearanceTabUI() {
    const themeRadios = document.querySelectorAll('input[name="themeColor"]');
    const themeToRadioMap = {
      dark: "theme-color-dark",
      light: "theme-color-light",
      "cozy-rose": "theme-color-rose",
      "chill-aqua": "theme-color-aqua",
      "wild-forest": "theme-color-forest",
      "neon-orbit": "theme-color-orbit",
    };

    const activeRadioId = themeToRadioMap[this.currentTheme];

    themeRadios.forEach((radio) => {
      radio.checked = radio.id === activeRadioId;
    });
  }

  toggleDropdown() {
    const dropdown = document.getElementById("theme-dropdown");
    const toggleBtn = document.getElementById("theme-toggle-btn");

    if (!dropdown || !toggleBtn) return;

    this.isDropdownOpen = !this.isDropdownOpen;

    if (this.isDropdownOpen) {
      dropdown.style.display = "block";
      setTimeout(() => dropdown.classList.add("show"), 10);
      toggleBtn.setAttribute("aria-expanded", "true");
    } else {
      dropdown.classList.remove("show");
      setTimeout(() => {
        if (!this.isDropdownOpen) {
          dropdown.style.display = "none";
        }
      }, 200);
      toggleBtn.setAttribute("aria-expanded", "false");
    }
  }

  closeDropdown() {
    this.isDropdownOpen = false;
    const dropdown = document.getElementById("theme-dropdown");
    const toggleBtn = document.getElementById("theme-toggle-btn");

    if (dropdown && toggleBtn) {
      dropdown.classList.remove("show");
      setTimeout(() => {
        dropdown.style.display = "none";
        toggleBtn.setAttribute("aria-expanded", "false");
      }, 200);
    }
  }

  switchTheme(themeId) {
    if (!this.themes.some((t) => t.id === themeId)) {
      console.warn(`⚠️  Tema "${themeId}" no válido`);
      return;
    }

    // Actualizar estado
    this.currentTheme = themeId;

    // Aplicar tema visualmente
    this.applyTheme(themeId);

    // Guardar preferencia
    try {
      localStorage.setItem("notepadTheme", themeId);
    } catch (error) {}

    // Actualizar UI
    this.updateThemeUI();

    // Actualizar toggle antiguo si existe
    this.updateLegacyToggle();

    // Disparar evento para otros componentes
    window.dispatchEvent(
      new CustomEvent("themeChanged", {
        detail: {
          theme: themeId,
          themeName: this.themes.find((t) => t.id === themeId)?.name,
        },
      })
    );
  }

  applyTheme(themeId) {
    // Usar atributo data-theme en el html
    document.documentElement.setAttribute("data-theme", themeId);

    // Para retrocompatibilidad con CSS antiguo
    document.documentElement.classList.remove("light-mode");
    if (themeId === "light") {
      document.documentElement.classList.add("light-mode");
    }

    // Actualizar meta theme-color para móviles
    this.updateMetaThemeColor(themeId);
  }

  updateMetaThemeColor(themeId) {
    const themeColors = {
      dark: "#181A1B",
      light: "#E0D3C2",
      "cozy-rose": "#B85C80",
      "chill-aqua": "#76C9D4",
      "wild-forest": "#8EBF7A",
      "neon-orbit": "#1A1A2E",
    };

    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement("meta");
      metaThemeColor.name = "theme-color";
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.content = themeColors[themeId] || themeColors.dark;
  }

  updateThemeUI() {
    // Actualizar botones activos
    document.querySelectorAll(".theme-option").forEach((btn) => {
      const isActive = btn.dataset.theme === this.currentTheme;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-current", isActive ? "true" : "false");
    });

    // Actualizar ícono del botón principal
    this.updateThemeIcon();
  }

  updateThemeIcon() {
    const currentTheme = this.themes.find((t) => t.id === this.currentTheme);
    const toggleBtn = document.getElementById("theme-toggle-btn");
    const themeIcon = document.getElementById("theme-current-icon");

    if (currentTheme && toggleBtn) {
      if (themeIcon) {
        themeIcon.textContent = currentTheme.icon;
      } else {
        toggleBtn.innerHTML = currentTheme.icon;
      }
      toggleBtn.title = `${window.i18n?.t("appearance.first-option-description") ?? "Current theme"}: ${currentTheme.name}`;
    }
  }

  updateLegacyToggle() {
    const oldToggle = document.getElementById("dark-mode-toggle");
    if (oldToggle) {
      oldToggle.checked = this.currentTheme === "light";
    }
  }

  toggleLightMode(isLight) {
    this.switchTheme(isLight ? "light" : "dark");
  }

  getCurrentTheme() {
    return this.currentTheme;
  }

  getThemes() {
    return [...this.themes];
  }

  // Método para debug
  debugCSSVariables() {
    const variables = ["--tn-color-background", "--tn-color-text", "--tn-color-accent", "--tn-theme-primary", "--tn-theme-secondary"];

    variables.forEach((varName) => {
      const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    });

    console.groupEnd();
  }

  debug() {
    return {
      currentTheme: this.currentTheme,
      availableThemes: this.themes,
      savedTheme: localStorage.getItem("notepadTheme"),
      dataThemeAttr: document.documentElement.getAttribute("data-theme"),
      hasLightModeClass: document.documentElement.classList.contains("light-mode"),
    };
  }
}
