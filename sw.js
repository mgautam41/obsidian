const CACHE_NAME = "obsidian-vault-v1";

// Static assets to pre-cache (Vite will hash these; use a broad pattern instead)
const STATIC_EXTENSIONS = [
    ".html",
    ".js",
    ".css",
    ".woff2",
    ".woff",
    ".svg",
    ".ico",
    ".png",
    ".webp",
];

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Pre-cache the app shell
            return cache.addAll(["/obsidian/", "/obsidian/index.html"]).catch(() => {
                // Ignore pre-cache errors on first install
            });
        })
    );
});

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests and cross-origin API calls
    if (request.method !== "GET") return;
    if (url.origin !== self.location.origin) return;

    // Cache-first for static assets (JS/CSS/fonts/images)
    const ext = url.pathname.split(".").pop();
    if (STATIC_EXTENSIONS.some((e) => url.pathname.endsWith(e))) {
        event.respondWith(
            caches.match(request).then(
                (cached) =>
                    cached ||
                    fetch(request).then((res) => {
                        if (res && res.status === 200) {
                            const clone = res.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                        }
                        return res;
                    })
            )
        );
        return;
    }

    // Network-first for navigation requests (HTML)
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then((res) => {
                    if (res && res.status === 200) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return res;
                })
                .catch(() => caches.match("/obsidian/index.html"))
        );
        return;
    }
});
