/* =================================================================
   Shinobi Life Simulator — service worker
   Cache-first precache so the installed PWA launches fullscreen and
   plays fully offline. Bump CACHE to invalidate old assets on deploy.
   ================================================================= */
const CACHE = "shinobi-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./assets.js",
  "./data.js",
  "./pixelsprite.js",
  "./sprite.js",
  "./core.js",
  "./systems.js",
  "./world.js",
  "./minigames.js",
  "./audio.js",
  "./fx.js",
  "./layers.js",
  "./animation.js",
  "./ui.js",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  // Core art only — other stages/scenes/audio are cached on first use by the
  // runtime fetch handler, so startup stays light on mobile.
  "./assets/characters/genin/base.png",
  "./assets/backgrounds/overlook.webp",
  "./assets/backgrounds/overlook-mid.webp",
  "./assets/backgrounds/overlook-near.webp",
  "./assets/data/anchors.json",
  "./assets/data/characters.json"
];

// Precache core assets on install.
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Drop stale caches on activate.
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for same-origin GETs; fall back to network and cache the result.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html")); // offline navigation fallback
    })
  );
});
