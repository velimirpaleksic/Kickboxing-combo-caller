const CACHE_NAME = 'kombinacije-v6';
const assetUrl = (path) => new URL(path, self.location.href).href;
const INDEX_URL = assetUrl('./index.html');
const SCOPE_URL = assetUrl('./');
const ASSETS_URL = assetUrl('./assets/');
const CORE_ASSETS = ['./manifest.json', './icon.svg'].map(assetUrl);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const indexResponse = await fetch(INDEX_URL, { cache: 'reload' });
      const html = await indexResponse.clone().text();
      const buildAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((match) => new URL(match[1], INDEX_URL).href)
        .filter((url) => {
          const parsedUrl = new URL(url);
          return parsedUrl.origin === self.location.origin && url.startsWith(ASSETS_URL);
        });

      await cache.put(SCOPE_URL, indexResponse.clone());
      await cache.put(INDEX_URL, indexResponse);
      await cache.addAll([...new Set([...CORE_ASSETS, ...buildAssets])]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(INDEX_URL));
    })
  );
});
