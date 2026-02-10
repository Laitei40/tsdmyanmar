/**
 * TSD Myanmar — Service Worker
 * Provides offline support via the Cache API.
 *
 * Strategy:
 *  • INSTALL  — pre-cache the app shell (HTML pages, CSS, core JS, logos).
 *  • FETCH
 *      - Navigation requests → Network-first, fall back to cache, then offline page.
 *      - Static assets (CSS, JS, images, fonts) → Cache-first, fall back to network
 *        and update the cache in the background (stale-while-revalidate for images).
 *      - API / other → Network-only (no caching for dynamic API data by default).
 *  • ACTIVATE — purge old cache versions automatically.
 */

const CACHE_VERSION = 'tsd-v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const PAGE_CACHE   = `pages-${CACHE_VERSION}`;
const IMG_CACHE    = `images-${CACHE_VERSION}`;

/* ------------------------------------------------------------------ */
/*  App Shell – resources pre-cached on install                       */
/* ------------------------------------------------------------------ */
const APP_SHELL = [
  '/',
  '/index.html',
  '/about.html',
  '/contact.html',
  '/donate.html',
  '/education.html',
  '/education-ambassadors.html',
  '/food-security.html',
  '/get-involved.html',
  '/impact.html',
  '/inclusion.html',
  '/join-our-team.html',
  '/our-approach.html',
  '/partners.html',
  '/projects.html',
  '/relief-drr.html',
  '/updates.html',
  '/updates-archive.html',
  '/update.html',
  '/what-we-do.html',
  '/where-we-work.html',
  '/who-we-are.html',
  '/404.html',

  // CSS
  '/css/main.css',
  '/css/style.css',
  '/css/update.css',
  '/css/updates.css',

  // Core JS
  '/js/core/theme.js',
  '/js/core/icon-theme.js',
  '/js/core/header.js',
  '/js/core/i18n.js',
  '/js/layout.js',
  '/js/main.js',
  '/js/components/hero-slider.js',
  '/js/components/testimonials.js',
  '/js/components/hero-motto.js',
  '/js/components/footer-nav.js',
  '/js/pages/updates.js',
  '/js/pages/update-detail.js',
  '/js/pages/updates-archive.js',

  // Layout components
  '/components/header.html',
  '/components/footer.html',

  // i18n
  '/i18n/en/common.json',
  '/i18n/mrh/common.json',
  '/i18n/my/common.json',

  // Logos & icons
  '/assets/images/logo/logo_en.svg',
  '/assets/images/logo/logo_mara.svg',
  '/assets/images/logo/logo_mrh.svg',
  '/assets/images/logo/logo_my.svg',
  '/assets/images/logo/logo_mm.svg',
  '/assets/images/logo/favicon.svg',
  '/assets/images/logo/logo.svg',

  // Manifest
  '/manifest.json'
];

/* ------------------------------------------------------------------ */
/*  INSTALL – pre-cache app shell                                     */
/* ------------------------------------------------------------------ */
self.addEventListener('install', event => {
  self.skipWaiting();                       // activate immediately
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      // Use addAll with individual error tolerance so one 404 doesn't
      // block the whole install.
      return Promise.allSettled(
        APP_SHELL.map(url =>
          cache.add(url).catch(err => {
            console.warn('[SW] Failed to pre-cache:', url, err.message);
          })
        )
      );
    })
  );
});

/* ------------------------------------------------------------------ */
/*  ACTIVATE – clean up old caches                                    */
/* ------------------------------------------------------------------ */
self.addEventListener('activate', event => {
  const keep = new Set([STATIC_CACHE, PAGE_CACHE, IMG_CACHE]);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => !keep.has(k)).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())       // take control of open tabs
  );
});

/* ------------------------------------------------------------------ */
/*  FETCH – routing strategies                                        */
/* ------------------------------------------------------------------ */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  // Skip non-GET (form submissions, etc.)
  if (request.method !== 'GET') return;

  // Skip admin panel and API routes
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/')) return;

  // ---- Navigation (HTML pages) → Network-first ----
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstPage(request));
    return;
  }

  // ---- Images → Stale-while-revalidate ----
  if (isImage(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, IMG_CACHE));
    return;
  }

  // ---- CSS / JS / JSON / SVG / fonts → Cache-first ----
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
});

/* ------------------------------------------------------------------ */
/*  Strategies                                                        */
/* ------------------------------------------------------------------ */

/**
 * Network-first for pages: try the network, cache the fresh copy,
 * fall back to cache, then fall back to the offline page.
 */
async function networkFirstPage(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Final fallback — serve the offline 404 page
    const fallback = await caches.match('/404.html');
    return fallback || new Response(
      '<h1>Offline</h1><p>Please check your internet connection.</p>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/**
 * Cache-first for static assets: serve from cache if available,
 * otherwise fetch and cache the result.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (_) {
    return new Response('', { status: 408, statusText: 'Offline' });
  }
}

/**
 * Stale-while-revalidate for images: return the cached version
 * immediately while fetching a fresh copy in the background.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);

  return cached || (await fetchPromise) || new Response('', { status: 408 });
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function isImage(pathname) {
  return /\.(jpe?g|png|gif|webp|avif|svg|ico)$/i.test(pathname);
}

function isStaticAsset(pathname) {
  return /\.(css|js|json|woff2?|ttf|eot|otf)$/i.test(pathname);
}
