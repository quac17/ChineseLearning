/*
 * Chinese Learner service worker: caches the app shell and the offline page, nothing else.
 *
 * Never cached (they are access-checked or per-user):
 *   - API calls: another origin (api.chineselearner.vn) and any same-origin /api/ path
 *   - video streams (Range requests, destination video/audio) and document downloads
 *   - HTML pages: always from the network; the offline page is the only fallback
 *
 * Registered only by production builds (src/components/pwa/ServiceWorkerRegister.tsx).
 * Bump VERSION when this file's caching rules change.
 */
const VERSION = 'v1';
const SHELL_CACHE = `chinese-learner-shell-${VERSION}`;
const OFFLINE_URL = '/offline';
const PRECACHE = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/brand/favicon.svg',
  '/brand/icon-192.png',
  '/brand/icon-512.png',
  '/brand/chinese-learner-logo-horizontal-full.svg',
  '/brand/chinese-learner-logo-horizontal-reversed.svg',
];

/** The offline page must hydrate with no network: cache every build asset its HTML references. */
async function precacheOfflineAssets(cache) {
  const res = await cache.match(OFFLINE_URL);
  if (!res) return;
  const html = await res.text();
  const assets = new Set(html.match(/\/_next\/static\/[^"'\s\\)]+/g) || []);
  await cache.addAll([...assets]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then(async (cache) => {
        await cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })));
        await precacheOfflineAssets(cache);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('chinese-learner-') && k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Build assets are content-hashed, so a cached copy never goes stale. */
function isShellAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/brand/');
}

function mustBypass(request, url) {
  if (request.method !== 'GET') return true;
  if (url.origin !== self.location.origin) return true; // API, fonts, YouTube
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return true;
  if (request.headers.has('range')) return true; // video streaming
  if (request.destination === 'video' || request.destination === 'audio') return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (mustBypass(request, url)) return; // the browser handles it, no cache

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (isShellAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok && res.type === 'basic') {
              const copy = res.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
  // Anything else (stock photos, RSC payloads…) goes to the network as usual.
});
