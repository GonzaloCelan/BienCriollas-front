// ============================================================================
// ✅ CAJA.JS (corregido + limpio)
// - Fecha "hoy" en horario local (sin UTC / sin toISOString)
// - Bloqueo coherente:
//    * Futuro: no permite operar
//    * Pasado: solo lectura
//    * Hoy: habilitado si NO está cerrada
// - Al cerrar: bloquea PedidosYa + Egresos + Cerrar caja
// - Al refrescar: mantiene estado "cerrada" (localStorage por fecha)
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
// Persistencia local de "caja cerrada"
// (sin backend extra)
// -------------------------------
const LS_CAJA_CERRADA_PREFIX = "bc_caja_cerrada_";

function estaCerradaLocal(fechaISO) {
  return localStorage.getItem(LS_CAJA_CERRADA_PREFIX + fechaISO) === "1";
}
function marcarCerradaLocal(fechaISO, cerrada) {
  localStorage.setItem(LS_CAJA_CERRADA_PREFIX + fechaISO, cerrada ? "1" : "0");
}

// -------------------------------
// UI: aplicar estado según fecha + cerrada
// -------------------------------
function aplicarEstadoUI(fechaISO) {
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
  const cerrada = estaCerradaLocal(fechaISO);

  // PASADO: solo lectura
  if (!hoy) {
    setDisabled(btnCerrar, true);
    setDisabled(btnEgreso, true);
    setDisabled(btnPy, true);

    if (btnCerrar) {
      btnCerrar.textContent = cerrada ? "✔ Caja cerrada" : "🔒 Solo lectura";
      btnCerrar.classList.toggle("btn-caja-cerrada", cerrada);
    }
    return;
  }

  // HOY: si cerrada => bloquear todo
  if (cerrada) {
    setDisabled(btnCerrar, true);
    setDisabled(btnEgreso, true);
    setDisabled(btnPy, true);

    if (btnCerrar) {
      btnCerrar.textContent = "✔ Caja cerrada";
      btnCerrar.classList.add("btn-caja-cerrada");
    }
    return;
  }

  // HOY ABIERTA: habilitar todo
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
    aplicarEstadoUI(fecha);
    return;
  }

  if ($("caja-dia-actual")) {
    $("caja-dia-actual").textContent = `Caja del día: ${formatearFechaVisual(fecha)}`;
  }

  aplicarEstadoUI(fecha);

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

    const ingresosTotales = Number(data.ingresosTotales ?? 0);
    const efectivo = Number(data.ingresosEfectivo ?? 0);
    const transferBase = Number(data.ingresosTransferencias ?? 0);

    // Si tu backend devuelve totalPedidosYa separado (como en tu DTO),
    // lo sumamos acá para que "Transferencias" represente (particular + pedidosya).
    const totalPedidosYa = data.totalPedidosYa == null ? 0 : Number(data.totalPedidosYa);

    const transferMostrar = transferBase + totalPedidosYa;

    if ($("kpi-ingresos-totales")) {
      $("kpi-ingresos-totales").textContent = `$${ingresosTotales.toLocaleString("es-AR")}`;
    }
    if ($("kpi-ingresos-efectivo")) {
      $("kpi-ingresos-efectivo").textContent = `$${efectivo.toLocaleString("es-AR")}`;
    }
    if ($("kpi-ingresos-transferencias")) {
      $("kpi-ingresos-transferencias").textContent = `$${transferMostrar.toLocaleString("es-AR")}`;
    }
    if ($("kpi-mermas")) {
      $("kpi-mermas").textContent = `$${Number(data.totalMermas ?? 0).toLocaleString("es-AR")}`;
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
    const balance = Number(data.balance ?? 0);

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

on("btn-abrir-egreso", "click", () => {
  const fecha = getFechaVista();
  if (esFechaFutura(fecha)) return toastError("No podés operar una fecha futura.");
  if (!esHoy(fecha)) return toastError("Solo podés registrar egresos en el día de hoy.");
  if (estaCerradaLocal(fecha)) return toastError("La caja de hoy está cerrada.");

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
  if (estaCerradaLocal(fecha)) return toastError("La caja de hoy está cerrada.");

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
on("btn-pedidosya", "click", () => {
  const fechaVista = getFechaVista();

  if (esFechaFutura(fechaVista)) return toastError("No podés operar una fecha futura.");
  if (!esHoy(fechaVista)) return toastError("Solo podés cargar PedidosYa en el día de hoy.");
  if (estaCerradaLocal(fechaVista)) return toastError("La caja de hoy está cerrada.");

  // Prellenar fecha del modal con la fecha vista (más claro)
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
  if (estaCerradaLocal(fechaVista)) return toastError("La caja de hoy está cerrada.");

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

on("btn-cerrar-caja", "click", () => {
  const fecha = getFechaVista();

  // Si está bloqueado por lógica, no abrir modal
  if (esFechaFutura(fecha)) return toastError("No podés cerrar una fecha futura.");
  if (!esHoy(fecha)) return toastError("Solo podés cerrar la caja del día de hoy.");
  if (estaCerradaLocal(fecha)) return toastError("La caja ya está cerrada.");

  modalConfirmar?.classList.remove("hidden");
});

on("btn-caja-cancelar", "click", () => modalConfirmar?.classList.add("hidden"));
on("btn-caja-confirmar", "click", cerrarCajaDiaria);

async function cerrarCajaDiaria() {
  modalConfirmar?.classList.add("hidden");

  const fecha = getFechaVista();

  if (esFechaFutura(fecha)) return toastError("No podés cerrar una fecha futura.");
  if (!esHoy(fecha)) return toastError("Solo podés cerrar la caja del día de hoy.");
  if (estaCerradaLocal(fecha)) {
    aplicarEstadoUI(fecha);
    return toastOk("La caja ya estaba cerrada.");
  }

  try {
    const response = await fetch(`${window.API_BASE_URL}/api/caja/cierre?fecha=${fecha}`, {
      method: "POST"
    });

    if (!response.ok) throw new Error();

    const data = await response.json();

    // Si tu backend devuelve balanceFinal:
    if (data?.balanceFinal != null) {
      animarNumero($("caja-balance"), Number(data.balanceFinal));
      pintarColorBalance(Number(data.balanceFinal));
    } else {
      // Por las dudas, recalcular
      await cargarBalance(fecha);
    }

    // ✅ persistir cierre + bloquear todo
    marcarCerradaLocal(fecha, true);
    aplicarEstadoUI(fecha);

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

  aplicarEstadoUI(hoy);

  cargarIngresos(hoy);
  cargarEgresos(hoy);
  cargarBalance(hoy);
}
