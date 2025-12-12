// ============================================================================
// ✅ CAJA.JS (adaptado a backend)
// - Fecha "hoy" local (sin UTC / sin toISOString)
// - Bloqueo coherente (basado en backend):
//    * Futuro: no permite operar
//    * Pasado: solo lectura
//    * Hoy: habilitado si estado != CERRADA
// - Al cerrar: bloquea PedidosYa + Egresos + Cerrar caja (por estado backend)
// - Al refrescar: mantiene estado (ya no usa localStorage)
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
  // Comparación segura porque es YYYY-MM-DD
  return fechaISO > obtenerFechaHoy();
}
function formatearFechaVisual(fechaISO) {
  return fechaISO.split("-").reverse().join("/");
}
function getFechaVista() {
  return $("caja-fecha")?.value || obtenerFechaHoy();
}

// -------------------------------
// Estado de caja (BACKEND)
// -------------------------------
const CAJA_META_CACHE = new Map(); // fechaISO -> { estado, cerradaEn }
const ESTADO = {
  ABIERTA: "ABIERTA",
  CERRADA: "CERRADA"
};

async function fetchCajaMeta(fechaISO) {
  const base = window.API_BASE_URL;

  // 1) Endpoint recomendado: meta/estado
  try {
    const r1 = await fetch(`${base}/api/caja/meta?fecha=${fechaISO}`);
    if (r1.ok) {
      const d = await r1.json();
      return {
        estado: d?.estado ?? null,
        cerradaEn: d?.cerradaEn ?? d?.cerradoEn ?? null
      };
    }
  } catch (_) {}

  // 2) Fallback: intentar leer "estado" desde ingresos (si lo devolvés ahí)
  try {
    const r2 = await fetch(`${base}/api/caja/ingresos?fecha=${fechaISO}`);
    if (r2.ok) {
      const d = await r2.json();
      return {
        estado: d?.estado ?? null,
        cerradaEn: d?.cerradaEn ?? d?.cerradoEn ?? null
      };
    }
  } catch (_) {}

  // 3) Si no hay forma de saber el estado, devolvemos null
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
  return meta?.estado === ESTADO.CERRADA;
}

// -------------------------------
// UI: aplicar estado según fecha + estado backend
// -------------------------------
async function aplicarEstadoUI(fechaISO) {
  const btnCerrar = $("btn-cerrar-caja");
  const btnEgreso = $("btn-abrir-egreso");
  const btnPy = $("btn-pedidosya");

  // FUTURO: no operar
  if (esFechaFutura(fechaISO)) {
    setDisabled(btnCerrar, true);
    setDisabled(btnEgreso, true);
    setDisabled(btnPy, true);

    if (btnCerrar) {
      btnCerrar.textContent = "🚫 Fecha futura";
      btnCerrar.classList.remove("btn-caja-cerrada");
    }
    return;
  }

  const hoy = esHoy(fechaISO);
  const { estado } = await getCajaMeta(fechaISO);

  // PASADO: solo lectura (independiente de estado)
  if (!hoy) {
    setDisabled(btnCerrar, true);
    setDisabled(btnEgreso, true);
    setDisabled(btnPy, true);

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

  if (btnCerrar) {
    btnCerrar.textContent = "Cerrar caja del día";
    btnCerrar.classList.remove("btn-caja-cerrada");
  }
}

// -------------------------------
// Animación / UI balance
// -------------------------------
function animarNumero(elemento, valorFinal, duracion = 800) {
  if (!elemento) return;

  let inicio = 0;
  let rango = valorFinal - inicio;
  let tiempoInicial = null;

  function animar(timestamp) {
    if (!tiempoInicial) tiempoInicial = timestamp;
    let progreso = timestamp - tiempoInicial;

    let porcentaje = Math.min(progreso / duracion, 1);
    let valorActual = Math.floor(porcentaje * rango);

    elemento.textContent = `$${valorActual.toLocaleString("es-AR")}`;

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

// -------------------------------
// Toastify
// -------------------------------
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

  if ($("caja-modo")) {
    $("caja-modo").textContent = "Mostrando resultados filtrados por fecha seleccionada";
  }

  if (!fecha) {
    toastError("Seleccioná una fecha para buscar la caja.");
    return;
  }

  if (esFechaFutura(fecha)) {
    toastError("No podés buscar una fecha futura.");
    await aplicarEstadoUI(fecha);
    return;
  }

  if ($("caja-dia-actual")) {
    $("caja-dia-actual").textContent = `Caja del día: ${formatearFechaVisual(fecha)}`;
  }

  // refrescar estado desde backend cada vez que cambias de fecha
  await getCajaMeta(fecha, { force: true });
  await aplicarEstadoUI(fecha);

  await Promise.allSettled([cargarIngresos(fecha), cargarEgresos(fecha), cargarBalance(fecha)]);
}

// ============================================================================
// ⭐ MOSTRAR FECHA ACTUAL AL INICIAR
// ============================================================================
function pintarFechaActual() {
  const hoyISO = obtenerFechaHoy();
  if ($("caja-dia-actual")) {
    $("caja-dia-actual").textContent = `Caja del día: ${formatearFechaVisual(hoyISO)}`;
  }
}

// ============================================================================
// ⭐ CARGAR INGRESOS POR FECHA
// ============================================================================
async function cargarIngresos(fecha) {
  try {
    const response = await fetch(`${window.API_BASE_URL}/api/caja/ingresos?fecha=${fecha}`);
    if (!response.ok) throw new Error("Error consultando ingresos");

    const data = await response.json();

    // ✅ con los cambios nuevos, "transferencia" YA debería incluir PedidosYa
    const ingresosTotales = Number(data.ingresosTotales ?? 0);
    const efectivo = Number(data.ingresosEfectivo ?? 0);
    const transferencia = Number(
      data.ingresosTransferencia ?? data.ingresosTransferencias ?? 0
    );

    if ($("kpi-ingresos-totales")) {
      $("kpi-ingresos-totales").textContent = `$${ingresosTotales.toLocaleString("es-AR")}`;
    }
    if ($("kpi-ingresos-efectivo")) {
      $("kpi-ingresos-efectivo").textContent = `$${efectivo.toLocaleString("es-AR")}`;
    }
    if ($("kpi-ingresos-transferencias")) {
      $("kpi-ingresos-transferencias").textContent = `$${transferencia.toLocaleString("es-AR")}`;
    }
    if ($("kpi-mermas")) {
      $("kpi-mermas").textContent = `$${Number(data.totalMermas ?? data.mermas ?? 0).toLocaleString("es-AR")}`;
    }

    // Si tu backend devuelve estado acá, cachealo (así no hace falta otro fetch)
    if (data?.estado) {
      CAJA_META_CACHE.set(fecha, {
        estado: data.estado,
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
    const response = await fetch(`${window.API_BASE_URL}/api/caja/egresos?fecha=${fecha}`);
    if (!response.ok) throw new Error("Error consultando egresos");

    const data = await response.json();

    const tbody = $("tabla-egresos-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    (data || []).forEach((e) => {
      const monto = Number(e.monto ?? 0);

      const tr = document.createElement("tr");
      tr.className = "border-b border-slate-200 hover:bg-slate-50 transition-colors";

      tr.innerHTML = `
        <td class="px-4 py-3 text-slate-700 flex items-center gap-2">
          <span class="text-red-500 text-sm">💸</span>
          <span>${e.descripcion ?? ""}</span>
        </td>

        <td class="px-4 py-3 text-right">
          <span class="text-red-600 font-semibold bg-red-50 px-2 py-1 rounded-lg">
            -$${monto.toLocaleString("es-AR")}
          </span>
        </td>

        <td class="px-4 py-3 text-right text-slate-500">
          ${e.hora ?? ""}
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
    const response = await fetch(`${window.API_BASE_URL}/api/caja/balance?fecha=${fecha}`);
    if (!response.ok) throw new Error("Error obteniendo balance");

    const data = await response.json();
    const balance = Number(data.balance ?? data.balanceFinal ?? 0);

    const balanceEl = $("caja-balance");
    animarNumero(balanceEl, balance);
    pintarColorBalance(balance);
  } catch (error) {
    console.error("Error cargando balance:", error);
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
    const response = await fetch(`${window.API_BASE_URL}/api/caja/registrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error();

    cerrarModalEgreso();

    await Promise.allSettled([cargarEgresos(fecha), cargarBalance(fecha)]);
    toastOk("Egreso registrado");
  } catch (err) {
    toastError("No se pudo registrar el egreso");
  }
}

// ============================================================================
// ⭐ MODAL PEDIDOS YA
// ============================================================================
on("btn-pedidosya", "click", async () => {
  const fechaVista = getFechaVista();

  if (esFechaFutura(fechaVista)) return toastError("No podés operar una fecha futura.");
  if (!esHoy(fechaVista)) return toastError("Solo podés cargar PedidosYa en el día de hoy.");

  await getCajaMeta(fechaVista, { force: true });
  if (await estaCerradaBackend(fechaVista)) return toastError("La caja de hoy está cerrada.");

  const pyFecha = $("py-fecha");
  if (pyFecha && !pyFecha.value) pyFecha.value = fechaVista;

  $("modal-pedidosya")?.classList.remove("hidden");
});

on("py-cancelar", "click", cerrarModalPY);

function cerrarModalPY() {
  $("modal-pedidosya")?.classList.add("hidden");
  if ($("py-fecha")) $("py-fecha").value = "";
  if ($("py-monto")) $("py-monto").value = "";
}

on("py-guardar", "click", registrarPedidosYa);

async function registrarPedidosYa() {
  const fechaVista = getFechaVista();

  if (esFechaFutura(fechaVista)) return toastError("No podés operar una fecha futura.");
  if (!esHoy(fechaVista)) return toastError("Solo podés cargar PedidosYa en el día de hoy.");

  await getCajaMeta(fechaVista, { force: true });
  if (await estaCerradaBackend(fechaVista)) return toastError("La caja de hoy está cerrada.");

  const fecha = $("py-fecha")?.value;
  const monto = Number($("py-monto")?.value ?? 0);

  if (!fecha || monto <= 0) {
    toastError("Completá la fecha y el monto");
    return;
  }

  if (esFechaFutura(fecha)) {
    toastError("No podés cargar PedidosYa en una fecha futura.");
    return;
  }

  const payload = { fecha, monto };

  try {
    const response = await fetch(`${window.API_BASE_URL}/api/caja/registrar-py`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error();

    cerrarModalPY();
    toastOk("PedidosYa registrado");

    await Promise.allSettled([cargarIngresos(fecha), cargarBalance(fecha)]);
  } catch (err) {
    toastError("No se pudo registrar PedidosYa");
  }
}

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
    const response = await fetch(`${window.API_BASE_URL}/api/caja/cierre?fecha=${fecha}`, {
      method: "POST"
    });

    if (!response.ok) throw new Error();

    const data = await response.json();

    // cachear estado cerrado si viene, o forzar refresco de meta
    if (data?.estado) {
      CAJA_META_CACHE.set(fecha, {
        estado: data.estado,
        cerradaEn: data?.cerradaEn ?? data?.cerradoEn ?? null
      });
    } else {
      await getCajaMeta(fecha, { force: true });
    }

    // balance
    if (data?.balanceFinal != null) {
      animarNumero($("caja-balance"), Number(data.balanceFinal));
      pintarColorBalance(Number(data.balanceFinal));
    } else {
      await cargarBalance(fecha);
    }

    await aplicarEstadoUI(fecha);
    mostrarToastCajaCerrada();
  } catch (err) {
    toastError("No se pudo cerrar la caja");
  }
}

// ============================================================================
// ⭐ INICIALIZACIÓN
// ============================================================================
export function initCaja() {
  if ($("caja-modo")) {
    $("caja-modo").textContent = "Mostrando caja del día de hoy (automático)";
  }

  pintarFechaActual();

  const hoy = obtenerFechaHoy();

  // ✅ No permitir fecha futura desde el input
  const input = $("caja-fecha");
  if (input) input.max = hoy;

  // Cargar estado + aplicar UI (sin depender de localStorage)
  getCajaMeta(hoy, { force: true }).finally(() => aplicarEstadoUI(hoy));

  cargarIngresos(hoy);
  cargarEgresos(hoy);
  cargarBalance(hoy);
}
