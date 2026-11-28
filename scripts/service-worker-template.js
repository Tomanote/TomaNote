// Service worker template for TomaNote.
// Built by scripts/inject-sw.cjs — never edit the deployed copy directly.
//
// Placeholders replaced at build time:
//   __SW_CACHE_NAME__  – cache name derived from a hash of the built shell
//   __SW_ASSET_URLS__  – JSON array of every file under dist/, as URLs

const CACHE_NAME = '__SW_CACHE_NAME__';
const ASSET_URLS = __SW_ASSET_URLS__;

// ---------------------------------------------------------------------------
// Install – pre-cache the entire app shell atomically.
// event.waitUntil keeps the install alive until every URL is cached, so the
// new service worker never activates with a partially-populated cache.
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSET_URLS))
  );
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Activate – clean up old cache versions, then take control of all clients.
// Deletes any cache whose name starts with "notepad-cache-v" except the
// current one. This covers the transition from the old no-op "v1" SW.
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      const oldKeys = keys.filter((key) =>
        key.startsWith('notepad-cache-v') && key !== CACHE_NAME
      );
      return Promise.all(oldKeys.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

// ---------------------------------------------------------------------------
// Fetch – route-specific strategies.
// Only same-origin GET requests are intercepted. Third-party requests
// (Google Fonts, etc.) pass through untouched.
//
// [Clarification A – navigation URL normalization]
// Option 2 is implemented here: the fetch handler normalizes "/" ->
// "/index.html" before cache lookup. This is the most correct choice
// because (a) it does not pollute Cache Storage with duplicate entries for
// the same resource, (b) it matches what browsers do when a user types "/"
// (the server returns index.html), and (c) it keeps the asset list clean —
// the build script collects exactly the files that exist on disk.
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle same-origin GET requests.
  if (
    request.method !== 'GET' ||
    new URL(request.url).origin !== self.location.origin
  ) {
    return;
  }
  const url = new URL(request.url);

  // Normalize root navigation: "/" -> "/index.html" for cache matching.
  let normalizedUrl = url.toString();
  if (url.pathname === '/' && url.search === '' && url.hash === '') {
    normalizedUrl = '/index.html';
  }

  // Navigation requests: network-first, fall back to cache.
  if (
    request.mode === 'navigate' ||
    (request.headers.has('accept') &&
      request.headers.get('accept').includes('text/html'))
  ) {
    event.respondWith(
      networkFirst(request, normalizedUrl)
    );
    return;
  }

  // Hashed / static app-shell assets: cache-first with background
  // revalidation.
  if (isAppShellUrl(url)) {
    event.respondWith(
      cacheFirstWithRevalidate(request, normalizedUrl)
    );
    return;
  }

  // Everything else (third-party, fonts, etc.): network only.
});

// ---------------------------------------------------------------------------
// Strategy: network-first with cache fallback (for navigation requests).
// On online: fetch from network, cache the response, return it.
// On offline: serve from cache if available.
// ----------------------------------------------------------------------------

async function networkFirst(request, normalizedUrl) {
  // If we are offline, serve straight from cache.
  if (!navigator.onLine) {
    const cached = await caches.match(normalizedUrl);
    if (cached) return cached;
    // No cached shell at all — return a minimal fallback so the user sees
    // something rather than a browser error page. The app is offline-first.
    return caches.match('/index.html');
  }

  try {
    const networkResponse = await fetch(request);
    // Only cache successful responses.
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      // Use the normalized URL as the cache key so "/" and "/index.html"
      // converge to one entry.
      const cacheRequest = new Request(normalizedUrl, {
        headers: { accept: 'text/html' },
      });
      await cache.put(cacheRequest, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Network failed (offline or error). Fall back to cache.
    const cached = await caches.match(normalizedUrl);
    if (cached) return cached;
    const fallback = await caches.match('/index.html');
    if (fallback) return fallback;
    // Absolute fallback: return a minimal HTML document so the user sees
    // something instead of a browser error page.
    return new Response('<html><body><h1>TomaNote</h1><p>Loading...</p></body></html>', {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

// ---------------------------------------------------------------------------
// Strategy: cache-first with background revalidation (for hashed assets).
// The cached response is returned immediately. A background fetch updates
// the cache for the next load. If the fetch fails (offline), the cached
// version stands — no error visible to the user.
// ----------------------------------------------------------------------------

async function cacheFirstWithRevalidate(request, normalizedUrl) {
  const cached = await caches.match(normalizedUrl);
  if (cached) {
    // Fire-and-forget background revalidation.
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          caches.open(CACHE_NAME).then((cache) =>
            cache.put(normalizedUrl, networkResponse)
          );
        }
      })
      .catch(() => {
        // Offline or error — cached version is still valid.
      });
    return cached;
  }

  // Not in cache yet — fetch from network (should only happen during the
  // install phase or on first load; the install handler pre-populates).
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(normalizedUrl, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Not cached and network failed. For hashed assets this really should
    // not happen after install, but if it does, return a generic error.
    return new Response('Not found', { status: 404 });
  }
}

// ---------------------------------------------------------------------------
// Classify a URL as an app-shell asset that should be cached.
//
// App-shell URLs:
//   /index.html              – the entry HTML
//   /assets/*                – CSS and images emitted by Vite (hashed)
//   /_astro/*                – bundled JS modules (hashed chunks)
//   /icon-*.png              – fixed-name PWA icons
//   /manifest.webmanifest    – PWA manifest
//   /favicon.ico             – favicon
//   /robots.txt, /sitemap.xml, /CNAME – static site metadata
//   /og-image.png            – social preview image
//   /screenshot-*.png         – PWA screenshots
//   /icon-svg.svg            – SVG favicon
// ----------------------------------------------------------------------------

function isAppShellUrl(url) {
  const path = url.pathname;
  return (
    path === '/' ||
    path === '/index.html' ||
    path.startsWith('/assets/') ||
    path.startsWith('/_astro/') ||
    path.startsWith('/icon-') ||
    path.startsWith('/icons/') ||
    path === '/manifest.webmanifest' ||
    path === '/favicon.ico' ||
    path === '/robots.txt' ||
    path === '/sitemap.xml' ||
    path === '/CNAME' ||
    path === '/og-image.png' ||
    path.startsWith('/screenshot-') ||
    path.startsWith('/screenshots/') ||
    path === '/icon-svg.svg'
  );
}
