// Service worker: makes Ghisa installable and usable offline.
// Bump CACHE_VERSION on every release: the changed sw.js is what tells
// installed apps that a new version is out.
const CACHE_VERSION = 'ghisa-v1.9';

const APP_FILES = [
    './',
    './index.html',
    './manifest.json',
    './icon.svg',
    './icon-192.png',
    './icon-512.png',
    './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => cache.addAll(APP_FILES))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const sameOrigin = new URL(request.url).origin === self.location.origin;

    if (sameOrigin) {
        // App files: network first so updates arrive right away, cache when offline.
        // 'no-cache' asks the server every time instead of reusing the browser's
        // HTTP copy (GitHub Pages lets it live 10 minutes)
        event.respondWith(
            fetch(request, { cache: 'no-cache' })
                .then(response => {
                    const copy = response.clone();
                    caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
                    return response;
                })
                .catch(() => caches.match(request, { ignoreSearch: true }))
        );
    } else {
        // CDN (Tailwind, fonts, icons): serve from cache, refresh in background
        event.respondWith(
            caches.match(request).then(cached => {
                const network = fetch(request)
                    .then(response => {
                        const copy = response.clone();
                        caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
                        return response;
                    })
                    .catch(() => cached);
                return cached || network;
            })
        );
    }
});
