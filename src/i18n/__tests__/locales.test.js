import { describe, it, expect } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";

const nonCommentKeys = (locale) =>
  Object.keys(locale)
    .filter((key) => !key.startsWith("_comment-"))
    .sort();

describe("Locales parity (EN / ES)", () => {
  it("should have the same set of non-comment keys in both locales", () => {
    expect(nonCommentKeys(en)).toEqual(nonCommentKeys(es));
  });

  it("should include every command-palette key in both locales", () => {
    const commandPaletteKeys = Object.keys(en).filter((key) => key.startsWith("command-palette."));
    expect(commandPaletteKeys.length).toBeGreaterThan(0);

    commandPaletteKeys.forEach((key) => {
      expect(es[key], `Missing ES translation for "${key}"`).toBeDefined();
    });
  });
});
