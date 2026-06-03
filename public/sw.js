const CACHE = "bitcine-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Network-first for HTML pages (they change every deploy)
  if (request.mode === "navigate" || (request.method === "GET" && url.pathname.endsWith("/"))) {
    e.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for everything else (versioned chunks, images, fonts)
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
