const CACHE_NAME = 'ossm-web-control-cache-v1';

/* Don't cache the PWA script, the browser handles this
 * See: //https://stackoverflow.com/questions/55027512/should-i-cache-the-serviceworker-file-in-a-pwa
 */
const INCLUDE_CACHE_LOCAL_URLS: string[] = [
    "./ossm-ble/ossmBle.js",
    "./favicon.png",
    "./index.html",
    "./manifest.json",
    "./offline.html",
    "./script.js",
    "./styles.css",
    "./styles.js",
    // CSS font's too complicated to precache for now, rely on built-in fallback font.
];
const EXCLUDE_CACHE_LOCAL_URLS: string[] = [
    "./pwa.js",
];
const INCLUDE_CACHE_LIVE_MATCHERS: RegExp[] = [
    /^https:\/\/fonts\.googleapis\.com\/.*/,
    /^https:\/\/fonts\.gstatic\.com\/.*/,
];
const EXCLUDE_CACHE_LIVE_MATCHERS: RegExp[] = [
];

// https://stackoverflow.com/questions/51503754/typescript-type-beforeinstallpromptevent
export interface BeforeInstallPromptEvent extends Event {
    /**
     * Returns an array of DOMString items containing the platforms on which the event was dispatched.
     * This is provided for user agents that want to present a choice of versions to the user such as,
     * for example, "web" or "play" which would allow the user to chose between a web version or
     * an Android version.
     */
    readonly platforms: Array<string>;

    /**
     * Returns a Promise that resolves to a DOMString containing either "accepted" or "dismissed".
     */
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed',
        platform: string
    }>;

    /**
     * Allows a developer to show the install prompt at a time of their own choosing.
     * This method returns a Promise.
     */
    prompt(): Promise<{
        outcome: 'accepted' | 'dismissed'
        platform: string
    }>;
}

// If we aren't a service worker then re-register as a service worker
if (!(typeof WorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope)) {
    if ("serviceWorker" in navigator) {
        window.addEventListener('load', () => {
            console.log("[PWA] Registering Service Worker...");
            navigator.serviceWorker.register(import.meta.url, { type: "module" })
            .catch(err => console.error("[PWA] Registration failed:", err));
        });
    } else {
        console.warn("[PWA] Browser does not support service workers.");
    }
} else {
    try {
        const precacheResources = async (event: ExtendableEvent) => {
            const cache = await caches.open(CACHE_NAME);
            for (const resource of INCLUDE_CACHE_LOCAL_URLS) {
                const url = new URL(resource, import.meta.url);
                const request = new Request(url.href, { cache: "reload" });
                try {
                    const response = await fetch(request);
                    await cache.put(request, response);
                } catch (err) {
                    // Ignore errors for now.
                }
            }
        };

        const deleteOldCaches = async (event: ExtendableEvent) => {
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
                if (cacheName !== CACHE_NAME) {
                    console.log(`[PWA] Deleting old cache: ${cacheName}`);
                    await caches.delete(cacheName);
                }
            }
        };

        // https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation
        const putInCache = async (request: Request, response: Response) => {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response);
        };

        const shouldCache = (request: Request): boolean => {
            for (const matcher of EXCLUDE_CACHE_LIVE_MATCHERS)
                if (matcher.test(request.url))
                    return false;

            for (const exclude of EXCLUDE_CACHE_LOCAL_URLS)
                if (new URL(exclude, import.meta.url).href == request.url)
                    return false;

            for (const matcher of INCLUDE_CACHE_LIVE_MATCHERS)
                if (matcher.test(request.url))
                    return true;

            for (const preCacheResource of INCLUDE_CACHE_LOCAL_URLS)
                if (new URL(preCacheResource, import.meta.url).href == request.url)
                    return true;

            return false;
        };

        const networkFirst = async (request: Request, fallbackUrl: string) => {
            // Try to get the resource from the network.
            try {
                const responseFromNetwork = await fetch(request);

                /* If the network request succeeded:
                 * - return the original to the app
                 * - check if we should cache it then:
                 *   - clone the response, put one copy in the cache, for the next time
                 * Cloning is needed because a response can only be consumed once.
                 */
                if (shouldCache(request))
                    putInCache(request, responseFromNetwork.clone());

                return responseFromNetwork;
            } catch (error) {
                // If the network request failed, try to get the resource from the cache.
                const responseFromCache = await caches.match(request);
                if (responseFromCache)
                    return responseFromCache;
            }

            // If both the network request and the cache lookup failed, get the fallback response from the network.
            try {
                const fallbackResponse = await fetch(fallbackUrl);
                putInCache(request, fallbackResponse.clone());
                return fallbackResponse;
            } catch (error) {
                // Attempt to get the fallback response from the cache.
                const fallbackResponseFromCache = await caches.match(fallbackUrl);
                if (fallbackResponseFromCache)
                    return fallbackResponseFromCache;

                // When even the fallback response is not available,
                return new Response("Network error", {
                    status: 408,
                    headers: { "Content-Type": "text/plain" },
                });
            }
        };

        self.addEventListener("install", (e) => {
            const event = e as ExtendableEvent;
            event.waitUntil(precacheResources(event));
        });

        self.addEventListener("activate", (e) => {
            const event = e as ExtendableEvent;
            event.waitUntil(deleteOldCaches(event));
        });

        self.addEventListener("fetch", (e) => {
            const event = e as FetchEvent;
            event.respondWith(
                networkFirst(
                    event.request,
                    "./offline.html",
                ),
            );
        });

        console.log("[PWA] Initialized.");
    } catch (err) {
        console.error("[PWA] Failed to initialize:", err);
    }
}
