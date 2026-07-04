// TT Weather Service Worker
const CACHE_NAME = 'tt-weather-v3';
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

// ── Fetch: shell → stale-while-revalidate, API → network-first ──
self.addEventListener('fetch', event => {
  // Only handle GET requests — POST/PUT/etc should always hit the network directly
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Always go to network for weather/location/live-data APIs.
  // Missing any API hostname here means the SW will cache-first it forever,
  // which shows up as "data never updates" bugs. Add new APIs as we adopt them.
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
                url.hostname.includes('unpkg.com') ||
                url.hostname.includes('wheretheiss.at');

  if (isAPI) {
    // Network-first with fallback — live data should be fresh, cache only serves as offline backup
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Shell files (HTML, icons, manifest, etc): stale-while-revalidate.
  //   • Return cached version immediately for instant app load.
  //   • In parallel, fetch from network in the background and update the cache.
  //   • Result: next app open always shows the newest deployed version.
  // This is the strategy that makes "push to GitHub → see update on next open"
  // work correctly without requiring users to clear cache manually.
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(response => {
          // Only cache successful responses. Avoid caching 404s / 500s / opaque redirects.
          if (response && response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => cached); // If offline and no cache, the outer promise will reject (expected)

        // If we have a cached copy, return it immediately and let the network update run in background.
        // If we don't, wait for the network fetch.
        return cached || networkFetch;
      });
    })
  );
});
