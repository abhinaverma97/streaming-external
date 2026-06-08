const CACHE = "spicy-v3";
const OLD_CACHES = ["spicy-v1", "spicy-v2"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    Promise.all([
      clients.claim(),
      ...OLD_CACHES.map(name => caches.delete(name))
    ])
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;

  // Only cache GET requests (POST, PUT, DELETE pass through unhandled)
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Network-first for navigations (HTML pages change every deploy)
  if (request.mode === "navigate" || request.destination === "document") {
    e.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Never cache API responses (auth state, user data)
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(fetch(request));
    return;
  }

  // Cache-first for assets (versioned chunks, images, fonts)
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((res) => {
          cache.put(request, res.clone());
          return res;
        });
        return cached || fetchPromise;
      })
    )
  );
});
