const CACHE = "ticha-v1";
const OFFLINE_PAGE = "/offline.html";

// ── Install: pre-cache the offline fallback page ──────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.add(OFFLINE_PAGE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove stale caches ────────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: caching strategies per request type ───────────────────────────
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Only handle same-origin GET requests
  if (req.method !== "GET" || url.origin !== location.origin) return;

  // Never intercept Supabase auth or Gemini API calls
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Next.js static chunks — always safe to cache indefinitely (content-hashed filenames)
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) => hit || fetch(req).then((res) => {
          caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
      )
    );
    return;
  }

  // Static assets (images, fonts, manifest) — cache-first
  if (/\.(png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|json)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) => hit || fetch(req).then((res) => {
          caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
      )
    );
    return;
  }

  // Page navigation — network-first, fall back to cache, then offline page
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match(OFFLINE_PAGE))
        )
    );
  }
});
