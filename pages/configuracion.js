const API_BASE = "http://localhost:8080";

let _inited = false;
let _data = [];

// ✅ Cambios de COSTO (se guardan con botón)
let _dirtyCosto = new Map(); // id_variedad -> string del input

// ===============================
// 💾 Cache local (para que NO desaparezcan inactivas si tu GET devuelve solo activas)
// ===============================
const CFG_CACHE_KEY = "cfg_variedades_cache_v1";

function loadCache() {
  try {
    const raw = localStorage.getItem(CFG_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCache(list) {
  try {
    localStorage.setItem(CFG_CACHE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function sortByNombre(list) {
  list.sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es"));
  return list;
}

// merge: si el GET devuelve solo activas, mantenemos las otras del cache como inactivas
function mergeFromCacheWhenOnlyActives(fetchedActives) {
  const cache = loadCache();
  const map = new Map();

  // 1) cargamos cache
  for (const c of cache) {
    if (!c || c.id_variedad == null) continue;
    map.set(String(c.id_variedad), { ...c });
  }

  // 2) upsert lo que vino del server como ACTIVO
  for (const f of fetchedActives) {
    const k = String(f.id_variedad);
    const prev = map.get(k) || {};
    map.set(k, {
      ...prev,
      ...f,
      activo: true,
    });
  }

  const out = Array.from(map.values());

  // 3) si algo está en cache pero no vino como activo, lo dejamos como inactivo
  const fetchedIds = new Set(fetchedActives.map((v) => String(v.id_variedad)));
  for (const item of out) {
    if (!fetchedIds.has(String(item.id_variedad))) item.activo = false;
  }

  sortByNombre(out);
  saveCache(out);
  return out;
}

// ===============================
// 💅 CSS premium + animaciones (inyectado 1 vez)
// ===============================
function ensureCfgPremiumStyles() {
  if (document.getElementById("cfg-premium-styles")) return;

  const css = document.createElement("style");
  css.id = "cfg-premium-styles";
  css.textContent = `
    @keyframes cfgPop {
      from { transform: translateY(6px) scale(.985); opacity: 0; }
      to   { transform: translateY(0) scale(1); opacity: 1; }
    }
    .cfg-card { animation: cfgPop .18s ease-out both; }
    .cfg-saving { opacity: .75; pointer-events: none; }
  `;
  document.head.appendChild(css);
}

// ===============================
// 🧼 Escape HTML (evita inyectar HTML desde nombre)
// ===============================
function escHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ===============================
// 💰 Format
// ===============================
function fmtMoneyAR(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ===============================
// ✅ Badge cambios (solo por costos ahora)
// ===============================
function showCambiosBadge() {
  const badge = document.getElementById("cfgBadgeCambios");
  if (!badge) return;
  badge.classList.toggle("hidden", _dirtyCosto.size === 0);
}

// ===============================
// ✅ Toast simple
// ===============================
function cfgToast(msg, type = "ok") {
  let wrap = document.getElementById("cfg-toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "cfg-toast-wrap";
    wrap.className = "fixed bottom-5 right-5 z-[99999] flex flex-col gap-2";
    document.body.appendChild(wrap);
  }

  const el = document.createElement("div");
  el.className =
    "min-w-[240px] max-w-[360px] rounded-2xl border bg-white shadow-lg px-4 py-3 " +
    "flex items-start gap-3 translate-y-2 opacity-0 transition-all duration-200";
  el.style.borderColor = type === "ok" ? "rgba(16,185,129,.28)" : "rgba(239,68,68,.35)";

  el.innerHTML = `
    <div class="mt-0.5 h-2.5 w-2.5 rounded-full ${type === "ok" ? "bg-emerald-600" : "bg-rose-600"}"></div>
    <div class="flex-1">
      <div class="text-sm font-extrabold text-slate-900">${type === "ok" ? "Listo" : "Error"}</div>
      <div class="text-[12px] text-slate-600">${escHtml(msg)}</div>
    </div>
    <button class="text-slate-400 hover:text-slate-700 font-extrabold leading-none">✕</button>
  `;

  el.querySelector("button").onclick = () => {
    el.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => el.remove(), 180);
  };

  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.remove("opacity-0", "translate-y-2"));

  setTimeout(() => {
    if (!el.isConnected) return;
    el.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => el.remove(), 180);
  }, 2200);
}

// ===============================
// 🌐 API (robusto: intenta traer todas; si no, cae a activos)
// ===============================
async function getVariedades() {
  const tries = [
    `${API_BASE}/api/variedad/obtener`,
    `${API_BASE}/api/variedad/obtener-todas`,
    `${API_BASE}/api/variedad/listar`,
    `${API_BASE}/api/variedad/obtener-activos`,
  ];

  let lastErr = null;
  for (const url of tries) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (!r.ok) {
        lastErr = new Error(`GET ${url} HTTP ${r.status}`);
        continue;
      }
      const data = await r.json();
      if (!Array.isArray(data)) {
        lastErr = new Error(`GET ${url} no devolvió array`);
        continue;
      }
      const onlyActives = String(url).includes("obtener-activos");
      return { data, url, onlyActives };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("No se pudo obtener variedades");
}

// ✅ TU ENDPOINT REAL: PUT /api/variedad/{idVariedad}/activo/{activo}
async function putActivo(idVariedad, activo) {
  const url = `${API_BASE}/api/variedad/${encodeURIComponent(idVariedad)}/activo/${encodeURIComponent(
    String(!!activo)
  )}`;

  const r = await fetch(url, { method: "PUT" });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    console.error("Respuesta error (activo):", txt);
    throw new Error("PUT activo HTTP " + r.status);
  }
}

// ✅ POST /api/variedad/agregar  (nombre + precioCosto)
async function postAgregarVariedad(nombre, costo) {
  const r = await fetch(`${API_BASE}/api/variedad/agregar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      nombre: String(nombre).trim(),
      precio_unitario: Number(costo) // ✅ clave exacta del DTO
    }),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    console.error("Respuesta error (agregar):", txt);
    throw new Error("POST agregar HTTP " + r.status);
  }

  return r.json().catch(() => null);
}

// ===============================
// 🔢 Parse precio robusto (500 / 500.50 / 1.200,50)
// ===============================
function parsePrecio(str) {
  const s = String(str ?? "").trim();
  if (!s) return null;

  let clean = s.replace(/\s/g, "").replace(/\$/g, "");
  if (clean.includes(",") && clean.includes(".")) clean = clean.replace(/\./g, "").replace(",", ".");
  else clean = clean.replace(",", ".");

  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

// ===============================
// 🧩 Normalizar variedad (server/response)
// ===============================
function normalizeVariedad(v, { onlyActives = false } = {}) {
  const id = v?.id_variedad ?? v?.idVariedad ?? v?.id;
  const nombre = v?.nombre ?? v?.nombreVariedad ?? v?.variedad ?? "";
  const precioUnit = v?.precio_unitario ?? v?.precioUnitario ?? v?.precio ?? 0;

  const activoRaw = v?.activo ?? v?.habilitado ?? v?.isActivo ?? v?.activa ?? v?.enabled;
  const activo = onlyActives ? true : (activoRaw === undefined ? true : !!activoRaw);

  const precioCosto = v?.precio_costo ?? v?.precioCosto ?? v?.costo ?? v?.costo_unitario;

  return {
    id_variedad: id,
    nombre,
    precio_unitario: precioUnit,
    activo,
    precio_costo: precioCosto,
  };
}

function upsertLocalVariedad(item) {
  if (!item || item.id_variedad == null) return false;

  const id = Number(item.id_variedad);
  const idx = _data.findIndex((x) => Number(x.id_variedad) === id);

  if (idx >= 0) _data[idx] = { ..._data[idx], ...item };
  else _data.push(item);

  sortByNombre(_data);
  saveCache(_data);
  return true;
}

// ===============================
// 🧱 Render CARDS (6 por fila + premium + SIN puntitos)
// contenedor: cfgCardsVariedades
// ===============================
function renderCardsVariedades() {
  ensureCfgPremiumStyles();

  const wrap = document.getElementById("cfgCardsVariedades");
  if (!wrap) return;

  wrap.className = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2";

  const q = String(document.getElementById("cfgBuscarVariedad")?.value ?? "")
    .trim()
    .toLowerCase();

  const list = !q ? _data : _data.filter((v) => String(v.nombre ?? "").toLowerCase().includes(q));

  const contador = document.getElementById("cfgContadorVariedades");
  if (contador) contador.textContent = `${list.length} variedades`;

  if (!list.length) {
    wrap.innerHTML = `
      <div class="rounded-2xl border border-slate-200 bg-white p-3 text-[12px] text-slate-500">
        No hay resultados.
      </div>
    `;
    return;
  }

  wrap.innerHTML = list
    .map((v, idx) => {
      const id = v.id_variedad;
      const idStr = String(id);
      const nombre = escHtml(v.nombre ?? "");
      const activo = v.activo !== undefined && v.activo !== null ? !!v.activo : true;

      const costoBase = v.precio_costo ?? v.precioCosto ?? v.costo ?? v.costo_unitario ?? "";
      const costoVal = _dirtyCosto.has(idStr) ? _dirtyCosto.get(idStr) : (costoBase ?? "");
      const costoEdited = _dirtyCosto.has(idStr);

      const delay = Math.min(idx, 18) * 8;

      return `
        <div class="cfg-card relative group rounded-2xl border border-slate-200
                    ${activo ? "bg-white/90" : "bg-white/70 opacity-95"}
                    backdrop-blur p-2.5
                    shadow-[0_1px_0_rgba(15,23,42,.04)] hover:shadow-lg
                    hover:-translate-y-0.5 active:translate-y-0
                    transition-all duration-200"
             style="animation-delay:${delay}ms"
             data-id="${id}">

          <div class="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200
                      bg-gradient-to-br from-emerald-50/70 via-white/0 to-white/0"></div>

          <div class="pointer-events-none absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl
                      ${activo ? "bg-gradient-to-b from-emerald-400/70 to-emerald-500/50" : "bg-slate-200"}"></div>

          <div class="relative flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="text-[11px] font-extrabold text-slate-900 truncate leading-tight">${nombre}</div>

              <div class="mt-1 flex items-center gap-1.5">
                <span class="cfgChipEstado text-[9px] font-extrabold px-2 py-0.5 rounded-full border
                             ${activo ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-slate-100 text-slate-600 border-slate-200"}">
                  ${activo ? "ACTIVA" : "INACTIVA"}
                </span>

                ${costoEdited
                  ? `<span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border
                             bg-amber-50 text-amber-800 border-amber-200">!</span>`
                  : ``}
              </div>
            </div>

            <!-- Toggle premium (verde ON) + auto-save -->
            <label class="relative inline-flex items-center cursor-pointer select-none">
              <input type="checkbox" class="sr-only peer cfgToggleActivo" ${activo ? "checked" : ""} />
              <span class="w-10 h-5 rounded-full bg-slate-200
                           peer-checked:bg-gradient-to-r peer-checked:from-emerald-500 peer-checked:to-emerald-400
                           shadow-inner
                           peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-200
                           peer-checked:shadow-[0_0_0_4px_rgba(16,185,129,.14)]
                           transition-all duration-200"></span>

              <span class="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow
                           ring-1 ring-slate-100
                           peer-checked:translate-x-5
                           transition-transform duration-200"></span>
            </label>
          </div>

          <div class="relative mt-2">
            <span class="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-extrabold">$</span>
            <input
              class="cfgInpCosto w-full rounded-xl border
                     ${costoEdited ? "border-amber-200 bg-amber-50/40" : "border-slate-200 bg-slate-50"}
                     pl-5 pr-2 py-1.5 text-[11px] font-extrabold text-slate-900
                     placeholder:text-slate-400
                     focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-200
                     transition"
              type="number" step="0.01" min="0"
              placeholder="Costo…"
              value="${String(costoVal ?? "")}"
              ${activo ? "" : "disabled"}
            />
          </div>
        </div>
      `;
    })
    .join("");

  // Delegación: input costo
  wrap.oninput = (e) => {
    const inp = e.target.closest(".cfgInpCosto");
    if (!inp) return;

    const card = inp.closest("[data-id]");
    if (!card) return;

    const id = String(card.dataset.id);
    _dirtyCosto.set(id, inp.value);
    showCambiosBadge();
  };

  // Delegación: toggle (AUTO-SAVE) + cache
  wrap.onchange = async (e) => {
    const chk = e.target.closest(".cfgToggleActivo");
    if (!chk) return;

    const card = chk.closest("[data-id]");
    if (!card) return;

    const id = Number(card.dataset.id);
    const nuevo = !!chk.checked;

    const inpCosto = card.querySelector(".cfgInpCosto");
    const chip = card.querySelector(".cfgChipEstado");

    card.classList.add("cfg-saving");
    chk.disabled = true;

    try {
      await putActivo(id, nuevo);

      const it = _data.find((x) => Number(x.id_variedad) === Number(id));
      if (it) it.activo = nuevo;

      saveCache(_data);

      if (chip) {
        chip.textContent = nuevo ? "ACTIVA" : "INACTIVA";
        chip.className =
          "cfgChipEstado text-[9px] font-extrabold px-2 py-0.5 rounded-full border " +
          (nuevo
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-slate-100 text-slate-600 border-slate-200");
      }
      if (inpCosto) inpCosto.disabled = !nuevo;

      renderTablaPrecios();
      cfgToast(nuevo ? "Variedad activada ✅" : "Variedad desactivada ✅", "ok");
    } catch (err) {
      console.error(err);

      chk.checked = !nuevo;
      if (chip) {
        chip.textContent = !nuevo ? "ACTIVA" : "INACTIVA";
        chip.className =
          "cfgChipEstado text-[9px] font-extrabold px-2 py-0.5 rounded-full border " +
          (!nuevo
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-slate-100 text-slate-600 border-slate-200");
      }
      if (inpCosto) inpCosto.disabled = nuevo;
      cfgToast("No se pudo actualizar el estado. Revisá backend recall.", "err");
    } finally {
      chk.disabled = false;
      card.classList.remove("cfg-saving");
    }
  };
}

// ===============================
// 🧾 Render TABLA (abajo) - con columna Estado
// tbody: cfgTablaPrecios
// ===============================
function renderTablaPrecios() {
  const tbody = document.getElementById("cfgTablaPrecios");
  if (!tbody) return;

  // Usa tu cfgAccentById si existe; si no, cae a un fallback
  const pickAccent = (key) => {
    try {
      if (typeof cfgAccentById === "function") return cfgAccentById(key);
    } catch (_) {}

    const accents = [
      { hover: "hover:bg-rose-50/70", dot: "bg-rose-500" },
      { hover: "hover:bg-red-50/60", dot: "bg-red-500" },
      { hover: "hover:bg-orange-50/60", dot: "bg-orange-500" },
      { hover: "hover:bg-amber-50/60", dot: "bg-amber-500" },
      { hover: "hover:bg-fuchsia-50/60", dot: "bg-fuchsia-500" },
    ];

    const n = Number(key);
    const idx = Number.isFinite(n) ? Math.abs(n) % accents.length : 0;
    return accents[idx];
  };

  tbody.innerHTML = _data
    .map((v, i) => {
      const nombre = escHtml(v.nombre ?? "");
      const activo = v.activo !== undefined && v.activo !== null ? !!v.activo : true;

      const key = v.id_variedad ?? v.id ?? i;
      const acc = pickAccent(key);

      const rowHover = activo ? acc.hover : "hover:bg-red-50/50";
      const rowTone = activo ? "" : "opacity-80";
      const dot = activo ? acc.dot : "bg-red-500";

      return `
        <tr class="group ${rowTone} ${rowHover}
                   transition-colors duration-200
                   border-b border-slate-100 last:border-b-0">

          <!-- Nombre -->
          <td class="px-5 py-2">
            <div class="flex items-center gap-3 min-w-0">
              <span class="h-2.5 w-2.5 rounded-full ${dot}
                           shadow-sm ring-2 ring-white
                           transition-transform duration-200
                           group-hover:scale-110"></span>

              <div class="min-w-0">
                <div class="font-extrabold text-slate-900 text-[13px] leading-5 truncate
                            transition-transform duration-200
                            group-hover:translate-x-[1px]">
                  ${nombre}
                </div>
              </div>
            </div>
          </td>

          <!-- Precio (negro, tabular) -->
          <td class="px-5 py-2 text-right">
            <div class="inline-flex items-baseline gap-1 tabular-nums">
              <span class="text-[11px] font-bold text-slate-400">$</span>
              <span class="text-[13px] font-extrabold text-slate-900
                           transition-colors duration-200
                           group-hover:text-slate-950">
                ${fmtMoneyAR(v.precio_unitario || 0)}
              </span>
            </div>
          </td>

          <!-- Badge estado -->
          <td class="px-5 py-2 text-right">
            <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-1
                         text-[10px] font-extrabold tracking-wide
                         ring-1 ring-inset
                         shadow-sm transition-all duration-200
                         group-hover:shadow-md
                         ${activo
                           ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                           : "bg-red-50 text-red-800 ring-red-200"}">
              <span class="h-1.5 w-1.5 rounded-full ${activo ? "bg-emerald-500" : "bg-red-500"}"></span>
              ${activo ? "ACTIVA" : "INACTIVA"}
            </span>
          </td>
        </tr>
      `;
    })
    .join("");
}


// ===============================
// 🔄 Cargar + render (con fix de “no desaparece”)
// ===============================
async function cargarYRender() {
  ensureCfgPremiumStyles();

  const cards = document.getElementById("cfgCardsVariedades");
  const tabla = document.getElementById("cfgTablaPrecios");

  if (cards) {
    cards.className = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2";
    cards.innerHTML = `
      <div class="rounded-2xl border border-slate-200 bg-white p-3 text-[12px] text-slate-500">
        Cargando…
      </div>
    `;
  }
  if (tabla) {
    tabla.innerHTML = `<tr><td colspan="3" class="px-5 py-6 text-[12px] text-slate-500">Cargando…</td></tr>`;
  }

  const { data, onlyActives } = await getVariedades();

  const normalized = data.map((v) => normalizeVariedad(v, { onlyActives }));

  if (onlyActives) _data = mergeFromCacheWhenOnlyActives(normalized);
  else {
    _data = sortByNombre(normalized);
    saveCache(_data);
  }

  renderCardsVariedades();
  renderTablaPrecios();
  showCambiosBadge();
}

// ===============================
// ➕ Agregar variedad (UI + pintado inmediato)
// ===============================
function initAgregarVariedadUI() {
  const inpNombre = document.getElementById("cfgNuevaVariedadNombre");
  const inpCosto = document.getElementById("cfgNuevaVariedadCosto");
  const btnAdd = document.getElementById("btnCfgAgregarVariedad");
  const hint = document.getElementById("cfgAddHint");

  if (!inpNombre || !inpCosto || !btnAdd) return;

  const setHint = (show, text = "Listo") => {
    if (!hint) return;
    hint.textContent = text;
    hint.classList.toggle("hidden", !show);
    if (show) setTimeout(() => hint.classList.add("hidden"), 1600);
  };

  const setLoading = (on) => {
    btnAdd.disabled = on;
    btnAdd.classList.toggle("opacity-80", on);
    btnAdd.textContent = on ? "Agregando…" : "➕ Agregar";
  };

  const run = async () => {
    const nombre = String(inpNombre.value ?? "").trim();
    const costoRaw = String(inpCosto.value ?? "").trim();

    if (!nombre) {
      cfgToast("Poné un nombre de variedad.", "err");
      inpNombre.focus();
      return;
    }

    const costo = parsePrecio(costoRaw);
    if (costo === null) {
      cfgToast("Costo inválido. Usá 500 o 500.00 (coma también vale).", "err");
      inpCosto.focus();
      return;
    }

    setLoading(true);

    try {
      const created = await postAgregarVariedad(nombre, costo);

      // limpio inputs ya
      inpNombre.value = "";
      inpCosto.value = "";
      setHint(true, "Agregada ✅");

      // si hay búsqueda, la limpio para que se vea seguro
      const buscador = document.getElementById("cfgBuscarVariedad");
      if (buscador) buscador.value = "";

      // ✅ Pintado inmediato: uso respuesta si trae id, si no fallback
      let okInsert = false;

      if (created) {
        const item = normalizeVariedad(
          {
            ...created,
            nombre: created?.nombre ?? nombre,
            precioCosto: created?.precioCosto ?? costo,
            precio_costo: created?.precio_costo ?? created?.precioCosto ?? costo,
            activo: created?.activo ?? true,
          },
          { onlyActives: false }
        );

        // si no vino el id, no puedo insertar bien
        if (item.id_variedad != null) {
          // costo base para que el input arranque con el valor
          item.precio_costo = item.precio_costo ?? costo;
          item.activo = item.activo ?? true;

          okInsert = upsertLocalVariedad(item);
        }
      }

      if (okInsert) {
        renderCardsVariedades();
        renderTablaPrecios();
        cfgToast("Variedad agregada ✅", "ok");

        // refresco suave (por si precio_unitario se calcula server-side)
        setTimeout(() => cargarYRender().catch(console.error), 250);
      } else {
        // fallback: recargo para traer el nuevo con id seguro
        await cargarYRender();
        cfgToast("Variedad agregada ✅", "ok");
      }
    } catch (e) {
      console.error(e);
      cfgToast("No se pudo agregar la variedad. Revisá backend.", "err");
    } finally {
      setLoading(false);
    }
  };

  btnAdd.onclick = () => run();

  inpNombre.addEventListener("keydown", (e) => {
    if (e.key === "Enter") run();
  });
  inpCosto.addEventListener("keydown", (e) => {
    if (e.key === "Enter") run();
  });
}

// ===============================
// 💾 Guardar COSTOS (PUT) + refresh
// DTO: { idVariedad, precioUnitario }
// ===============================
async function guardarCostos() {
  const payload = [];
  let invalido = false;

  for (const [id, val] of _dirtyCosto.entries()) {
    const raw = String(val ?? "").trim();
    if (raw === "") continue;

    const num = parsePrecio(raw);
    if (num === null) {
      invalido = true;
      continue;
    }
    payload.push({ idVariedad: Number(id), precioUnitario: num });
  }

  if (invalido) {
    cfgToast("Hay costos inválidos. Usá 500 o 500.00 (coma también vale).", "err");
    return;
  }

  if (payload.length === 0) {
    cfgToast("No hay costos cargados para guardar.", "err");
    return;
  }

  const r = await fetch(`${API_BASE}/api/variedad/precio-costo`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    console.error("Respuesta error (precio-costo):", txt);
    throw new Error("PUT precio-costo HTTP " + r.status);
  }

  _dirtyCosto.clear();
  await cargarYRender();
  cfgToast("Costos actualizados. Precios recargados ✅", "ok");
}

// ===============================
// 🔁 Recargar (descarta cambios de costos)
// ===============================
async function recargarConfiguracion() {
  _dirtyCosto.clear();
  showCambiosBadge();
  await cargarYRender();
  cfgToast("Recargado ✅", "ok");
}

// ===============================
// 🚀 Init (llamada desde sidebar)
// ===============================
export function initSeccionConfiguracion() {
  if (!_inited) {
    ensureCfgPremiumStyles();

    const btnR = document.getElementById("btnCfgRecargar");
    const btnG = document.getElementById("btnCfgGuardar");
    const buscador = document.getElementById("cfgBuscarVariedad");

    if (btnR) btnR.onclick = () => recargarConfiguracion().catch(console.error);

    if (btnG)
      btnG.onclick = () =>
        guardarCostos().catch((e) => {
          console.error(e);
          cfgToast("No se pudo guardar costos. Revisá consola/servidor.", "err");
        });

    if (buscador) buscador.addEventListener("input", () => renderCardsVariedades());

    // ✅ Agregar variedad
    initAgregarVariedadUI();

    _inited = true;
  }

  cargarYRender().catch((e) => {
    console.error(e);
    cfgToast("Error al cargar variedades.", "err");
  });
}
