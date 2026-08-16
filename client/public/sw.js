const CACHE = "debaterush-core-v1";
const CORE = ["/", "/manifest.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put("/", copy)); return response; }).catch(() => caches.match("/")));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => { if (response.ok && new URL(request.url).origin === self.location.origin) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); } return response; })));
});

self.addEventListener("message", event => {
  if (event.data?.type !== "CACHE_ASSETS" || !Array.isArray(event.data.assets)) return;
  const assets = event.data.assets.filter(url => typeof url === "string" && new URL(url).origin === self.location.origin);
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(assets.map(url => cache.add(url).catch(() => undefined)))));
});
