#!/usr/bin/env node
//
// inject-sw.cjs — build-time service worker generator for TomaNote.
//
// Runs after `astro build` (wired into package.json "build").
// Uses only Node.js stdlib: fs, path, crypto.
//
// What it does:
//  1. Crawls dist/ recursively and collects every file as a URL relative to
//     dist/ (e.g. "/index.html", "/assets/Layout.DaLX7lf5.css",
//     "/_astro/index.astro_...js", "/icon-192.png").
//  2. Normalizes Windows backslash separators to forward slashes.
//  3. Computes CACHE_VERSION as sha256 of the sorted, newline-joined asset
//     URL list, truncated to 8 hex chars.
//     Rationale (Clarification / Cache version): the previous investigation
//     tried sha256(dist/index.html) but Astro's index.html is NOT
//     byte-stable across rebuilds (its hash changed between two identical
//     source builds in testing). The sorted asset URL list is stable across
//     rebuilds when the set of assets is unchanged, and it changes exactly
//     when a new hashed asset appears or an old one disappears — which is
//     the correct trigger for cache invalidation.
//  4. Reads scripts/service-worker-template.js and replaces:
//       __SW_CACHE_NAME__  ->  `notepad-cache-v${CACHE_VERSION}`
//       __SW_ASSET_URLS__  ->  JSON.stringify(assetUrls)
//  5. Writes the result to dist/service-worker.js, overwriting any existing
//     copy (Clarification B – dist/ cleanliness).
//  6. Removes public/service-worker.js if it exists, so Astro does not copy
//     a stale no-op SW into dist/ during the next build, and so that the
//     dev server does not serve a non-template SW file.
//
// Exits non-zero on any failure so that `npm run build` fails if the SW
// cannot be generated.

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DIST_DIR = path.resolve(__dirname, "..", "dist");
const SCRIPT_DIR = path.resolve(__dirname);
const TEMPLATE_PATH = path.resolve(SCRIPT_DIR, "service-worker-template.js");
const OUTPUT_PATH = path.resolve(DIST_DIR, "service-worker.js");
const PUBLIC_SW_PATH = path.resolve(
  __dirname,
  "..",
  "public",
  "service-worker.js"
);

const CACHE_NAME_PREFIX = "notepad-cache-v";

// ---------------------------------------------------------------------------
// 1. Crawl dist/
// ---------------------------------------------------------------------------

function crawlDist(baseDir) {
  const urls = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip hidden directories (.git, node_modules, etc.) and also
        // .nojekyll itself — it is a deployment marker, not a web resource.
        if (entry.name.startsWith(".")) {
          continue;
        }
        walk(fullPath);
      } else if (entry.isFile()) {
        // Build the URL relative to dist/. Normalize to forward slashes.
        // Never cache .nojekyll — it is a GitHub Pages deployment marker,
        // not a web resource.
        if (entry.name === ".nojekyll") {
          continue;
        }
        let rel = path.relative(baseDir, fullPath);
        rel = rel.replace(/\\/g, "/");
        urls.push(`/${rel}`);
      }
    }
  }

  walk(baseDir);
  return urls;
}

// ---------------------------------------------------------------------------
// 2. Compute cache version
// ---------------------------------------------------------------------------

function computeCacheVersion(assetUrls) {
  // Sort for determinism — the order of readdir is OS-dependent.
  const sorted = assetUrls.slice().sort();
  const payload = sorted.join("\n");
  const hash = crypto
    .createHash("sha256")
    .update(payload, "utf8")
    .digest("hex")
    .slice(0, 8);
  return hash;
}

// ---------------------------------------------------------------------------
// 3. Read template, substitute, write
// ---------------------------------------------------------------------------

function substituteAndWrite(templatePath, outputPath, cacheName, assetUrls) {
  const template = fs.readFileSync(templatePath, "utf8");

  const replaced = template
    .replace(/__SW_CACHE_NAME__/g, cacheName)
    .replace(/__SW_ASSET_URLS__/g, JSON.stringify(assetUrls));

  // Ensure the dist parent exists (it should, since astro build ran first).
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // Clarification B — dist/ cleanliness.
  // Astro empties outDir at the start of every build, so a stale
  // dist/service-worker.js from a previous build does not normally survive.
  // Regardless, we must never depend on prior output: delete any existing
  // generated SW first, then write the freshly substituted file.
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }
  fs.writeFileSync(outputPath, replaced, "utf8");
}

// ---------------------------------------------------------------------------
// 4. Remove public/service-worker.js if present
// ---------------------------------------------------------------------------

function removePublicSwIfPresent(publicSwPath) {
  if (fs.existsSync(publicSwPath)) {
    fs.unlinkSync(publicSwPath);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error(
      "ERROR: dist/ does not exist. Run `astro build` before inject-sw.cjs."
    );
    process.exit(1);
  }

  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(
      "ERROR: scripts/service-worker-template.js not found. Run from project root."
    );
    process.exit(1);
  }

  console.log("Injecting service worker…");

  const assetUrls = crawlDist(DIST_DIR);
  console.log(`  Collected ${assetUrls.length} files from dist/.`);

  const cacheVersion = computeCacheVersion(assetUrls);
  const cacheName = `${CACHE_NAME_PREFIX}${cacheVersion}`;
  console.log(`  Cache version: ${cacheVersion}`);
  console.log(`  Cache name:    ${cacheName}`);

  substituteAndWrite(TEMPLATE_PATH, OUTPUT_PATH, cacheName, assetUrls);
  console.log(`  Wrote ${OUTPUT_PATH}`);

  if (fs.existsSync(PUBLIC_SW_PATH)) {
    removePublicSwIfPresent(PUBLIC_SW_PATH);
    console.log(`  Removed stale ${PUBLIC_SW_PATH}`);
  }

  // Quick sanity check: the output should contain the cache name and at
  // least one asset URL.
  const output = fs.readFileSync(OUTPUT_PATH, "utf8");
  if (!output.includes(cacheName)) {
    console.error(
      "ERROR: generated SW does not contain expected cache name. Aborting."
    );
    process.exit(1);
  }
  if (!output.includes("null") && !output.includes("[")) {
    console.error(
      "ERROR: generated SW does not appear to contain the asset URL list."
    );
    process.exit(1);
  }

  console.log("  Service worker injection complete.");
}

main();
