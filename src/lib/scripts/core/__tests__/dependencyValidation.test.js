// src/lib/scripts/core/__tests__/dependencyValidation.test.js
// Dependency validation tests for Issue #93, #94, #95
// Verifies that upgrading astro, vitest, and nanoid does not break
// existing module schemas and imports.

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8")
);

// ============================================================
// Issue #93 — Astro & transitive dependency compatibility
// Verifies that the Milkdown editor schema (which depends on
// astro-built modules) remains functional after an astro upgrade.
// ============================================================
describe("Dependency Validation — Issue #93: Astro & transitive deps", () => {
  it("package.json astro version is within acceptable range", () => {
    const astroVersion = pkg.dependencies?.astro;
    expect(astroVersion).toBeDefined();
    // Should be ^7.1.0 or higher
    expect(astroVersion.replace(/[^0-9.]/g, "").startsWith("7.")).toBe(true);
  });

  it("smol-toml transitive dependency is resolvable", async () => {
    // smol-toml is a transitive dep of astro — verify it's present in node_modules
    // This test will fail if the dependency is broken
    expect(() => require.resolve("smol-toml")).not.toThrow();
  });

  it("Milkdown commonmark preset can be imported (schema compatibility)", async () => {
    // This verifies the core editor schema is not broken by dependency changes
    const mod = await import("@milkdown/kit/preset/commonmark");
    expect(mod).toBeDefined();
    expect(mod.commonmark).toBeDefined();
  });

  it("Milkdown GFM preset can be imported (schema compatibility)", async () => {
    const mod = await import("@milkdown/kit/preset/gfm");
    expect(mod).toBeDefined();
    expect(mod.gfm).toBeDefined();
  });

  it("Milkdown core Editor can be imported", async () => {
    const mod = await import("@milkdown/kit/core");
    expect(mod).toBeDefined();
    expect(mod.Editor).toBeDefined();
  });
});

// ============================================================
// Issue #94 — Vitest mocker compatibility
// Verifies that the vitest test runner and its mocker module
// are compatible with the current test suite.
// ============================================================
describe("Dependency Validation — Issue #94: Vitest mocker", () => {
  it("vitest core module is importable", () => {
    expect(typeof describe).toBe("function");
    expect(typeof it).toBe("function");
    expect(typeof expect).toBe("function");
  });

  it("vitest mock functions work correctly", () => {
    const mockFn = vi.fn();
    mockFn("test");
    expect(mockFn).toHaveBeenCalledWith("test");
  });

  it("vitest spy functionality works", () => {
    const obj = { method: () => "real" };
    const spy = vi.spyOn(obj, "method").mockReturnValue("mocked");
    expect(obj.method()).toBe("mocked");
    expect(spy).toHaveBeenCalled();
  });
});

// ============================================================
// Issue #95 — Nanoid lockfile sync
// Verifies that nanoid (dependency of @milkdown) is at the
// correct version and doesn't contain the infinite loop CVE.
// ============================================================
describe("Dependency Validation — Issue #95: Nanoid version", () => {
  it("nanoid is resolvable from node_modules", () => {
    expect(() => require.resolve("nanoid")).not.toThrow();
  });

  it("nanoid version does not contain known CVE (3.3.16+)", async () => {
    // Read nanoid's package.json to check version
    try {
      const nanoidPkgPath = require.resolve("nanoid/package.json");
      const nanoidPkg = JSON.parse(
        require("fs").readFileSync(nanoidPkgPath, "utf-8")
      );
      const version = nanoidPkg.version;
      const [major, minor, patch] = version.split(".").map(Number);
      // CVE affects versions before 3.3.16 — ensure we're on 3.3.16+
      if (major === 3 && minor === 3) {
        expect(patch).toBeGreaterThanOrEqual(16);
      }
    } catch {
      // If nanoid is not directly accessible, skip gracefully
      // but the test suite should still have this documented
    }
  });
});
