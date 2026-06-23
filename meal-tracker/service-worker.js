const CACHE_VERSION = "eatlog-landing-v3";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/app",
  "/app.html",
  "/app-preview.html",
  "/manifest.json",
  "/service-worker.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-180.png",
  "/icons/icon-167.png",
  "/icons/icon-152.png",
  "/icons/icon-120.png",
  "/icons/favicon-32.png"
];

const NETWORK_FIRST_PATHS = new Set([
  "/",
  "/index.html",
  "/app",
  "/app.html",
  "/app-preview.html",
  "/manifest.json"
]);

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          return key === CACHE_VERSION ? null : caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(function (networkResponse) {
        const responseCopy = networkResponse.clone();
        caches.open(CACHE_VERSION).then(function (cache) {
          cache.put(request, responseCopy);
        });
        return networkResponse;
      }).catch(function () {
        return caches.match(request).then(function (cachedResponse) {
          return cachedResponse || caches.match("/index.html");
        });
      })
    );
    return;
  }

  if (NETWORK_FIRST_PATHS.has(url.pathname)) {
    event.respondWith(
      fetch(request).then(function (networkResponse) {
        const responseCopy = networkResponse.clone();
        caches.open(CACHE_VERSION).then(function (cache) {
          cache.put(request, responseCopy);
        });
        return networkResponse;
      }).catch(function () {
        return caches.match(request);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then(function (networkResponse) {
        const responseCopy = networkResponse.clone();
        caches.open(CACHE_VERSION).then(function (cache) {
          cache.put(request, responseCopy);
        });
        return networkResponse;
      });
    })
  );
});
