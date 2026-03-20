// TT Weather Service Worker
const CACHE_NAME = 'tt-weather-v1';
const SHELL_URLS = [
  '/TT-Weather/tt-weather.html',
  '/TT-Weather/manifest.json',
  '/TT-Weather/icon-192.png',
  '/TT-Weather/icon-512.png',
];

// ── Install: cache the app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: shell → cache-first, API → network-first ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to network for weather APIs
  const isAPI = url.hostname.includes('open-meteo.com') ||
                url.hostname.includes('weather.gov') ||
                url.hostname.includes('openstreetmap.org') ||
                url.hostname.includes('overpass-api.de') ||
                url.hostname.includes('rainviewer.com') ||
                url.hostname.includes('nominatim') ||
                url.hostname.includes('osrm') ||
                url.hostname.includes('windy.com') ||
                url.hostname.includes('arcgisonline.com') ||
                url.hostname.includes('cartocdn.com') ||
                url.hostname.includes('unpkg.com');

  if (isAPI) {
    // Network-first with fallback
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Shell files: cache-first, then network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful GET responses for shell files
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
