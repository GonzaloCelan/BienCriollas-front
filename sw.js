/* sw.js — Bien Criollas (cache SOLO front) */
const CACHE_NAME = "biencriollas-front-v2"; // subí el número cuando actualices el front

const FRONT_ASSETS = [
  // HTML / manifest / branding
  "/",
  "/index.html",
  "/login.html",
  "/manifest.json",
  "/logoBienCriollas.png",

  // CSS (ajustá si tu archivo se llama distinto)
  "/css/style.css",

  // Components
  "/components/sidebar.js",
  "/components/toast.js",
  "/components/ui.js",

  // Pages
  "/pages/caja.js",
  "/pages/estadistica.js",
  "/pages/horarios.js",
  "/pages/login.js",
  "/pages/obtenerPedidos.js",
  "/pages/pedido-init.js",
  "/pages/pedidos.js",
  "/pages/resumenHistorico.js",
  "/pages/stock.js",

  // Imágenes de variedades
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

  // Iconos PWA (ajustá nombres si difieren)
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// ✅ Instalación: precache del front
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FRONT_ASSETS))
  );
  self.skipWaiting();
});

// ✅ Activación: limpiar versiones viejas
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// ✅ Fetch: no cachear API / cache-first para assets del front
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // ❌ NO cachear endpoints
  if (url.pathname.startsWith("/api")) return;

  // ✅ Navegación: si no hay red, devolvemos index/login desde cache
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(url.pathname === "/login.html" ? "/login.html" : "/index.html")
      )
    );
    return;
  }

  // ✅ Archivos estáticos: cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((res) => {
        if (url.origin === location.origin && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
