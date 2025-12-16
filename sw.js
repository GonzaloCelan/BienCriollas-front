/* sw.js — Bien Criollas (cache front, pero JS/CSS siempre nuevos si hay red) */
const CACHE_NAME = "biencriollas-front-v3"; // (cambialo SOLO esta vez para limpiar lo viejo)

const FRONT_ASSETS = [
  "/",
  "/index.html",
  "/login.html",
  "/manifest.json",
  "/logoBienCriollas.png",

  "/css/style.css",

  "/components/sidebar.js",
  "/components/toast.js",
  "/components/ui.js",

  "/pages/caja.js",
  "/pages/estadistica.js",
  "/pages/horarios.js",
  "/pages/login.js",
  "/pages/obtenerPedidos.js",
  "/pages/pedido-init.js",
  "/pages/pedidos.js",
  "/pages/resumenHistorico.js",
  "/pages/stock.js",

  "/variedades/atun.png",
  "/variedades/bondiola.png",
  "/variedades/campo.png",
  "/variedades/caprese.png",
  "/variedades/carne.png",
  "/variedades/choclo.png",
  "/variedades/fugazza.png",
  "/variedades/jamon.png",
  "/variedades/pollo.png",
  "/variedades/queso-azul.png",
  "/variedades/vacio.png",
  "/variedades/verdura.png",

  "/icons/icon-192.png",
  "/icons/icon-512.png",
];


// ✅ Instalación: precache del front (robusto, no rompe si algo falla)
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    await Promise.all(
      FRONT_ASSETS.map(async (path) => {
        try {
          const req = new Request(path, { cache: "reload" });
          const res = await fetch(req);
          if (res && res.ok) {
            await cache.put(req, res.clone());
          } else {
            console.warn("[SW] No cacheado:", path, res?.status);
          }
        } catch (err) {
          console.warn("[SW] Error cacheando:", path);
        }
      })
    );
  })());

  self.skipWaiting();
});


// ✅ Activación: limpiar versiones viejas
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

// ✅ Fetch
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Solo mismo origen
  if (url.origin !== location.origin) return;

  // ❌ NO cachear API
  if (url.pathname.startsWith("/api")) return;

  // ✅ Navegación (HTML): network-first con fallback a cache
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(url.pathname === "/login.html" ? "/login.html" : "/index.html")
      )
    );
    return;
  }

  // ✅ JS/CSS: NETWORK-FIRST (esto arregla tu “se pega el JS viejo”)
  if (url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) await cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await cache.match(req);
        return cached || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // ✅ Imágenes / iconos / resto: cache-first
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;

    const res = await fetch(req);
    if (res && res.ok) await cache.put(req, res.clone());
    return res;
  })());
});
