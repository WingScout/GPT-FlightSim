const CACHE_NAME = 'flygsim-v1';
const ASSETS = [
  './',
  './index.html',
  './main.js',
  './physics.js',
  './controls.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  'https://unpkg.com/three@0.161.0/build/three.module.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k!==CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Cache-first for same-origin and the three.js CDN asset
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(resp => {
        // Cache new GET responses
        if (event.request.method === 'GET' && (url.origin === location.origin || url.hostname === 'unpkg.com')) {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
        }
        return resp;
      }).catch(() => {
        // Fallback: basic offline page if needed
        return caches.match('./index.html');
      });
    })
  );
});
