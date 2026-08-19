import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { QueryParamHandler } from "../queryParamHandler.js";

describe("QueryParamHandler", () => {
  let originalLocation;
  let originalReplaceState;
  let mockReplaceState;
  let mockTabManager;
  let originalRegisterProtocolHandler;

  beforeEach(() => {
    mockTabManager = { createTab: vi.fn() };
    window.tabManager = mockTabManager;

    mockReplaceState = vi.fn();
    originalReplaceState = window.history.replaceState;
    window.history.replaceState = mockReplaceState;

    originalRegisterProtocolHandler = navigator.registerProtocolHandler;

    originalLocation = { ...window.location };
  });

  afterEach(() => {
    window.history.replaceState = originalReplaceState;
    navigator.registerProtocolHandler = originalRegisterProtocolHandler;
    vi.restoreAllMocks();
  });

  function setLocation(search, pathname = "/") {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        pathname,
        search,
        origin: "https://tomanote.app",
        href: `https://tomanote.app${pathname}${search}`,
      },
    });
  }

  describe("init() — ?new=true", () => {
    it("creates a new tab when ?new=true is present", () => {
      setLocation("?new=true");
      QueryParamHandler.init();
      expect(mockTabManager.createTab).toHaveBeenCalledTimes(1);
    });

    it("cleans up ?new=true from the URL", () => {
      setLocation("?new=true&foo=bar");
      QueryParamHandler.init();
      expect(mockReplaceState).toHaveBeenCalled();
      expect(mockReplaceState).toHaveBeenCalledWith({}, "", "/?foo=bar");
    });
  });

  describe("init() — share target (title/text/url)", () => {
    it("creates a new tab with shared content", () => {
      setLocation("?title=Shared&text=Hello&url=https://example.com");
      QueryParamHandler.init();
      expect(mockTabManager.createTab).toHaveBeenCalledWith(
        "Shared",
        "Hello\n\n[https://example.com](https://example.com)"
      );
    });

    it("works with only text", () => {
      setLocation("?text=Some+text");
      QueryParamHandler.init();
      expect(mockTabManager.createTab).toHaveBeenCalledWith(
        "Shared Note",
        "Some text"
      );
    });

    it("works with only url", () => {
      setLocation("?url=https://example.com");
      QueryParamHandler.init();
      expect(mockTabManager.createTab).toHaveBeenCalledWith(
        "Shared Note",
        "[https://example.com](https://example.com)"
      );
    });

    it("cleans up share params from the URL", () => {
      setLocation("?title=Shared&text=Hello");
      QueryParamHandler.init();
      expect(mockReplaceState).toHaveBeenCalledWith({}, "", "/");
    });
  });

  describe("init() — protocol handler (?note=)", () => {
    it("creates a tab with the note value when ?note= is present", () => {
      setLocation("?note=abc123");
      QueryParamHandler.init();
      expect(mockTabManager.createTab).toHaveBeenCalledWith("abc123");
    });

    it("cleans up ?note= from the URL", () => {
      setLocation("?note=abc123&foo=bar");
      QueryParamHandler.init();
      expect(mockReplaceState).toHaveBeenCalledWith({}, "", "/?foo=bar");
    });
  });

  describe("init() — no params", () => {
    it("does nothing when there are no params", () => {
      setLocation("");
      QueryParamHandler.init();
      expect(mockTabManager.createTab).not.toHaveBeenCalled();
      expect(mockReplaceState).not.toHaveBeenCalled();
    });
  });

  describe("registerProtocolHandler()", () => {
    it("calls navigator.registerProtocolHandler when available", () => {
      navigator.registerProtocolHandler = vi.fn();

      QueryParamHandler.registerProtocolHandler();
      expect(navigator.registerProtocolHandler).toHaveBeenCalledWith(
        "web+tomanote",
        "https://tomanote.app/?note=%s",
        "TomaNote"
      );
    });

    it("does not throw when registerProtocolHandler is unavailable", () => {
      navigator.registerProtocolHandler = undefined;
      expect(() => QueryParamHandler.registerProtocolHandler()).not.toThrow();
    });
  });
});
