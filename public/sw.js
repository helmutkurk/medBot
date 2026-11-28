/* Codex, 2026-11-28. Only the offline shell and explicitly allowed static assets are cached. */
const CACHE = "medbot-shell-v1";
const SHELL = ["/offline.html", "/manifest.webmanifest", "/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable.png", "/icons/apple-touch-icon.png"];
const MAX_ASSETS = 80;

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("medbot-shell-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

function staticAsset(request, url) {
  if (url.search || request.headers.has("range") || request.destination === "audio" || request.destination === "video") return false;
  if (SHELL.includes(url.pathname)) return true;
  return url.pathname.startsWith("/_next/static/") && /\.(?:js|css|woff2?|png|svg|jpe?g|webp|avif|ico)$/.test(url.pathname);
}

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname === "/api" || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    // No patient, report, usage, or RSC page responses are persisted.
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then(cache => cache.match("/offline.html"))));
    return;
  }
  if (!staticAsset(request, url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    const type = response.headers.get("content-type") || "";
    if (response.ok && !response.redirected && !/^(?:audio|video)\//i.test(type) && !response.headers.get("cache-control")?.includes("no-store")) {
      try {
        await cache.put(request, response.clone());
        const keys = await cache.keys();
        const assets = keys.filter(key => !SHELL.includes(new URL(key.url).pathname));
        await Promise.all(assets.slice(0, Math.max(0, assets.length - MAX_ASSETS)).map(key => cache.delete(key)));
      } catch { /* Storage pressure must not break an otherwise successful asset request. */ }
    }
    return response;
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const client = windows.find(window => window.url.startsWith(self.location.origin + "/"));
    if (client) { await client.navigate("/learning"); await client.focus(); }
    else await self.clients.openWindow("/learning");
  })());
});
