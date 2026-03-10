// ============================================================================
// ✅ CAJA.JS (corregido)
// - Fecha "hoy" local (sin UTC / sin toISOString)
// - Bloqueo coherente (basado en backend):
//    * Futuro: no permite operar
//    * Pasado: solo lectura
//    * Hoy: habilitado si estado != CERRADA
// - Al cerrar: ✅ cachea CERRADA en front sí o sí (aunque el back no devuelva estado)
// - ✅ FIX: normaliza estado (trim/upper) para que compare bien
// - ✅ FIX: al cerrar/bloquear, también desactiva toggle PedidosYa y cierra el inline
// - ✅ NUEVO: consume /api/caja/pedidos?estado=ENTREGADO&fecha=... y pinta 3 tablas
// ============================================================================

// -------------------------------
// Helpers DOM
// -------------------------------
function $(id) {
  return document.getElementById(id);
}
function on(id, event, handler) {
  const el = $(id);
  if (el) el.addEventListener(event, handler);
  return el;
}
function setDisabled(el, disabled) {
  if (!el) return;
  el.disabled = disabled;
  el.classList.toggle("opacity-40", disabled);
  el.classList.toggle("cursor-not-allowed", disabled);
}
function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

// -------------------------------
// Helpers formato
// -------------------------------
function fmtMoneyAR(n) {
  const v = Number(n ?? 0);
  return `$${v.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtHora(hhmmss) {
  if (!hhmmss) return "—";
  return String(hhmmss).slice(0, 5); // "21:13:00" -> "21:13"
}
function formatearFechaVisual(fechaISO) {
  return String(fechaISO ?? "").split("-").reverse().join("/");
}

// -------------------------------
// Fetch helpers (maneja 204 No Content)
// -------------------------------
async function fetchJsonOrEmpty(url, options) {
  const r = await fetch(url, options);
  if (r.status === 204) return null;
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

// -------------------------------
// Fecha (LOCAL, sin UTC)
// -------------------------------
function obtenerFechaHoy() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`; // ISO local
}
function esHoy(fechaISO) {
  return fechaISO === obtenerFechaHoy();
}
function esFechaFutura(fechaISO) {
  return fechaISO > obtenerFechaHoy(); // YYYY-MM-DD compara seguro
}
function getFechaVista() {
  return $("caja-fecha")?.value || obtenerFechaHoy();
}

// ============================================================================
// ✅ PEDIDOS YA (INLINE PRO, SIN MODAL)
// ============================================================================

function setPyInlineVisible(visible) {
  const wrap = $("py-inline");
  const fecha = $("py-fecha");
  const monto = $("py-monto");

  if (!wrap || !fecha || !monto) return;

  wrap.classList.toggle("hidden", !visible);
  wrap.classList.toggle("inline-flex", visible);

  fecha.disabled = !visible;
  monto.disabled = !visible;

  if (visible) {
    if (!fecha.value) fecha.value = getFechaVista();
    setTimeout(() => monto.focus(), 0);
  }
}

function setPyButtonMode(mode) {
  // mode: "idle" | "edit" | "saving"
  const btn = $("btn-pedidosya");
  const label = $("py-btn-label");
  const spinner = $("py-btn-spinner");
  const toggle = $("py-toggle");
  const fecha = $("py-fecha");
  const monto = $("py-monto");

  if (!btn || !label || !spinner) return;

  if (mode === "idle") {
    btn.disabled = false;
    spinner.classList.add("hidden");
    label.classList.remove("hidden");
    label.textContent = "PedidosYa";
    btn.classList.remove("bg-rose-600", "text-white", "border-rose-600");
    btn.classList.add("bg-white", "text-rose-600", "border-rose-200");
    btn.classList.add("hover:bg-rose-50");
  }

  if (mode === "edit") {
    btn.disabled = false;
    spinner.classList.add("hidden");
    label.classList.remove("hidden");
    label.textContent = "Guardar PedidosYa";
    btn.classList.remove("bg-white", "text-rose-600", "border-rose-200");
    btn.classList.add("bg-rose-600", "text-white", "border-rose-600");
    btn.classList.remove("hover:bg-rose-50");
    btn.classList.add("hover:opacity-95");
  }

  if (mode === "saving") {
    btn.disabled = true;
    label.classList.add("hidden");
    spinner.classList.remove("hidden");
    spinner.classList.add("inline-flex");

    if (toggle) toggle.disabled = true;
    if (fecha) fecha.disabled = true;
    if (monto) monto.disabled = true;
  }
}

function unlockPyInputs() {
  const toggle = $("py-toggle");
  const fecha = $("py-fecha");
  const monto = $("py-monto");

  if (toggle) toggle.disabled = false;

  if (toggle?.checked) {
    if (fecha) fecha.disabled = false;
    if (monto) monto.disabled = false;
  } else {
    if (fecha) fecha.disabled = true;
    if (monto) monto.disabled = true;
  }
}

function hardResetPyUI({ disableToggle = false } = {}) {
  const toggle = $("py-toggle");
  if (toggle) {
    toggle.checked = false;
    toggle.disabled = !!disableToggle;
  }
  setPyInlineVisible(false);
  setPyButtonMode("idle");
  if ($("py-monto")) $("py-monto").value = "";
}

// ============================================================================
// ✅ ESTADO DE CAJA (BACKEND) + NORMALIZACIÓN
// ============================================================================

const CAJA_META_CACHE = new Map(); // fechaISO -> { estado, cerradaEn }
const ESTADO = {
  ABIERTA: "ABIERTA",
  CERRADA: "CERRADA"
};

function normEstado(v) {
  const s = String(v ?? "").trim().toUpperCase();
  return s || null;
}

async function fetchCajaMeta(fechaISO) {
  const base = window.API_BASE_URL;

  // 1) Endpoint recomendado: meta/estado
  try {
    const d = await fetchJsonOrEmpty(`${base}/api/caja/meta?fecha=${fechaISO}`);
    if (d) {
      return {
        estado: normEstado(d?.estado),
        cerradaEn: d?.cerradaEn ?? d?.cerradoEn ?? null
      };
    }
  } catch (_) {}

  // 2) Fallback: intentar leer "estado" desde ingresos
  try {
    const d = await fetchJsonOrEmpty(`${base}/api/caja/ingresos?fecha=${fechaISO}`);
    if (d) {
      return {
        estado: normEstado(d?.estado),
        cerradaEn: d?.cerradaEn ?? d?.cerradoEn ?? null
      };
    }
  } catch (_) {}

  return { estado: null, cerradaEn: null };
}

async function getCajaMeta(fechaISO, { force = false } = {}) {
  if (!force && CAJA_META_CACHE.has(fechaISO)) return CAJA_META_CACHE.get(fechaISO);
  const meta = await fetchCajaMeta(fechaISO);
  CAJA_META_CACHE.set(fechaISO, meta);
  return meta;
}

async function estaCerradaBackend(fechaISO) {
  const meta = await getCajaMeta(fechaISO);
  return normEstado(meta?.estado) === ESTADO.CERRADA;
}

// ============================================================================
// ✅ UI: aplicar estado según fecha + estado backend
// ============================================================================

async function aplicarEstadoUI(fechaISO) {
  const btnCerrar = $("btn-cerrar-caja");
  const btnEgreso = $("btn-abrir-egreso");
  const btnPy = $("btn-pedidosya");
  const pyToggle = $("py-toggle");

  // FUTURO: no operar
  if (esFechaFutura(fechaISO)) {
    setDisabled(btnCerrar, true);
    setDisabled(btnEgreso, true);
    setDisabled(btnPy, true);
    setDisabled(pyToggle, true);

    hardResetPyUI({ disableToggle: true });

    if (btnCerrar) {
      btnCerrar.textContent = "🚫 Fecha futura";
      btnCerrar.classList.remove("btn-caja-cerrada");
    }
    return;
  }

  const hoy = esHoy(fechaISO);
  const meta = await getCajaMeta(fechaISO);
  const estado = normEstado(meta?.estado);

  // PASADO: solo lectura
  if (!hoy) {
    setDisabled(btnCerrar, true);
    setDisabled(btnEgreso, true);
    setDisabled(btnPy, true);
    setDisabled(pyToggle, true);

    hardResetPyUI({ disableToggle: true });

    if (btnCerrar) {
      if (estado === ESTADO.CERRADA) {
        btnCerrar.textContent = "✔ Caja cerrada";
        btnCerrar.classList.add("btn-caja-cerrada");
      } else {
        btnCerrar.textContent = "🔒 Solo lectura";
        btnCerrar.classList.remove("btn-caja-cerrada");
      }
    }
    return;
  }

  // HOY: si CERRADA => bloquear todo
  if (estado === ESTADO.CERRADA) {
    setDisabled(btnCerrar, true);
    setDisabled(btnEgreso, true);
    setDisabled(btnPy, true);
    setDisabled(pyToggle, true);

    hardResetPyUI({ disableToggle: true });

    if (btnCerrar) {
      btnCerrar.textContent = "✔ Caja cerrada";
      btnCerrar.classList.add("btn-caja-cerrada");
    }
    return;
  }

  // HOY ABIERTA (o sin estado detectable): habilitar todo
  setDisabled(btnCerrar, false);
  setDisabled(btnEgreso, false);
  setDisabled(btnPy, false);
  setDisabled(pyToggle, false);

  // PedidosYa queda en modo idle, no te lo dejo “abierto” si venías de cerrado
  hardResetPyUI({ disableToggle: false });

  if (btnCerrar) {
    btnCerrar.textContent = "Cerrar caja del día";
    btnCerrar.classList.remove("btn-caja-cerrada");
  }
}

// ============================================================================
// Animación / UI balance
// ============================================================================
function animarNumero(elemento, valorFinal, duracion = 800) {
  if (!elemento) return;

  const inicio = 0;
  const rango = valorFinal - inicio;
  let tiempoInicial = null;

  function animar(timestamp) {
    if (!tiempoInicial) tiempoInicial = timestamp;
    const progreso = timestamp - tiempoInicial;

    const porcentaje = Math.min(progreso / duracion, 1);
    const valorActual = Math.floor(porcentaje * rango);

    elemento.textContent = fmtMoneyAR(valorActual);
    if (porcentaje < 1) requestAnimationFrame(animar);
  }

  requestAnimationFrame(animar);
}

function pintarColorBalance(balance) {
  const el = $("caja-balance");
  if (!el) return;

  el.classList.remove(
    "text-red-600",
    "text-green-600",
    "bg-gradient-to-r",
    "from-green-600",
    "to-emerald-500",
    "from-red-600",
    "to-red-400"
  );

  if (balance >= 0) el.classList.add("text-green-600");
  else el.classList.add("text-red-600");
}

// ============================================================================
// Toastify
// ============================================================================
function toastOk(msg) {
  if (typeof Toastify === "undefined") return alert(msg);
  Toastify({
    text: msg,
    duration: 2500,
    gravity: "top",
    position: "right",
    style: { background: "#10B981" }
  }).showToast();
}
function toastError(msg) {
  if (typeof Toastify === "undefined") return alert(msg);
  Toastify({
    text: msg,
    duration: 2500,
    gravity: "top",
    position: "right",
    style: { background: "#EF4444" }
  }).showToast();
}
function mostrarToastCajaCerrada() {
  const t = $("toast-caja");
  if (!t) return;

  t.classList.remove("hidden");

  setTimeout(() => (t.style.opacity = "0"), 2000);
  setTimeout(() => {
    t.classList.add("hidden");
    t.style.opacity = "1";
  }, 2800);
}

// ============================================================================
// ⭐ FILTRO PRINCIPAL DE FECHA
// ============================================================================
on("btn-ver-caja", "click", cargarCajaPorFecha);

async function cargarCajaPorFecha() {
  const fecha = $("caja-fecha")?.value;

  setText("caja-modo", "Mostrando resultados filtrados por fecha seleccionada");

  if (!fecha) {
    toastError("Seleccioná una fecha para buscar la caja.");
    return;
  }

  if (esFechaFutura(fecha)) {
    toastError("No podés buscar una fecha futura.");
    await aplicarEstadoUI(fecha);
    return;
  }

  setText("caja-dia-actual", `Caja del día: ${formatearFechaVisual(fecha)}`);

  await getCajaMeta(fecha, { force: true });
  await aplicarEstadoUI(fecha);

  await Promise.allSettled([
    cargarIngresos(fecha),
    cargarEgresos(fecha),
    cargarBalance(fecha),
    cargarPedidosParaTablas(fecha)
  ]);
}

// ============================================================================
// ⭐ MOSTRAR FECHA ACTUAL AL INICIAR
// ============================================================================
function pintarFechaActual() {
  const hoyISO = obtenerFechaHoy();
  setText("caja-dia-actual", `Caja del día: ${formatearFechaVisual(hoyISO)}`);
}

// ============================================================================
// ⭐ CARGAR INGRESOS POR FECHA
// ============================================================================
async function cargarIngresos(fecha) {
  try {
    const base = window.API_BASE_URL;
    const data = await fetchJsonOrEmpty(`${base}/api/caja/preview/${fecha}`);
    if (!data) return;

    const ingresosTotales = Number(data.ingresosTotales ?? 0);
    const efectivo = Number(data.ingresosEfectivo ?? 0);
    const transferencia = Number(data.ingresosTransferencia ?? data.ingresosTransferencias ?? 0);
    const egresosTotales = Number(data.totalEgresos ?? 0);

    setText("kpi-ingresos-totales", fmtMoneyAR(ingresosTotales));
    setText("kpi-ingresos-efectivo", fmtMoneyAR(efectivo));
    setText("kpi-ingresos-transferencias", fmtMoneyAR(transferencia));
    setText("kpi-mermas", fmtMoneyAR(egresosTotales));

    // ✅ Si el backend devuelve estado acá, cachealo normalizado
    if (data?.estado) {
      CAJA_META_CACHE.set(fecha, {
        estado: normEstado(data.estado),
        cerradaEn: data?.cerradaEn ?? data?.cerradoEn ?? null
      });
    }
  } catch (err) {
    console.error("Error ingresos:", err);
  }
}

// ============================================================================
// ⭐ CARGAR EGRESOS POR FECHA
// ============================================================================
async function cargarEgresos(fecha) {
  try {
    const base = window.API_BASE_URL;
    const data = await fetchJsonOrEmpty(`${base}/api/caja/preview/${fecha}`);
    const tbody = $("tabla-egresos-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    const lista = Array.isArray(data) ? data : [];
    if (lista.length === 0) return;

    lista.forEach((e) => {
      const monto = Number(e.monto ?? 0);

      const tr = document.createElement("tr");
      tr.className = "border-b border-slate-200 hover:bg-slate-50 transition-colors";

      tr.innerHTML = `
        <td class="px-4 py-3 text-slate-700 flex items-center gap-2">
          <span class="text-red-500 text-sm">💸</span>
          <span>${String(e.descripcion ?? "")}</span>
        </td>

        <td class="px-4 py-3 text-right">
          <span class="text-red-600 font-semibold bg-red-50 px-2 py-1 rounded-lg">
            -${fmtMoneyAR(monto)}
          </span>
        </td>

        <td class="px-4 py-3 text-right text-slate-500">
          ${String(e.hora ?? "")}
        </td>
      `;

      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Error cargando egresos:", err);
  }
}

// ============================================================================
// ⭐ CARGAR BALANCE POR FECHA
// ============================================================================
async function cargarBalance(fecha) {
  try {
    const base = window.API_BASE_URL;
    const data = await fetchJsonOrEmpty(`${base}/api/caja/preview/${fecha}`);
    if (!data) return;

    const balance = Number(data.balance ?? data.balanceFinal ?? 0);
    animarNumero($("caja-balance"), balance);
    pintarColorBalance(balance);
  } catch (err) {
    console.error("Error cargando balance:", err);
  }
}

// ============================================================================
// ⭐ PEDIDOS → 3 TABLAS (EFECTIVO / TRANSFERENCIA / PEDIDOS_YA)
// ============================================================================
function vaciarTablaConEmptyState(tbody, cols, msg) {
  if (!tbody) return;
  tbody.innerHTML = "";

  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = cols;
  td.className = "px-3 py-10 text-center text-slate-400";
  td.textContent = msg;

  tr.appendChild(td);
  tbody.appendChild(tr);
}

function renderTablaPedidos(tbodyId, rows, { tipo }) {
  const tbody = $(tbodyId);
  if (!tbody) return;

  const cols = 3;
  tbody.innerHTML = "";

  if (!rows || rows.length === 0) {
    const msg =
      tipo === "pedidosya"
        ? "Sin pedidos de PedidosYa."
        : tipo === "transferencia"
          ? "Sin pedidos por transferencia."
          : "Sin pedidos en efectivo.";
    vaciarTablaConEmptyState(tbody, cols, msg);
    return;
  }

  rows.forEach((p) => {
    const tr = document.createElement("tr");
    tr.className = "border-b border-slate-50 hover:bg-slate-50 transition-colors";

    if (tipo !== "pedidosya") {
      const tdHora = document.createElement("td");
      tdHora.className = "px-3 py-2 font-extrabold text-slate-700";
      tdHora.textContent = fmtHora(p.horaEntrega);

      const tdCliente = document.createElement("td");
      tdCliente.className = "px-3 py-2 text-slate-700 truncate max-w-[220px]";
      tdCliente.textContent = p.cliente ?? "";

      const tdTotal = document.createElement("td");
      tdTotal.className = "px-3 py-2 text-right font-black text-slate-900";
      tdTotal.textContent = fmtMoneyAR(p.totalPedido);

      tr.appendChild(tdHora);
      tr.appendChild(tdCliente);
      tr.appendChild(tdTotal);
    } else {
      const tdNro = document.createElement("td");
      tdNro.className = "px-3 py-2 font-extrabold text-slate-700";
      tdNro.textContent = p.numeroPedidoPedidosYa ?? "—";

      const tdCliente = document.createElement("td");
      tdCliente.className = "px-3 py-2 text-slate-700 truncate max-w-[220px]";
      tdCliente.textContent = p.cliente ?? "";

      const tdTotal = document.createElement("td");
      tdTotal.className = "px-3 py-2 text-right font-black text-slate-900";
      tdTotal.textContent = fmtMoneyAR(p.totalPedido);

      tr.appendChild(tdNro);
      tr.appendChild(tdCliente);
      tr.appendChild(tdTotal);
    }

    tbody.appendChild(tr);
  });
}

function sumarTotal(rows) {
  return (rows || []).reduce((acc, p) => acc + Number(p?.totalPedido ?? 0), 0);
}

async function cargarPedidosParaTablas(fecha) {
  try {
    const base = window.API_BASE_URL;
    const url = `${base}/api/caja/pedidos?estado=ENTREGADO&fecha=${fecha}&page=0&size=500`;
    const data = await fetchJsonOrEmpty(url);

    const pedidos = Array.isArray(data?.content) ? data.content : [];
    const norm = pedidos.map((p) => ({
      idPedido: p.idPedido ?? null,
      cliente: p.cliente ?? "",
      tipoVenta: p.tipoVenta ?? "",
      tipoPago: p.tipoPago ?? "",
      numeroPedidoPedidosYa: p.numeroPedidoPedidosYa ?? null,
      horaEntrega: p.horaEntrega ?? null,
      totalPedido: Number(p.totalPedido ?? 0),
      estadoPedido: p.estadoPedido ?? ""
    }));

    const efectivo = norm.filter((p) => p.tipoVenta === "PARTICULAR" && p.tipoPago === "EFECTIVO");
    const transferencia = norm.filter((p) => p.tipoVenta === "PARTICULAR" && p.tipoPago === "TRANSFERENCIA");
    const pedidosya = norm.filter((p) => p.tipoVenta === "PEDIDOS_YA");

    renderTablaPedidos("tbody-efectivo", efectivo, { tipo: "efectivo" });
    renderTablaPedidos("tbody-transferencia", transferencia, { tipo: "transferencia" });
    renderTablaPedidos("tbody-pedidosya", pedidosya, { tipo: "pedidosya" });

    const tEfe = sumarTotal(efectivo);
    const tTra = sumarTotal(transferencia);
    const tPy = sumarTotal(pedidosya);
    const tGlobal = tEfe + tTra + tPy;

    setText("total-efectivo", fmtMoneyAR(tEfe));
    setText("count-efectivo", String(efectivo.length));

    setText("total-transferencia", fmtMoneyAR(tTra));
    setText("count-transferencia", String(transferencia.length));

    setText("total-pedidosya", fmtMoneyAR(tPy));
    setText("count-pedidosya", String(pedidosya.length));

    setText("total-listado-global", fmtMoneyAR(tGlobal));
    setText("count-global", String(norm.length));
  } catch (err) {
    console.error("Error cargando pedidos para tablas:", err);

    renderTablaPedidos("tbody-efectivo", [], { tipo: "efectivo" });
    renderTablaPedidos("tbody-transferencia", [], { tipo: "transferencia" });
    renderTablaPedidos("tbody-pedidosya", [], { tipo: "pedidosya" });

    setText("total-efectivo", "$0");
    setText("count-efectivo", "0");
    setText("total-transferencia", "$0");
    setText("count-transferencia", "0");
    setText("total-pedidosya", "$0");
    setText("count-pedidosya", "0");
    setText("total-listado-global", "$0");
    setText("count-global", "0");
  }
}

// ============================================================================
// ⭐ MODAL EGRESOS
// ============================================================================
const modalEgreso = $("modal-egreso");

on("btn-abrir-egreso", "click", async () => {
  const fecha = getFechaVista();
  if (esFechaFutura(fecha)) return toastError("No podés operar una fecha futura.");
  if (!esHoy(fecha)) return toastError("Solo podés registrar egresos en el día de hoy.");

  await getCajaMeta(fecha, { force: true });
  if (await estaCerradaBackend(fecha)) return toastError("La caja de hoy está cerrada.");

  modalEgreso?.classList.remove("hidden");
});

on("btn-cerrar-egreso", "click", cerrarModalEgreso);

function cerrarModalEgreso() {
  modalEgreso?.classList.add("hidden");
  if ($("egreso-descripcion")) $("egreso-descripcion").value = "";
  if ($("egreso-monto")) $("egreso-monto").value = "";
}

// ============================================================================
// ⭐ REGISTRAR EGRESO
// ============================================================================
on("btn-guardar-egreso", "click", registrarEgreso);

async function registrarEgreso() {
  const fecha = getFechaVista();

  if (esFechaFutura(fecha)) return toastError("No podés operar una fecha futura.");
  if (!esHoy(fecha)) return toastError("Solo podés registrar egresos en el día de hoy.");

  await getCajaMeta(fecha, { force: true });
  if (await estaCerradaBackend(fecha)) return toastError("La caja de hoy está cerrada.");

  const descripcion = $("egreso-descripcion")?.value?.trim() ?? "";
  const monto = Number($("egreso-monto")?.value ?? 0);

  if (!descripcion || !monto || monto <= 0) {
    toastError("Completá todos los datos del egreso");
    return;
  }

  const payload = { descripcion, monto, fecha };

  try {
    const base = window.API_BASE_URL;
    await fetchJsonOrEmpty(`${base}/api/caja/registrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    cerrarModalEgreso();
    await Promise.allSettled([cargarEgresos(fecha), cargarBalance(fecha), cargarIngresos(fecha)]);
    toastOk("Egreso registrado");
  } catch (_) {
    toastError("No se pudo registrar el egreso");
  }
}

// ============================================================================
// ⭐ PEDIDOS YA (INLINE) - validaciones + guardar
// ============================================================================
async function validarPuedeOperarPY(fechaVista) {
  if (esFechaFutura(fechaVista)) {
    toastError("No podés operar una fecha futura.");
    return false;
  }
  if (!esHoy(fechaVista)) {
    toastError("Solo podés cargar PedidosYa en el día de hoy.");
    return false;
  }

  await getCajaMeta(fechaVista, { force: true });
  if (await estaCerradaBackend(fechaVista)) {
    toastError("La caja de hoy está cerrada.");
    return false;
  }
  return true;
}

async function registrarPedidosYaInline() {
  const fechaVista = getFechaVista();
  if (!(await validarPuedeOperarPY(fechaVista))) return;

  const fecha = $("py-fecha")?.value;
  const monto = Number($("py-monto")?.value ?? 0);

  if (!fecha || monto <= 0) {
    toastError("Completá fecha y monto.");
    return;
  }
  if (esFechaFutura(fecha)) {
    toastError("No podés cargar PedidosYa en una fecha futura.");
    return;
  }

  setPyButtonMode("saving");

  try {
    const base = window.API_BASE_URL;
    await fetchJsonOrEmpty(`${base}/api/pedidosya/liquidacion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha, monto })
    });

    toastOk("PedidosYa registrado");

    // reset UI
    const toggle = $("py-toggle");
    if (toggle) toggle.checked = false;
    setPyInlineVisible(false);
    if ($("py-monto")) $("py-monto").value = "";

    await Promise.allSettled([
      cargarIngresos(fechaVista),
      cargarBalance(fechaVista),
      cargarPedidosParaTablas(fechaVista)
    ]);

    setPyButtonMode("idle");
    unlockPyInputs();
  } catch (e) {
    console.error(e);
    toastError("No se pudo registrar PedidosYa");
    setPyButtonMode("edit");
    unlockPyInputs();
  }
}

// Toggle ON/OFF
on("py-toggle", "change", async (ev) => {
  const checked = ev.target.checked;
  const fechaVista = getFechaVista();

  if (checked && !(await validarPuedeOperarPY(fechaVista))) {
    ev.target.checked = false;
    setPyInlineVisible(false);
    setPyButtonMode("idle");
    return;
  }

  setPyInlineVisible(checked);
  setPyButtonMode(checked ? "edit" : "idle");
});

// Botón: si toggle OFF -> activar edición; si ON -> guardar
on("btn-pedidosya", "click", async () => {
  const toggle = $("py-toggle");
  if (!toggle) return;

  const fechaVista = getFechaVista();

  if (!toggle.checked) {
    if (!(await validarPuedeOperarPY(fechaVista))) return;
    toggle.checked = true;
    setPyInlineVisible(true);
    setPyButtonMode("edit");
    return;
  }

  await registrarPedidosYaInline();
});

// Enter en monto => guardar
on("py-monto", "keydown", async (e) => {
  if (e.key === "Enter") {
    const toggle = $("py-toggle");
    if (toggle?.checked) await registrarPedidosYaInline();
  }
});

// Inicializar modo idle
setPyButtonMode("idle");
setPyInlineVisible(false);

// ============================================================================
// ⭐ CERRAR CAJA (modal confirmación)
// ============================================================================
const modalConfirmar = $("modal-confirmar-caja");

on("btn-cerrar-caja", "click", async () => {
  const fecha = getFechaVista();

  if (esFechaFutura(fecha)) return toastError("No podés cerrar una fecha futura.");
  if (!esHoy(fecha)) return toastError("Solo podés cerrar la caja del día de hoy.");

  await getCajaMeta(fecha, { force: true });
  if (await estaCerradaBackend(fecha)) return toastError("La caja ya está cerrada.");

  modalConfirmar?.classList.remove("hidden");
});

on("btn-caja-cancelar", "click", () => modalConfirmar?.classList.add("hidden"));
on("btn-caja-confirmar", "click", cerrarCajaDiaria);

async function cerrarCajaDiaria() {
  modalConfirmar?.classList.add("hidden");

  const fecha = getFechaVista();

  if (esFechaFutura(fecha)) return toastError("No podés cerrar una fecha futura.");
  if (!esHoy(fecha)) return toastError("Solo podés cerrar la caja del día de hoy.");

  await getCajaMeta(fecha, { force: true });
  if (await estaCerradaBackend(fecha)) {
    await aplicarEstadoUI(fecha);
    return toastOk("La caja ya estaba cerrada.");
  }

  try {
    const base = window.API_BASE_URL;
    const data = await fetchJsonOrEmpty(`${base}/api/caja/cierre?fecha=${fecha}`, { method: "POST" });

    // ✅ FIX CLAVE: si el POST salió OK, en front lo damos por CERRADO (aunque el back no devuelva estado)
    CAJA_META_CACHE.set(fecha, {
      estado: ESTADO.CERRADA,
      cerradaEn: data?.cerradaEn ?? data?.cerradoEn ?? null
    });

    // pintar balance final (si vino)
    if (data?.balanceFinal != null) {
      animarNumero($("caja-balance"), Number(data.balanceFinal));
      pintarColorBalance(Number(data.balanceFinal));
    } else {
      await cargarBalance(fecha);
    }

    await aplicarEstadoUI(fecha);
    mostrarToastCajaCerrada();
  } catch (e) {
    console.error(e);
    toastError("No se pudo cerrar la caja");
  }
}

// ============================================================================
// ⭐ INICIALIZACIÓN
// ============================================================================
export function initCaja() {
  setText("caja-modo", "Mostrando caja del día de hoy (automático)");
  pintarFechaActual();

  const hoy = obtenerFechaHoy();

  // No permitir fecha futura desde el input
  const input = $("caja-fecha");
  if (input) input.max = hoy;

  // Estado + UI
  getCajaMeta(hoy, { force: true }).finally(() => aplicarEstadoUI(hoy));

  // Cargas iniciales
  cargarIngresos(hoy);
  cargarEgresos(hoy);
  cargarBalance(hoy);
  cargarPedidosParaTablas(hoy);
}
