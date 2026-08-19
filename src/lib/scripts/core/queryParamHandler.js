// src/lib/scripts/core/queryParamHandler.js
// PWA query parameter handler: ?new=true, share_target, protocol handler (?note=)

export class QueryParamHandler {
  static init(search = window.location.search, pathname = window.location.pathname) {
    if (typeof URLSearchParams === "undefined") return;

    const params = new URLSearchParams(search);
    if (!params.toString()) return;

    const cleanedKeys = [];

    // ?new=true → create a new tab
    if (params.has("new")) {
      window.tabManager?.createTab();
      cleanedKeys.push("new");
    }

    // Protocol handler: ?note=<id or content>
    if (params.has("note")) {
      const noteValue = params.get("note");
      if (window.tabManager) {
        window.tabManager.createTab(noteValue || "Shared Note");
      }
      cleanedKeys.push("note");
    }

    // Share target: ?title=&text=&url=
    const hasShare = params.has("title") || params.has("text") || params.has("url");
    if (hasShare) {
      const title = params.get("title") || "Shared Note";
      const text = params.get("text") || "";
      const url = params.get("url") || "";

      let content = "";
      if (text) content += text;
      if (url) {
        if (content) content += "\n\n";
        content += `[${url}](${url})`;
      }

      if (window.tabManager) {
        window.tabManager.createTab(title, content);
      } else {
        const existingTab = document.querySelector(".tab-list__item--content");
        if (existingTab) {
          existingTab.innerHTML = `<div>${content}</div>`;
        }
      }

      cleanedKeys.push("title", "text", "url");
    }

    // Clean URL (remove processed params)
    for (const key of cleanedKeys) {
      params.delete(key);
    }

    const remaining = params.toString();
    const newUrl = remaining
      ? `${pathname}?${remaining}`
      : pathname;

    window.history.replaceState({}, "", newUrl);
  }

  static registerProtocolHandler() {
    if (typeof navigator === "undefined" || typeof navigator.registerProtocolHandler === "undefined") return;

    const origin = window.location.origin;
    navigator.registerProtocolHandler(
      "web+tomanote",
      `${origin}/?note=%s`,
      "TomaNote"
    );
  }
}
