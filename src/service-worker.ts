/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

// 'version' updates automatically on every build/deployment
const CACHE_NAME = `ossm-cache-${version}`;

// 'build' contains all Vite-generated JS/CSS chunks
// 'files' contains everything from your /static directory
const PRECACHE_ASSETS = [...build, ...files];

const sw = self as unknown as ServiceWorkerGlobalScope;

const INCLUDE_CACHE_LIVE_MATCHERS: RegExp[] = [
  /^https:\/\/fonts\.googleapis\.com\/.*/,
  /^https:\/\/fonts\.gstatic\.com\/.*/
];

// Pre-cache all build outputs and static assets on install
sw.addEventListener('install', (event) => {
    event.waitUntil(
        caches
        .open(CACHE_NAME)
        .then((cache) => cache.addAll(PRECACHE_ASSETS))
        .then(() => sw.skipWaiting())
    );
});

// Purge obsolete caches from previous builds on activation
sw.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
        .keys()
        .then(async (keys) => {
            for (const key of keys)
                if (key !== CACHE_NAME)
                    await caches.delete(key);
        })
        .then(() => sw.clients.claim())
    );
});

// Fetch event handler using Cache-First for static assets & Network-First for dynamic requests
sw.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE_NAME);

            // Cache-First for known static app assets
            if (PRECACHE_ASSETS.includes(url.pathname)) {
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) return cachedResponse;
            }

            // Network-First for external assets and matchers
            try {
                const response = await fetch(event.request);

                if (response.status === 200) {
                    const shouldCache = INCLUDE_CACHE_LIVE_MATCHERS.some((matcher) => matcher.test(event.request.url));
                    if (shouldCache) cache.put(event.request, response.clone());
                }
                return response;
            } catch {
                // Fallback to cache if network is unreachable
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) return cachedResponse;

                // Offline navigation fallback
                if (event.request.mode === 'navigate') {
                    const offlineFallback = await cache.match('/offline.html');
                    if (offlineFallback) return offlineFallback;
                }

                return new Response('Network error', {
                    status: 408,
                    headers: { 'Content-Type': 'text/plain' }
                });
            }
        })()
    );
});
