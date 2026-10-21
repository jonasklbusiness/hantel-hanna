// Service Worker: macht die App offline nutzbar (z. B. im Gym ohne Empfang).
// Liefert sofort die gespeicherte Version und lädt im Hintergrund Updates nach.
const CACHE = 'hantel-hanna-v1';
const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request, { ignoreSearch: true });
    const fresh = fetch(event.request)
      .then(response => { if (response.ok) cache.put(event.request, response.clone()); return response; })
      .catch(() => cached);
    if (cached) { event.waitUntil(fresh); return cached; }
    return fresh;
  }));
});
