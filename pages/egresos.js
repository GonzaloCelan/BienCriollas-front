/* pages/egresos.js — EGRESOS
   ✅ KPIs acumulado
   ✅ Actividad reciente (diario) — tabla 3 columnas (Hora / Detalle / Monto)
   ✅ Historial por categoría (paginado) — /api/egreso/tipo/{tipo}
   ✅ Modal registrar egreso — POST /api/egreso/registrar
*/
(() => {
  // ============================================================
  // 1) CONFIG / API HELPERS
  // ============================================================
  const API_BASE_URL =
    window.API_BASE_URL ||
    localStorage.getItem("API_BASE_URL") ||
    "http://localhost:8080";

  function getToken() {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("jwt") ||
      localStorage.getItem("access_token") ||
      ""
    );
  }

  async function apiGet(path) {
    const headers = { "Content-Type": "application/json" };
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;

    const res = await fetch(`${API_BASE_URL}${path}`, { headers });
    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${text}`);
    return text ? JSON.parse(text) : null;
  }

  async function apiPost(path, bodyObj) {
    const headers = { "Content-Type": "application/json" };
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;

    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyObj),
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${text}`);
    return text ? JSON.parse(text) : null;
  }

  // ============================================================
  // 2) HELPERS UI / FORMAT
  // ============================================================
  function moneyARS(n) {
    const v = Number(n ?? 0);
    return v.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
  }

  // Para mostrar "18/12/2025, 10:01" si lo necesitás
  function formatFechaHora(creadoEn) {
    const raw = creadoEn ? String(creadoEn) : "";
    const d = raw ? new Date(raw) : null;
    if (d && !isNaN(d.getTime())) {
      return d.toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return raw ? raw.replace("T", " ").slice(0, 16) : "-";
  }

  // Para el “diario” (Actividad reciente) nos sirve solo la fecha corta
  function formatSoloFecha(creadoEn) {
    const raw = creadoEn ? String(creadoEn) : "";
    const d = raw ? new Date(raw) : null;
    if (d && !isNaN(d.getTime())) {
      return d.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
    return raw ? raw.split("T")[0] : "-";
  }

  async function waitForId(id, tries = 60, delay = 120) {
    for (let i = 0; i < tries; i++) {
      const el = document.getElementById(id);
      if (el) return el;
      await new Promise((r) => setTimeout(r, delay));
    }
    return null;
  }

  // Badge por tipo (lo usamos en diario y en historial)
  function tipoBadge(tipoEgreso) {
    const t = String(tipoEgreso || "").toUpperCase();
    if (t === "PERSONAL")
      return { text: "Personal", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
    if (t === "PRODUCCION")
      return { text: "Producción", cls: "bg-orange-50 text-orange-700 ring-orange-200" };
    return { text: "Día a Día", cls: "bg-blue-50 text-blue-700 ring-blue-200" }; // OTROS
  }

  // ============================================================
  // 3) KPIs — /api/egreso/acumulado
  // ============================================================
  async function cargarKpisEgresosAcumulado() {
    const data = await apiGet("/api/egreso/acumulado");

    const elPersonal = document.getElementById("egreso-personal-total");
    const elProduccion = document.getElementById("egreso-produccion-total");
    const elDia = document.getElementById("egreso-dia-total");

    if (elPersonal) elPersonal.textContent = moneyARS(data?.totalPersonal);
    if (elProduccion) elProduccion.textContent = moneyARS(data?.totalProduccion);
    if (elDia) elDia.textContent = moneyARS(data?.totalOtros);
  }

  // ============================================================
// 4) ACTIVIDAD RECIENTE (DIARIO) — /api/egreso/diario
//    👉 Tabla 4 columnas: Hora | Tipo | Detalle | Monto
//    👉 tbody: #tabla-egresos-body
// ============================================================
function renderSkeletonDiario(tbody) {
  tbody.innerHTML = ""; // mata cualquier fila de ejemplo
  for (let i = 0; i < 4; i++) {
    const tr = document.createElement("tr");
    tr.className = "border-t";
    tr.innerHTML = `
      <!-- Hora -->
      <td class="px-5 py-2.5">
        <div class="flex items-center gap-2">
          <div class="h-6 w-6 rounded-lg bg-slate-200/70 animate-pulse"></div>
          <div>
            <div class="h-3.5 w-16 rounded bg-slate-200/70 animate-pulse"></div>
            <div class="mt-1 h-3 w-24 rounded bg-slate-200/60 animate-pulse"></div>
          </div>
        </div>
      </td>

      <!-- Tipo -->
      <td class="px-5 py-2.5">
        <div class="h-5 w-20 rounded-full bg-slate-200/70 animate-pulse"></div>
      </td>

      <!-- Detalle -->
      <td class="px-5 py-2.5">
        <div class="h-3.5 w-56 rounded bg-slate-200/70 animate-pulse"></div>
      </td>

      <!-- Monto -->
      <td class="px-5 py-2.5 text-right">
        <div class="h-3.5 w-20 ml-auto rounded bg-slate-200/70 animate-pulse"></div>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function renderEmptyDiario(tbody) {
  tbody.innerHTML = `
    <tr class="border-t">
      <td colspan="4" class="px-5 py-8 text-center">
        <div class="text-sm font-extrabold text-slate-800">Sin egresos hoy</div>
        <div class="mt-1 text-xs font-semibold text-slate-500">Cuando cargues uno, aparece acá automáticamente.</div>
      </td>
    </tr>
  `;
}

function renderErrorDiario(tbody, msg) {
  tbody.innerHTML = `
    <tr class="border-t">
      <td colspan="4" class="px-5 py-7 text-center">
        <div class="text-sm font-semibold text-red-600">No pude cargar los egresos de hoy</div>
        <div class="mt-1 text-[11px] font-semibold text-slate-500 break-words">${String(msg || "")}</div>
      </td>
    </tr>
  `;
}

function renderTablaDiaria(tbody, lista) {
  tbody.innerHTML = "";

  if (!Array.isArray(lista) || lista.length === 0) {
    renderEmptyDiario(tbody);
    return;
  }

  // Orden desc por creadoEn (más nuevo arriba)
  lista = [...lista].sort((a, b) => {
    const da = new Date(a.creadoEn || 0).getTime() || 0;
    const db = new Date(b.creadoEn || 0).getTime() || 0;
    return db - da;
  });

  for (const e of lista) {
    const badge = tipoBadge(e.tipoEgreso);
    const hora = (e.hora || "").slice(0, 5) || "--:--";

    const tr = document.createElement("tr");
    tr.className =
      "border-t transition-colors duration-150 hover:bg-slate-50/80 " +
      "odd:bg-white even:bg-slate-50/30";

    tr.innerHTML = `
      <!-- Hora -->
      <td class="px-5 py-2.5">
        <div class="flex items-center gap-2">
          <span class="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-white text-[10px]">⏱</span>
          <div class="leading-tight">
            <div class="text-[13px] font-extrabold text-slate-900">${hora}</div>
            <div class="text-[11px] font-semibold text-slate-500">${formatSoloFecha(e.creadoEn)}</div>
          </div>
        </div>
      </td>

      <!-- Tipo -->
      <td class="px-5 py-2.5">
        <span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold ring-1 ${badge.cls}">
          ${badge.text}
        </span>
      </td>

      <!-- Detalle -->
      <td class="px-5 py-2.5">
        <span class="text-[13px] font-semibold text-slate-800">${e.descripcion || "-"}</span>
      </td>

      <!-- Monto -->
      <td class="px-5 py-2.5 text-right">
        <div class="text-[13px] md:text-sm font-extrabold text-slate-900">${moneyARS(e.monto)}</div>
      </td>
    `;

    tbody.appendChild(tr);
  }
}

async function cargarTablaEgresosDiarios() {
  const sec = document.querySelector('[data-section="egreso"]');
  const tbody =
    (sec && sec.querySelector("#tabla-egresos-body")) ||
    document.getElementById("tabla-egresos-body") ||
    (await waitForId("tabla-egresos-body"));

  if (!tbody) return;

  if (tbody.dataset.loading === "1") return;
  tbody.dataset.loading = "1";

  renderSkeletonDiario(tbody);

  try {
    const data = await apiGet("/api/egreso/diario"); // devuelve ARRAY
    const lista = Array.isArray(data) ? data : (data?.content ?? []);
    renderTablaDiaria(tbody, lista);
  } catch (err) {
    renderErrorDiario(tbody, err?.message || err);
    console.error("Egresos diarios:", err);
  } finally {
    tbody.dataset.loading = "0";
  }
}


  function renderEmptyDiario(tbody) {
    tbody.innerHTML = `
      <tr class="border-t">
        <td colspan="3" class="px-5 py-10 text-center">
          <div class="text-base font-extrabold text-slate-800">Sin egresos hoy</div>
          <div class="mt-1 text-sm text-slate-500">Cuando cargues uno, aparece acá automáticamente.</div>
        </td>
      </tr>
    `;
  }

  function renderErrorDiario(tbody, msg) {
    tbody.innerHTML = `
      <tr class="border-t">
        <td colspan="3" class="px-5 py-8 text-center">
          <div class="text-sm font-semibold text-red-600">No pude cargar los egresos de hoy</div>
          <div class="mt-1 text-xs text-slate-500 break-words">${String(msg || "")}</div>
        </td>
      </tr>
    `;
  }

  function renderTablaDiaria(tbody, lista) {
    tbody.innerHTML = "";

    if (!Array.isArray(lista) || lista.length === 0) {
      renderEmptyDiario(tbody);
      return;
    }

    // Orden desc por creadoEn (más nuevo arriba)
    lista = [...lista].sort((a, b) => {
      const da = new Date(a.creadoEn || 0).getTime() || 0;
      const db = new Date(b.creadoEn || 0).getTime() || 0;
      return db - da;
    });

    for (const e of lista) {
      const badge = tipoBadge(e.tipoEgreso);
      const hora = (e.hora || "").slice(0, 5) || "--:--";

      const tr = document.createElement("tr");
     tr.className =
  "group relative overflow-hidden rounded-full " +
  "bg-white/80 backdrop-blur-xl ring-1 ring-slate-200/70 " +
  "shadow-[0_18px_55px_-35px_rgba(15,23,42,.55)] " +
  "transition-all duration-300 " +
  "hover:-translate-y-[2px] hover:shadow-[0_30px_80px_-45px_rgba(15,23,42,.70)] hover:ring-red-200/60 " +
  "animate-[floatIn_.40s_ease-out_both]";



      tr.innerHTML = `
  <!-- Hora -->
  <td class="px-5 py-2.5 w-[180px]">
    <div class="flex items-center gap-2">
      <span class="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-white text-[10px]">⏱</span>
      <div class="leading-tight">
        <div class="text-[13px] font-extrabold text-slate-900">${hora}</div>
        <div class="text-[11px] font-semibold text-slate-500">${formatSoloFecha(e.creadoEn)}</div>
      </div>
    </div>
  </td>

  <!-- Tipo -->
  <td class="px-5 py-2.5 w-[140px]">
    <span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold ring-1 ${badge.cls}">
      ${badge.text}
    </span>
  </td>

  <!-- Detalle -->
  <td class="px-5 py-2.5">
    <div class="max-w-[520px] truncate text-[13px] font-semibold text-slate-800" title="${(e.descripcion || "-").replaceAll('"','')}">
      ${e.descripcion || "-"}
    </div>
  </td>

  <!-- Monto -->
  <td class="px-5 py-2.5 text-right w-[180px]">
    <div class="text-[13px] md:text-sm font-extrabold text-slate-900 tabular-nums">
      ${moneyARS(e.monto)}
    </div>
  </td>
`;


      tbody.appendChild(tr);
    }
  }

  async function cargarTablaEgresosDiarios() {
    // Si en algún momento repetís IDs o renderizás por secciones, esto es más seguro:
    const sec = document.querySelector('[data-section="egreso"]');
    const tbody =
      (sec && sec.querySelector("#tabla-egresos-body")) ||
      document.getElementById("tabla-egresos-body") ||
      (await waitForId("tabla-egresos-body"));

    if (!tbody) return;

    if (tbody.dataset.loading === "1") return;
    tbody.dataset.loading = "1";

    renderSkeletonDiario(tbody);

    try {
      const data = await apiGet("/api/egreso/diario"); // devuelve ARRAY
      const lista = Array.isArray(data) ? data : (data?.content ?? []);
      renderTablaDiaria(tbody, lista);
    } catch (err) {
      renderErrorDiario(tbody, err?.message || err);
      console.error("Egresos diarios:", err);
    } finally {
      tbody.dataset.loading = "0";
    }
  }

  // ============================================================
  // 5) HISTORIAL POR CATEGORÍA (PAGINADO) — /api/egreso/tipo/{tipo}
  // ============================================================
  const egresosTipoState = { tipo: "PERSONAL", page: 0, size: 10 };

  function renderDots(totalPages, currentPage) {
    const dots = document.getElementById("egresos-tipo-dots");
    if (!dots) return;

    dots.innerHTML = "";
    const pages = Math.max(Number(totalPages || 1), 1);
    const current = Math.max(Number(currentPage || 0), 0);

    // Si hay muchas páginas, no llenamos de puntitos infinitos:
    // Mostramos hasta 10 alrededor (estilo “prolijo”).
    const maxDots = 10;
    let start = 0;
    let end = pages;

    if (pages > maxDots) {
      const half = Math.floor(maxDots / 2);
      start = Math.max(current - half, 0);
      end = Math.min(start + maxDots, pages);
      start = Math.max(end - maxDots, 0);
    }

    for (let i = start; i < end; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.title = `Ir a página ${i + 1}`;
      b.className =
        i === current
          ? "h-2.5 w-2.5 rounded-full bg-red-600 ring-4 ring-red-100 transition"
          : "h-2.5 w-2.5 rounded-full bg-slate-300 hover:bg-slate-400 transition";
      b.addEventListener("click", () => {
        if (egresosTipoState.page === i) return;
        egresosTipoState.page = i;
        cargarEgresosPorTipo();
      });
      dots.appendChild(b);
    }
  }

  function setPagerUI(page) {
    const info = document.getElementById("egresos-tipo-page-info");
    const total = document.getElementById("egresos-tipo-total");
    const prev = document.getElementById("egresos-tipo-prev");
    const next = document.getElementById("egresos-tipo-next");

    const number = page?.number ?? 0;
    const totalPages = page?.totalPages ?? 1;
    const totalElements = page?.totalElements ?? 0;

    if (info) info.textContent = `Página ${number + 1} / ${Math.max(totalPages, 1)}`;
    if (total) total.textContent = `${totalElements} resultados`;

    if (prev) prev.disabled = number <= 0;
    if (next) next.disabled = number >= totalPages - 1;

    // ✅ puntitos estilo pedidos
    renderDots(totalPages, number);
  }

  function renderTablaTipo(page) {
    const tbody = document.getElementById("tabla-egresos-tipo-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    const content = page?.content ?? [];
    if (!Array.isArray(content) || content.length === 0) {
      tbody.innerHTML = `
        <tr class="border-t">
          <td colspan="4" class="px-4 py-10 text-center">
            <div class="text-base font-extrabold text-slate-800">Sin resultados</div>
            <div class="mt-1 text-sm text-slate-500">No hay egresos para esta categoría.</div>
          </td>
        </tr>
      `;
      setPagerUI(page);
      return;
    }

    for (const e of content) {
      const badge = tipoBadge(e.tipoEgreso);

      const tr = document.createElement("tr");
      tr.className =
        "border-t transition-all duration-200 " +
        "hover:bg-red-50/40 hover:-translate-y-[1px] hover:shadow-sm " +
        "odd:bg-white even:bg-slate-50/30";

      tr.innerHTML = `
        <td class="px-4 py-3 text-slate-700 font-medium">${formatFechaHora(e.creadoEn)}</td>
        <td class="px-4 py-3">
          <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${badge.cls}">
            ${badge.text}
          </span>
        </td>
        <td class="px-4 py-3 text-slate-800">${e.descripcion || "-"}</td>
        <td class="px-4 py-3 text-right font-extrabold text-slate-900">${moneyARS(e.monto)}</td>
      `;
      tbody.appendChild(tr);
    }

    setPagerUI(page);
  }

  async function cargarEgresosPorTipo() {
    const tbody = document.getElementById("tabla-egresos-tipo-body");
    if (!tbody) return;

    // mini skeleton
    tbody.innerHTML = `
      <tr class="border-t">
        <td colspan="4" class="px-4 py-6">
          <div class="h-4 w-36 rounded bg-slate-200/70 animate-pulse"></div>
          <div class="mt-2 h-4 w-64 rounded bg-slate-200/50 animate-pulse"></div>
        </td>
      </tr>
    `;

    const { tipo, page, size } = egresosTipoState;
    const url = `/api/egreso/tipo/${encodeURIComponent(tipo)}?page=${page}&size=${size}&sort=creadoEn,desc`;

    try {
      const pageData = await apiGet(url);
      renderTablaTipo(pageData);
    } catch (err) {
      tbody.innerHTML = `
        <tr class="border-t">
          <td colspan="4" class="px-4 py-8 text-center">
            <div class="text-sm font-semibold text-red-600">No pude cargar el historial</div>
            <div class="mt-1 text-xs text-slate-500 break-words">${String(err?.message || err)}</div>
          </td>
        </tr>
      `;
      console.error("Egresos por tipo:", err);
    }
  }

  function bindEgresosPorTipoUI() {
    const sel = document.getElementById("filtro-egreso-tipo");
    const prev = document.getElementById("egresos-tipo-prev");
    const next = document.getElementById("egresos-tipo-next");

    if (sel && !sel.dataset.bound) {
      sel.dataset.bound = "1";
      egresosTipoState.tipo = sel.value || "PERSONAL";

      sel.addEventListener("change", () => {
        egresosTipoState.tipo = sel.value;
        egresosTipoState.page = 0;
        cargarEgresosPorTipo();
      });
    }

    if (prev && !prev.dataset.bound) {
      prev.dataset.bound = "1";
      prev.addEventListener("click", () => {
        if (egresosTipoState.page <= 0) return;
        egresosTipoState.page--;
        cargarEgresosPorTipo();
      });
    }

    if (next && !next.dataset.bound) {
      next.dataset.bound = "1";
      next.addEventListener("click", () => {
        egresosTipoState.page++;
        cargarEgresosPorTipo();
      });
    }
  }

  // ============================================================
  // 6) MODAL REGISTRAR — POST /api/egreso/registrar
  //    ✅ FIX overlay fullscreen + lock scroll
  // ============================================================
  function bindModalEgresos() {
    let modal = document.getElementById("modalEgreso");
    const form = document.getElementById("formEgreso");
    if (!modal || !form) return;

    // FIX: mover a <body> (evita “hueco arriba” si algún contenedor tiene transform)
    if (modal.parentElement !== document.body) {
      document.body.appendChild(modal);
      modal = document.getElementById("modalEgreso");
    }

    // overlay fullscreen duro
    modal.style.left = "0";
    modal.style.top = "0";
    modal.style.width = "100vw";
    modal.style.height = "100vh";
    modal.style.zIndex = "999999";

    const lockScroll = () => {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    };
    const unlockScroll = () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };

    if (modal.dataset.bound === "1") return;
    modal.dataset.bound = "1";

    const title = document.getElementById("modalEgresoTitle");
    const subtitle = document.getElementById("modalEgresoSubtitle");

    const inDesc = document.getElementById("egresoDescripcion");
    const inMonto = document.getElementById("egresoMonto");

    const errBox = document.getElementById("modalEgresoError");
    const errDesc = document.getElementById("errDesc");
    const errMonto = document.getElementById("errMonto");

    const btnCerrar = document.getElementById("btnCerrarModalEgreso");
    const btnCancelar = document.getElementById("btnCancelarEgreso");
    const btnGuardar = document.getElementById("btnGuardarEgreso");

    const TITLES = {
      PERSONAL: { t: "Cargar Egreso de Personal", s: "Sueldos, horas, pagos de personal" },
      PRODUCCION: { t: "Cargar Egreso de Producción", s: "Insumos, cajas, materia prima" },
      OTROS: { t: "Cargar Egreso del Día a Día", s: "Gastos varios del día" },
    };

    const showMsg = (el, msg) => {
      if (!el) return;
      el.textContent = msg || "";
      el.classList.toggle("hidden", !msg);
    };

    const toastOk = (msg) => {
      if (window.toast?.success) return window.toast.success(msg);
      if (window.showToast) return window.showToast(msg);
      alert(msg);
    };

    const open = (tipo) => {
      modal.dataset.tipoEgreso = tipo;
      const cfg = TITLES[tipo] || { t: "Cargar egreso", s: "Completá detalle y monto" };

      if (title) title.textContent = cfg.t;
      if (subtitle) subtitle.textContent = cfg.s;

      if (inDesc) inDesc.value = "";
      if (inMonto) inMonto.value = "";

      showMsg(errBox, "");
      showMsg(errDesc, "");
      showMsg(errMonto, "");

      if (btnGuardar) {
        btnGuardar.disabled = false;
        btnGuardar.textContent = "Guardar egreso";
      }

      lockScroll();
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      setTimeout(() => inDesc?.focus(), 50);
    };

    const close = () => {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      unlockScroll();
    };

    btnCerrar?.addEventListener("click", close);
    btnCancelar?.addEventListener("click", close);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });

    document.addEventListener("keydown", (e) => {
      if (!modal.classList.contains("hidden") && e.key === "Escape") close();
    });

    // Botones que abren modal
    document.getElementById("btn-egreso-personal")?.addEventListener("click", () => open("PERSONAL"));
    document.getElementById("btn-egreso-produccion")?.addEventListener("click", () => open("PRODUCCION"));
    document.getElementById("btn-egreso-dia")?.addEventListener("click", () => open("OTROS"));

    // Submit -> POST
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      showMsg(errBox, "");
      showMsg(errDesc, "");
      showMsg(errMonto, "");

      const tipoEgreso = modal.dataset.tipoEgreso || "OTROS";
      const descripcion = (inDesc?.value || "").trim();

      const montoRaw = String(inMonto?.value || "").replace(",", ".");
      const monto = Number(montoRaw);

      let ok = true;
      if (!descripcion) {
        showMsg(errDesc, "Poné un detalle (obligatorio).");
        ok = false;
      }
      if (!Number.isFinite(monto) || monto <= 0) {
        showMsg(errMonto, "El monto tiene que ser mayor a 0.");
        ok = false;
      }
      if (!ok) return;

      if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.textContent = "Guardando...";
      }

      try {
        await apiPost("/api/egreso/registrar", {
          tipoEgreso,
          descripcion,
          monto: Number(monto.toFixed(2)),
        });

        close();
        toastOk("✅ Egreso guardado");

        // refresca lo visible
        await Promise.allSettled([
          cargarKpisEgresosAcumulado(),
          cargarTablaEgresosDiarios(),
          cargarEgresosPorTipo(),
        ]);
      } catch (err) {
        showMsg(errBox, err?.message || "No se pudo guardar el egreso.");
        if (btnGuardar) {
          btnGuardar.disabled = false;
          btnGuardar.textContent = "Guardar egreso";
        }
        console.error("Registrar egreso:", err);
      }
    });
  }

  async function cargarKpisEgresos() {
  const base = window.API_BASE_URL || "http://localhost:8080";
  const url = `${base}/api/egreso/porcentajes`;

  const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
  const pctFmt = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const map = {};
    for (const r of data) map[r.tipoEgreso] = r;

    // PERSONAL
    if (map.PERSONAL) {
      setText("egreso-personal-total", money.format(Number(map.PERSONAL.totalMesActual || 0)));
      setPctChip("egreso-personal-pct", map.PERSONAL.porcentaje);
    }

    // PRODUCCION
    if (map.PRODUCCION) {
      setText("egreso-produccion-total", money.format(Number(map.PRODUCCION.totalMesActual || 0)));
      setPctChip("egreso-produccion-pct", map.PRODUCCION.porcentaje);
    }

    // OTROS -> tu card "Día a Día"
    if (map.OTROS) {
      setText("egreso-dia-total", money.format(Number(map.OTROS.totalMesActual || 0)));
      setPctChip("egreso-dia-pct", map.OTROS.porcentaje);
    }

  } catch (e) {
    console.error("❌ Error KPIs egresos:", e);
  }

  function setText(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  }

  function setPctChip(id, pct) {
    const el = document.getElementById(id);
    if (!el) return;

    const n = Number(pct || 0);
    const arrow = n >= 0 ? "▲" : "▼";
    const sign = n >= 0 ? "+" : ""; // el negativo ya trae "-"
    el.textContent = `${arrow} ${sign}${pctFmt.format(n)}% este mes`;
  }
}

document.addEventListener("DOMContentLoaded", cargarKpisEgresos);

function setMesEgresosTitulo() {
  const el = document.getElementById("egresos-mes");
  if (!el) return;

  const ahora = new Date();

  const mesAnio = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric"
  }).format(ahora);

  // Capitaliza: "diciembre de 2025" -> "Diciembre de 2025"
  el.textContent = mesAnio.charAt(0).toUpperCase() + mesAnio.slice(1);
};

  // ============================================================
  // 7) CUANDO SE MUESTRA LA SECCIÓN EGRESO (porque arranca hidden)
  // ============================================================
  function hookSeccionEgreso() {
    const sec = document.querySelector('[data-section="egreso"]');
    if (!sec) return;

    const obs = new MutationObserver(() => {
      const visible =
        !sec.classList.contains("hidden") &&
        getComputedStyle(sec).display !== "none";

      if (visible) {
        bindModalEgresos();     // por si el modal se inyecta tarde
        bindEgresosPorTipoUI(); // por si el select aparece tarde

        Promise.allSettled([
          cargarKpisEgresosAcumulado(),
          cargarTablaEgresosDiarios(),
          cargarEgresosPorTipo(),
        ]);
      }
    });

    obs.observe(sec, { attributes: true, attributeFilter: ["class", "style"] });
  }

  // ============================================================
  // 8) INIT
  // ============================================================
  async function initEgresos() {
    hookSeccionEgreso();
    bindEgresosPorTipoUI();
    bindModalEgresos();
    setMesEgresosTitulo();

    await Promise.allSettled([
      cargarKpisEgresosAcumulado(),
      cargarTablaEgresosDiarios(),
      cargarEgresosPorTipo(),
    ]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEgresos);
  } else {
    initEgresos();
  }


  // Helpers globales para tu navegación (sidebar)
  window.refrescarEgresos = initEgresos;
  window.refrescarEgresosPorTipo = () => {
    egresosTipoState.page = 0;
    cargarEgresosPorTipo();
  };
})();
