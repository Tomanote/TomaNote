// src/lib/scripts/core/__tests__/fontManagerOfflineFallback.test.js
// Milestone 0.5.8 — Fallback Resource Operations.
// Remote Google Fonts requests must never crash the app: when the browser is
// offline we skip the remote <link> entirely and apply the local fallback
// family immediately; when a stylesheet request fails we recover silently.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FontManager } from "../fontManager.js";

function setNavigatorOnline(value) {
  Object.defineProperty(window.navigator, "onLine", {
    value,
    writable: true,
    configurable: true,
  });
}

describe("FontManager — offline & remote-failure fallback (0.5.8)", () => {
  let fontManager;
  let appendChildSpy;
  let setPropertySpy;
  let createdLinks;

  beforeEach(() => {
    fontManager = new FontManager();
    createdLinks = [];

    appendChildSpy = vi.fn((link) => {
      createdLinks.push(link);
      return link;
    });
    setPropertySpy = vi.fn();

    // Fresh document mocks (jsdom shared document across this file only)
    Object.defineProperty(document, "head", {
      writable: true,
      configurable: true,
      value: { appendChild: appendChildSpy },
    });
    Object.defineProperty(document, "documentElement", {
      writable: true,
      configurable: true,
      value: { style: { setProperty: setPropertySpy } },
    });
    Object.defineProperty(document, "createElement", {
      writable: true,
      configurable: true,
      value: vi.fn(() => ({
        rel: "",
        href: "",
        onerror: null,
        onload: null,
        remove: vi.fn(),
      })),
    });
    document.querySelectorAll = vi.fn(() => []);

    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    setNavigatorOnline(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete window.connectivity;
  });

  it("skips the remote stylesheet entirely while offline and applies the fallback family", () => {
    setNavigatorOnline(false);
    global.localStorage.getItem.mockImplementation((key) =>
      key === "customFontUrl" ? "https://fonts.googleapis.com/css2?family=Roboto" : null
    );

    fontManager.loadCustomFont();

    expect(appendChildSpy).not.toHaveBeenCalled();
    // Family still applied locally with the fallback stack so text never breaks
    expect(setPropertySpy).toHaveBeenCalledWith("--font-family-notes", "'Roboto', sans-serif, serif");
  });

  it("applies the default font while offline when the URL cannot be parsed", () => {
    setNavigatorOnline(false);
    global.localStorage.getItem.mockImplementation((key) =>
      key === "customFontUrl" ? "not-a-url-without-family" : null
    );

    fontManager.loadCustomFont();

    expect(appendChildSpy).not.toHaveBeenCalled();
    expect(setPropertySpy).toHaveBeenCalledWith("--font-family-notes", "'Inter', sans-serif, serif");
  });

  it("loadCustomFont never throws when localStorage itself throws (private mode)", () => {
    global.localStorage.getItem.mockImplementation(() => {
      throw new Error("Storage disabled");
    });

    expect(() => fontManager.loadCustomFont()).not.toThrow();
    expect(setPropertySpy).toHaveBeenCalledWith("--font-family-notes", "'Inter', sans-serif, serif");
  });

  it("recovers silently when the remote stylesheet fails to load (onerror)", () => {
    global.localStorage.getItem.mockImplementation((key) =>
      key === "customFontUrl" ? "https://fonts.googleapis.com/css2?family=Poppins" : null
    );

    fontManager.loadCustomFont();
    expect(appendChildSpy).toHaveBeenCalledTimes(1);

    const link = createdLinks[0];
    expect(typeof link.onerror).toBe("function");

    // Simulate network failure — must not throw, must keep a usable font stack
    expect(() => link.onerror()).not.toThrow();
    expect(setPropertySpy).toHaveBeenCalledWith("--font-family-notes", "'Poppins', sans-serif, serif");
  });

  it("changeNoteFont while offline saves the preference locally without a network request", () => {
    setNavigatorOnline(false);

    const result = fontManager.changeNoteFont("https://fonts.googleapis.com/css2?family=Montserrat", "Montserrat");

    expect(result).toBe(true);
    expect(appendChildSpy).not.toHaveBeenCalled();
    expect(global.localStorage.setItem).toHaveBeenCalledWith("customFontUrl", "https://fonts.googleapis.com/css2?family=Montserrat");
    expect(setPropertySpy).toHaveBeenCalledWith("--font-family-notes", "'Montserrat', sans-serif, serif");
  });

  it("changeNoteFont never throws when localStorage throws", () => {
    global.localStorage.setItem.mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => fontManager.changeNoteFont("https://fonts.googleapis.com/css2?family=Inter", "Inter")).not.toThrow();
  });
});
