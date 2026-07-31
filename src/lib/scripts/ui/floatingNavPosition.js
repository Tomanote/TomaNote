import { devLogger } from "../utils/devLogger.js";

export class FloatingNavPosition {
  constructor() {
    this.navElement = null;
    this.bottomBar = null;
    this.previousViewportHeight = null;
    this.timeoutId = null;
  }

  init() {
    this.navElement = document.getElementById("floating-nav");
    this.bottomBar = document.getElementById("bottom-bar");

    this.updatePosition();
    this.setupEventListeners();

    devLogger.log("[FloatingNavPosition] Initialized");
    return this;
  }

  setupEventListeners() {
    window.addEventListener("resize", () => {
      clearTimeout(this.timeoutId);
      this.timeoutId = setTimeout(() => this.updatePosition(), 100);
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => {
        clearTimeout(this.timeoutId);
        this.timeoutId = setTimeout(() => this.updatePosition(), 100);
      });
    }

    window.addEventListener("scroll", () => {
      clearTimeout(this.timeoutId);
      this.timeoutId = setTimeout(() => this.updatePosition(), 100);
    });

    window.addEventListener("orientationchange", () => {
      setTimeout(() => this.updatePosition(), 100);
    });
  }

  updatePosition() {
    if (!this.navElement && !this.bottomBar) return;

    if (window.visualViewport) {
      const currentHeight = window.visualViewport.height;

      if (this.previousViewportHeight !== null) {
        const diff = Math.abs(this.previousViewportHeight - currentHeight);

        if (diff > 100) {
          this.previousViewportHeight = currentHeight;
          return;
        }
      }

      this.previousViewportHeight = currentHeight;
    }

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches || window.navigator.standalone === true;

    if (isStandalone) {
      // Floating menu (desktop sidebar)
      document.documentElement.style.setProperty("--nav-bottom", "max(20px, env(safe-area-inset-bottom, 20px))");
      document.documentElement.style.setProperty("--nav-pb", "0rem");

      // Bottom bar (mobile)
      document.documentElement.style.setProperty("--bb-bottom", "0px");
      document.documentElement.style.setProperty("--bb-pb", "env(safe-area-inset-bottom, 0px)");
      return;
    }

    if (window.visualViewport) {
      const viewport = window.visualViewport;
      const windowHeight = window.innerHeight;
      const viewportBottom = viewport.offsetTop + viewport.height;
      const bottomSpace = windowHeight - viewportBottom;

      if (bottomSpace > 0) {
        const offset = bottomSpace + 12;
        document.documentElement.style.setProperty("--nav-bottom", `${offset}px`);
        document.documentElement.style.setProperty("--nav-pb", `${bottomSpace}px`);

        // Bottom bar: push up above virtual keyboard
        document.documentElement.style.setProperty("--bb-bottom", `${bottomSpace}px`);
        document.documentElement.style.setProperty("--bb-pb", "0px");
      } else {
        document.documentElement.style.setProperty("--nav-bottom", "1rem");
        document.documentElement.style.setProperty("--nav-pb", "0rem");

        document.documentElement.style.setProperty("--bb-bottom", "0px");
        document.documentElement.style.setProperty("--bb-pb", "0px");
      }
    } else {
      document.documentElement.style.setProperty("--nav-bottom", "1rem");
      document.documentElement.style.setProperty("--nav-pb", "0rem");

      document.documentElement.style.setProperty("--bb-bottom", "0px");
      document.documentElement.style.setProperty("--bb-pb", "0px");
    }
  }

  getContentHeight() {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;

    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const cacheKey = "contentHeightCache";

    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey));
      if (cached && cached.viewportHeight === viewportHeight) {
        document.documentElement.style.setProperty("--content-height", `${cached.height}px`);
        return;
      }
    } catch (e) {}

    const bottomBar = document.getElementById("bottom-bar");
    if (!bottomBar) return;

    const tabLabel = document.querySelector(".tab-list__item label");
    const tabLabelHeight = tabLabel ? tabLabel.offsetHeight : 44;

    const bottomBarHeight = bottomBar.offsetHeight || 76;
    const bottomBarMargin = 10;

    const availableHeight = viewportHeight - tabLabelHeight - bottomBarHeight - bottomBarMargin;

    if (availableHeight > 0) {
      document.documentElement.style.setProperty("--content-height", `${availableHeight}px`);

      try {
        localStorage.setItem(cacheKey, JSON.stringify({ height: availableHeight, viewportHeight }));
      } catch (e) {}
    }
  }
}
