


// ==============================
// 🔊 AVISOS Para stock bajo
// ==============================

async function obtenerStockActual() {
  const url = `${window.API_BASE_URL}/stock/obtener-stock-actual`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Error consultando el stock actual");

    return await response.json(); // 👉 Esto devuelve el array de variedades directamente

  } catch (error) {
    console.error("Error obteniendo stock actual:", error);
    return []; // no rompe el front si falla
  }
}


// ==============================
// 🔊 AVISOS POR VOZ DE PEDIDOS
// ==============================

// Función simple para hablar (profesional)
function hablar(texto) {
  if (!("speechSynthesis" in window)) {
    console.warn("El navegador no soporta síntesis de voz");
    return;
  }

  const msg = new SpeechSynthesisUtterance(texto);
  msg.lang = "es-AR";   // o "es-ES", la voz la decide el navegador
  msg.rate = 1;
  window.speechSynthesis.speak(msg);
}

let ultimaCantidadReportada = 0;

function mostrarAvisoStockBajo(cantidad) {

  // Evita repetir el aviso innecesariamente
  if (cantidad === ultimaCantidadReportada) return;
  ultimaCantidadReportada = cantidad;

  // Crear el toast
  const toast = document.createElement("div");
  toast.classList.add("toast-alert");
  toast.textContent = `⚠️ Hay ${cantidad} variedades con stock bajo. Por favor revisar.`;
  document.body.appendChild(toast);

  // Animación
  setTimeout(() => toast.classList.add("show"), 10);

  // Sacarlo después de 4 segundos
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 4000);

  // ⚠️ Usamos tu función ya existente
  hablar(`Hay ${cantidad} variedades con stock bajo. Por favor revisar el stock.`);
}

function chequearStockBajo(variedades) {
  const MINIMO = 50;

  const bajas = variedades.filter(v => v.stock_disponible <= MINIMO);

  if (bajas.length > 0) {
    mostrarAvisoStockBajo(bajas.length);
  }
}


// ==============================
// 🔹 BADGES DINÁMICOS EN VARIEDADES
// ==============================

const UMBRAL_STOCK_BAJO_PEDIDOS = 50;
let stockPorVariedad = {};

// Usa el mismo endpoint de obtenerStockActual()
async function cargarStockParaPedidos() {
  try {
    const variedades = await obtenerStockActual(); // ya devuelve array

    stockPorVariedad = {};
    variedades.forEach(v => {
      if (v.id_variedad != null) {
        stockPorVariedad[Number(v.id_variedad)] = v.stock_disponible;
      }
    });

    actualizarBadgesDeStockEnVariedades();
  } catch (error) {
    console.error("No se pudo cargar el stock para pedidos:", error);
  }
}

function actualizarBadgesDeStockEnVariedades() {
  const cards = document.querySelectorAll("[data-variedad-card]");

  cards.forEach(card => {
    const idVar = Number(card.dataset.variedadId);
    const badge = card.querySelector("[data-badge-stock]");
    if (!badge || !idVar) return;

    const stock = stockPorVariedad[idVar];

    let baseClasses =
      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ";

    if (stock == null) {
      badge.textContent = "Sin datos de stock";
      badge.className = baseClasses + "bg-slate-100 text-slate-500 border-slate-200";
    } else if (stock === 0) {
      badge.textContent = "Sin stock";
      badge.className = baseClasses + "bg-rose-50 text-rose-700 border-rose-200";
    } else if (stock <= UMBRAL_STOCK_BAJO_PEDIDOS) {
      badge.textContent = `Bajo stock (${stock})`;
      badge.className = baseClasses + "bg-amber-50 text-amber-700 border-amber-200";
    } else {
      badge.textContent = `Stock: ${stock}`;
      badge.className = baseClasses + "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
  });
}



// ==============================
// 🔊 AVISOS POR VOZ DE PEDIDOS (continuación)
// ==============================

// Para no repetir avisos del mismo pedido
const avisosProgramados = new Set();

// Convierte horaEntrega ("22:00:00" o "22:00") a Date de HOY
function obtenerFechaEntregaComoDate(pedido) {
  const hRaw = (pedido.horaEntrega ?? "").toString().trim();
  if (!hRaw) return null;

  const partes = hRaw.split(":"); // "22:00:00" → ["22","00","00"]

  if (partes.length >= 2) {
    const hh = parseInt(partes[0], 10) || 0;
    const mm = parseInt(partes[1], 10) || 0;
    const ss = partes.length >= 3 ? parseInt(partes[2], 10) || 0 : 0;

    const d = new Date();
    d.setHours(hh, mm, ss, 0);
    return d;
  }

  // Por si alguna vez viene en ISO
  const dIso = new Date(hRaw);
  return isNaN(dIso.getTime()) ? null : dIso;
}

// Mensaje profesional de aviso
function anunciarPedido(pedido, minutos) {
  const cliente = pedido.cliente || "un cliente";
  const id = pedido.idPedido;

  const plural = minutos === 1 ? "minuto" : "minutos";

  let texto;

  if (id) {
    texto = `Atención. Faltan ${minutos} ${plural} para el pedido número ${id} de ${cliente}.`;
  } else {
    texto = `Atención. Faltan ${minutos} ${plural} para el pedido de ${cliente}.`;
  }

  hablar(texto);
}

// Programa el aviso 10 minutos antes para UN pedido
function programarAvisoVozParaPedido(pedido) {
  // identificador único
  const fechaEntrega = obtenerFechaEntregaComoDate(pedido);
  if (!fechaEntrega) {
    console.warn("No se pudo interpretar horaEntrega para el pedido:", pedido);
    return;
  }

  const idUnico = pedido.idPedido ?? `${pedido.cliente}-${fechaEntrega.toISOString()}`;

  // Si ya lo programé, no lo repito
  if (avisosProgramados.has(idUnico)) return;

  const ahora = new Date();
  const msHastaEntrega = fechaEntrega.getTime() - ahora.getTime();
  const diezMinMs = 10 * 60 * 1000;
  const msHastaAviso = msHastaEntrega - diezMinMs;

  // Si ya pasó la hora → nada
  if (msHastaEntrega <= 0) return;

  avisosProgramados.add(idUnico);

  // Si ya estamos dentro de los 10 minutos → avisar enseguida
  if (msHastaAviso <= 0) {
    const minutosRestantes = Math.max(1, Math.round(msHastaEntrega / 60000));
    anunciarPedido(pedido, minutosRestantes);
    return;
  }

  // Si falta más de 10 minutos → programar el timeout
  setTimeout(() => {
    const ahora2 = new Date();
    const msHastaEntrega2 = fechaEntrega.getTime() - ahora2.getTime();
    const minutosRestantes = Math.max(1, Math.round(msHastaEntrega2 / 60000));
    anunciarPedido(pedido, minutosRestantes);
  }, msHastaAviso);
}



// =============================
// OBTENER PEDIDOS — MÓDULO JS
// =============================

import { showToast } from "../components/toast.js";
// --- Exportamos todas las funciones principales ---
export { 
    cargarPedidosPorEstado, 
    verDetalle, 
    actualizarEstadoPedido, 
    cerrarModalDetalle,
    imprimirTicket,
    crearPedido
};

// Variables internas
let ultimoDetallePedido = [];
let ultimoIdPedido = null;
let ultimoNombreCliente = "";

// -------------------------
//   CARGAR PEDIDOS
// -------------------------
let estadoActual = "PENDIENTE";

async function cargarPedidosPorEstado(estado = estadoActual, page = 0, size = 10) {
  estadoActual = estado;

  try {
    const response = await fetch(
      `${window.API_BASE_URL}/pedido/paginado?estado=${encodeURIComponent(
        estado
      )}&page=${page}&size=${size}`
    );

    if (!response.ok) {
      throw new Error("Error en el servidor");
    }

    const data = await response.json();

    // 👉 TOTAL
    const totalSpan = document.getElementById("total-pedidos");
    if (totalSpan && typeof data.totalElements === "number") {
      totalSpan.textContent = data.totalElements;
    }

    // 👉 TABLA
    const pedidos = data.content || [];
    pintarPedidosEnTabla(pedidos);

    // 🔊 Avisos de voz para pendientes
    if (estado === "PENDIENTE") {
      pedidos.forEach(pedido => programarAvisoVozParaPedido(pedido));
    }

    // 👉 🔥 AVISO DE STOCK BAJO (nuevo)
    try {
      const variedades = await obtenerStockActual();   // trae solo los datos
      chequearStockBajo(variedades);                   // dispara toast + voz
    } catch (e) {
      console.warn("No se pudo verificar stock bajo", e);
    }

    // 👉 PAGINACIÓN
    generarPaginacion(data);

  } catch (error) {
    console.error("❌ Error cargando pedidos:", error);
    alert("No se pudieron cargar los pedidos");
  }
}



// -------------------------
//   PINTAR TABLA
// -------------------------
function pintarPedidosEnTabla(pedidos) {
  const tbody = document.getElementById("tbody-pedidos");
  tbody.innerHTML = "";

  const ahora = new Date();

  if (!pedidos || pedidos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="py-10 text-center text-sm text-slate-400 bg-slate-50">
          <div class="flex flex-col items-center gap-2">
            <span class="text-2xl">📝</span>
            <p class="font-medium text-slate-600">No hay pedidos cargados todavía</p>
            <p class="text-xs text-slate-400">Cuando registres un pedido aparecerá en esta tabla.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  pedidos.forEach((p, idx) => {
    const tr = document.createElement("tr");

    // Normalizo tipoVenta
    const tipoVentaRaw = (p.tipoVenta || "").trim();
    const tipoVentaLower = tipoVentaRaw.toLowerCase();
    const isPedidosYa = tipoVentaLower.includes("pedidos");
    const isParticular = tipoVentaLower.includes("particular");

    // ---------------------------------------------
    // 1) Highlight por hora (solo particular + pendiente)
    // ---------------------------------------------
    let rowTintBase = "bg-white"; // base de la “card”
    if (
      (p.estadoPedido || "").toUpperCase() === "PENDIENTE" &&
      isParticular &&
      p.horaEntrega
    ) {
      const [hStr, mStr] = String(p.horaEntrega).split(":");
      const horaNum = parseInt(hStr, 10);
      const minNum = parseInt(mStr, 10);

      if (!isNaN(horaNum) && !isNaN(minNum)) {
        const horaEntregaDate = new Date();
        horaEntregaDate.setHours(horaNum, minNum, 0, 0);

        const diffMin = (horaEntregaDate.getTime() - ahora.getTime()) / 60000;

        if (diffMin > 0 && diffMin <= 10) rowTintBase = "bg-amber-50/60";
        else if (diffMin <= 0) rowTintBase = "bg-rose-50/60";
      }
    }

    // ---------------------------------------------
    // 2) Hover por canal (se aplica en TD para que pinte perfecto)
    // ---------------------------------------------
    const hoverTd =
      isPedidosYa ? "group-hover:bg-red-50/80" :
      isParticular ? "group-hover:bg-emerald-50/80" :
      "group-hover:bg-slate-50/70";

    // TD base tipo “card row” (redondeo y bordes por extremos)
    const tdBase = `
       px-3 py-2 ${rowTintBase}
  align-middle
  border-y border-slate-200/70
  ${hoverTd}
  transition-colors
  first:rounded-l-2xl last:rounded-r-2xl
  first:border-l last:border-r
    `;

    // TR flotante + animación (cascada)
    tr.className = `
      group row-float-in pedido-row
    `;
    tr.style.animationDelay = `${Math.min(idx * 45, 260)}ms`;

    // ---------------------------------------------
    // 3) Chips: tipo venta + estado
    // ---------------------------------------------
    const chipTipoVentaClass =
      isParticular
        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
        : "bg-sky-50 text-sky-700 ring-1 ring-sky-100";

    let chipTipoVentaClassFinal =
      "border shadow-sm font-extrabold uppercase tracking-wide ";

    if (isPedidosYa) {
      chipTipoVentaClassFinal += "bg-red-600 text-white border-red-700";
    } else {
      chipTipoVentaClassFinal += `${chipTipoVentaClass} border-slate-200`;
    }

    // Icono SOLO para Particular (PedidosYa va como imagen completa)
    const tipoVentaIconHtml = isParticular
      ? `<span class="text-[12px] leading-none">🙋</span>`
      : "";

    // ✅ Chip final de tipo venta:
    // - PedidosYa: SOLO imagen, sin texto
    // - Particular/otros: chip normal con icono + texto
 const tipoVentaChipHtml = isPedidosYa
      ? `
        <span class="inline-flex h-7 w-[120px] rounded-full overflow-hidden
             bg-white shadow-sm ring-1 ring-black/5 border border-[#EA044E]">
  <img
    src="/icons/PedidosYa_Logo_1.png"
    alt="PedidosYa"
    class="  block h-[20px]  w-[110px] object-contain mx-auto my-1"
  />
</span>

      `
      : `
        <span class="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] ${chipTipoVentaClassFinal}">
          ${tipoVentaIconHtml}
          <span>${tipoVentaRaw || "-"}</span>
        </span>
      `;



    // Estado premium (sin puntito)
    const estadoUpper = (p.estadoPedido || "").toUpperCase();
    let estadoClassFinal = "border shadow-sm font-extrabold uppercase tracking-wide ";

    if (estadoUpper === "PENDIENTE") {
      estadoClassFinal += "bg-amber-50 text-amber-800 border-amber-200 ring-1 ring-amber-100";
    } else if (estadoUpper === "ENTREGADO") {
      estadoClassFinal += "bg-emerald-50 text-emerald-800 border-emerald-200 ring-1 ring-emerald-100";
    } else {
      estadoClassFinal += "bg-rose-50 text-rose-800 border-rose-200 ring-1 ring-rose-100";
    }

    // ---------------------------------------------
    // 4) Campos calculados
    // ---------------------------------------------
    const inicialCliente = p.cliente ? String(p.cliente).charAt(0).toUpperCase() : "?";

    const numeroPedidoHtml = isPedidosYa
      ? `#${p.numeroPedidoPedidosYa ?? ""}`
      : `<span class="text-slate-300">—</span>`;

    const horaEntregaHtml = isParticular
      ? `<span class="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
           ${p.horaEntrega || "-"}
         </span>`
      : `<span class="text-slate-300 text-[12px]">—</span>`;

    const accionesHtml =
      estadoUpper === "PENDIENTE"
        ? `
          <button
            onclick="actualizarEstadoPedido(${p.idPedido}, 'ENTREGADO')"
            class="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-600 text-[13px] font-bold hover:bg-emerald-100 hover:border-emerald-200 transition-colors"
            title="Marcar como entregado">
            ✓
          </button>
          <button
            onclick="actualizarEstadoPedido(${p.idPedido}, 'CANCELADO')"
            class="flex h-7 w-7 items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-rose-600 text-[13px] font-bold hover:bg-rose-100 hover:border-rose-200 transition-colors"
            title="Cancelar pedido">
            ✕
          </button>
        `
        : `<span class="text-[11px] text-slate-300">—</span>`;

    const totalFormateado = Number(p.totalPedido || 0).toLocaleString("es-AR");

    // ---------------------------------------------
    // 5) Render fila
    // ---------------------------------------------
    tr.innerHTML = `
      <td class="${tdBase} font-medium text-slate-800">
        <div class="flex items-center gap-2 min-w-0">
          <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[11px] text-slate-500">
            ${inicialCliente}
          </span>
          <span class="truncate max-w-[160px]" title="${p.cliente || ""}">
            ${p.cliente || "-"}
          </span>
        </div>
      </td>

      <!-- ✅ Tipo venta (usa el chip final) -->
      <td class="${tdBase}">
  <div class="flex items-center justify-start">
    ${tipoVentaChipHtml}
  </div>
</td>

      <td class="${tdBase}">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-full px-3 py-1
                 border border-slate-200 bg-white
                 text-[12px] font-extrabold text-slate-700
                 hover:border-slate-300 hover:shadow-sm transition"
          data-btn-pago
          data-id="${p.idPedido}"
          data-tipo="${p.tipoPago || ''}">
          <span>${p.tipoPago || "Sin pago"}</span>
        </button>
      </td>

      <td class="${tdBase} text-[12px] text-slate-600">
        ${numeroPedidoHtml}
      </td>

      <td class="${tdBase} text-[12px] text-slate-600">
        ${horaEntregaHtml}
      </td>

      <td class="${tdBase}">
        <span class="inline-flex items-center rounded-full px-3 py-1 text-[11px] ${estadoClassFinal}">
          ${p.estadoPedido || "-"}
        </span>
      </td>

      <td class="${tdBase}">
        <button
          onclick="verDetalle(${p.idPedido})"
          class="inline-flex items-center gap-2 rounded-full px-3 py-1
                 border border-slate-200 bg-white
                 text-[11px] font-extrabold text-slate-800
                 hover:border-slate-300 hover:shadow-sm transition-all duration-200">
          Ver detalle
        </button>
      </td>

      <td class="${tdBase} text-right">
        <span class="text-[13px] font-extrabold text-slate-900">
          $${totalFormateado}
        </span>
      </td>

      <td class="${tdBase}">
        <div class="flex items-center justify-center gap-2">
          ${accionesHtml}
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });
}




// -------------------------
//   VER DETALLE + MODAL
// -------------------------
async function verDetalle(idPedido) {
  try {
    const res = await fetch(`${window.API_BASE_URL}/pedido/detalle/${idPedido}`);
    if (!res.ok) throw new Error("Error cargando detalle");

    const detalles = await res.json();

    ultimoDetallePedido = detalles;
    ultimoIdPedido = idPedido;
    ultimoNombreCliente = detalles[0]?.cliente || "";
 

    // Cliente arriba
    const clienteSpan = document.getElementById("detalle-cliente");
    if (clienteSpan) {
      clienteSpan.textContent = ultimoNombreCliente;
    }

    const tbody = document.getElementById("tbody-detalle");
    tbody.innerHTML = "";

    // ❗ Tomamos solo UNA VEZ el subtotal real del pedido
    const totalPedido = Number(detalles[0]?.subtotal || 0);

    // Pintar filas (solo cantidad y variedad, SIN usar subtotal)
    detalles.forEach(d => {
      const fila = `
        <tr>
          <td class="py-1.5">${d.nombreVariedad}</td>
          <td class="py-1.5 text-right">${d.cantidad}</td>
        </tr>
      `;
      tbody.innerHTML += fila;
    });

    // Setear total único
    const totalSpan = document.getElementById("detalle-total");
    if (totalSpan) {
      totalSpan.textContent = `$${totalPedido}`;
    }

    document.getElementById("modal-detalle").classList.remove("hidden");

  } catch (e) {
    console.error(e);
    alert("No se pudo cargar el detalle");
  }
}



// -------------------------
function cerrarModalDetalle() {
  document.getElementById("modal-detalle").classList.add("hidden");
}

// -------------------------
async function actualizarEstadoPedido(id, estado) {
  try {
    const res = await fetch(
      `${window.API_BASE_URL}/pedido/actualizar-estado/${id}/${estado}`,
      {
        method: "PUT"
      }
    );

    if (!res.ok) {
      throw new Error("Error actualizando el estado del pedido");
    }

    const selector = document.getElementById("selector-estado");
    const estadoFiltro = selector ? selector.value : estadoActual;

    const message =
      estado === "ENTREGADO"
        ? "Pedido entregado"
        : estado === "CANCELADO"
        ? "Pedido cancelado"
        : "Estado actualizado";

    // 🔴 cancelado → rojo, ✅ resto → verde
    const isErrorToast = estado === "CANCELADO";
    showToast(message, isErrorToast);

    await cargarPedidosPorEstado(estadoFiltro);

  } catch (e) {
    console.error(e);
    alert("No se pudo actualizar el estado del pedido");
  }
}

// ==============================
//  MODAL: CAMBIAR TIPO DE PAGO
// ==============================
function initModalCambioPago() {
  const modal = document.getElementById("modalPago");
  if (!modal) return; // si el modal no está en esta pantalla, no rompe nada

  const btnCerrar = document.getElementById("btnCerrarPago");
  const btnCancelar = document.getElementById("btnCancelarPago");
  const btnGuardar = document.getElementById("btnGuardarPago");

  const pagoInfo = document.getElementById("pagoInfo");
  const pagoTipo = document.getElementById("pagoTipo");

  const bloqueCombinado = document.getElementById("bloqueCombinado");
  const mEfe = document.getElementById("mEfe");
  const mTra = document.getElementById("mTra");
  const sumaInfo = document.getElementById("sumaInfo");
  const pagoError = document.getElementById("pagoError");

  if (!btnCerrar || !btnCancelar || !btnGuardar || !pagoTipo) return;

  let pedidoSel = { id: null, total: 0, tipo: "", estado: "", cliente: "" };

  const money = (n) => Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const toCents = (n) => Math.round(Number(n || 0) * 100);

  function setError(msg) {
    if (!pagoError) return;
    if (!msg) {
      pagoError.classList.add("hidden");
      pagoError.textContent = "";
      return;
    }
    pagoError.textContent = msg;
    pagoError.classList.remove("hidden");
  }

  function cerrar() {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    setError("");
  }

  function recalcularSuma() {
    if (!sumaInfo) return;

    if (pagoTipo.value !== "COMBINADO") {
      sumaInfo.textContent = "";
      return;
    }

    const ef = Number(mEfe?.value || 0);
    const tr = Number(mTra?.value || 0);
    const sum = ef + tr;

    sumaInfo.textContent = `Total: $${money(pedidoSel.total)} • Suma: $${money(sum)}`;
  }

  function toggleCombinadoUI() {
    if (!bloqueCombinado) return;

    if (pagoTipo.value === "COMBINADO") {
      bloqueCombinado.classList.remove("hidden");
      // valores default si no estaban
      if (mEfe && mTra) {
        if (mEfe.value === "" && mTra.value === "") {
          // por defecto: todo al efectivo
          mEfe.value = Number(pedidoSel.total || 0).toFixed(2);
          mTra.value = "0.00";
        }
      }
      recalcularSuma();
    } else {
      bloqueCombinado.classList.add("hidden");
      if (mEfe) mEfe.value = "";
      if (mTra) mTra.value = "";
      if (sumaInfo) sumaInfo.textContent = "";
      setError("");
    }
  }

  function abrirDesdeBoton(btn) {
    const id = Number(btn.dataset.id || 0);
    const tipo = (btn.dataset.tipo || "").toUpperCase();
    const total = Number(btn.dataset.total || 0);
    const estado = (btn.dataset.estado || "").toUpperCase();
    const cliente = btn.dataset.cliente || "";

    if (!id) return;

    // Regla segura: solo pendientes (así no rompés caja/histórico)
    if (estado && estado !== "PENDIENTE") {
      showToast("Solo podés cambiar el pago si el pedido está PENDIENTE", true);
      return;
    }

    pedidoSel = { id, total, tipo, estado, cliente };

    if (pagoInfo) {
      pagoInfo.textContent = `Pedido #${id}${cliente ? ` • ${cliente}` : ""} • Total $${money(total)}`;
    }

    // set tipo actual si existe
    const tipoOk = ["EFECTIVO", "TRANSFERENCIA", "COMBINADO"].includes(tipo) ? tipo : "EFECTIVO";
    pagoTipo.value = tipoOk;

    // reset inputs combinado según tipo
    if (tipoOk === "EFECTIVO") {
      if (mEfe) mEfe.value = Number(total || 0).toFixed(2);
      if (mTra) mTra.value = "0.00";
    } else if (tipoOk === "TRANSFERENCIA") {
      if (mEfe) mEfe.value = "0.00";
      if (mTra) mTra.value = Number(total || 0).toFixed(2);
    } else {
      // combinado: dejamos editable (si viene vacío, lo default se setea en toggleCombinadoUI)
      if (mEfe && mTra) {
        if (mEfe.value === "" && mTra.value === "") {
          mEfe.value = Number(total || 0).toFixed(2);
          mTra.value = "0.00";
        }
      }
    }

    toggleCombinadoUI();
    setError("");

    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }

  // Delegación: cualquier click en el botón de pago abre el modal
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-btn-pago]");
    if (!btn) return;
    abrirDesdeBoton(btn);
  });

  // Cerrar
  btnCerrar.addEventListener("click", cerrar);
  btnCancelar.addEventListener("click", cerrar);

  // Click afuera
  modal.addEventListener("click", (e) => {
    if (e.target === modal) cerrar();
  });

  // Cambia tipo
  pagoTipo.addEventListener("change", toggleCombinadoUI);

  // Recalcular suma
  if (mEfe) mEfe.addEventListener("input", () => {
    if (pagoTipo.value !== "COMBINADO") return;
    recalcularSuma();
  });
  if (mTra) mTra.addEventListener("input", () => {
    if (pagoTipo.value !== "COMBINADO") return;
    recalcularSuma();
  });

  // Guardar
  btnGuardar.addEventListener("click", async () => {
    try {
      setError("");

      const idPedido = pedidoSel.id;
      const nuevoPago = pagoTipo.value;

      if (!idPedido) return;

      // Validación combinado
      let body = null;

      if (nuevoPago === "COMBINADO") {
        const ef = Number(mEfe?.value || 0);
        const tr = Number(mTra?.value || 0);

        if (ef < 0 || tr < 0) {
          setError("Los montos no pueden ser negativos.");
          return;
        }

        const totalC = toCents(pedidoSel.total);
        const sumaC = toCents(ef) + toCents(tr);

        if (totalC !== sumaC) {
          setError("La suma de Efectivo + Transferencia debe coincidir con el total del pedido.");
          return;
        }

        body = { montoEfectivo: ef, montoTransferencia: tr };
      }

      btnGuardar.disabled = true;
      const txtOriginal = btnGuardar.textContent;
      btnGuardar.textContent = "Guardando...";

      const url = `${window.API_BASE_URL}/pedido/actualizar-pago/${idPedido}/${encodeURIComponent(nuevoPago)}`;

      const opts = { method: "PUT" };
      if (body) {
        opts.headers = { "Content-Type": "application/json" };
        opts.body = JSON.stringify(body);
      }

      const res = await fetch(url, opts);

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || "No se pudo actualizar el pago.");
      }

      showToast("Pago actualizado ✅");
      cerrar();

      // recargar tabla respetando el filtro actual
      const selector = document.getElementById("selector-estado");
      const estadoFiltro = selector ? selector.value : estadoActual;
      await cargarPedidosPorEstado(estadoFiltro);

      btnGuardar.textContent = txtOriginal;
      btnGuardar.disabled = false;

    } catch (err) {
      console.error(err);
      setError(err?.message || "Error actualizando el pago.");
      btnGuardar.disabled = false;
      btnGuardar.textContent = "Guardar";
    }
  });
}

// Llamada segura (si el modal no existe, no hace nada)
document.addEventListener("DOMContentLoaded", initModalCambioPago);


function imprimirTicket() {
  if (!ultimoDetallePedido || ultimoDetallePedido.length === 0) {
    alert("Primero abrí el detalle de un pedido para imprimir la comanda.");
    return;
  }

  const numeroPedido = ultimoIdPedido ?? "";
  const cliente = ultimoNombreCliente || ultimoDetallePedido[0]?.cliente || "";
  const totalPedido = Number(ultimoDetallePedido[0]?.subtotal || 0);

  const tipoVentaRaw = (ultimoDetallePedido[0]?.tipoVenta || "").toString().trim();

  const tipoVentaLabel = /pedidos[\s_]*ya|pya/i.test(tipoVentaRaw)
    ? "PEDIDOSYA"
    : "PARTICULAR";

  const totalPedidoFmt = totalPedido.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const filasHtml = ultimoDetallePedido
    .map(d => `
      <tr>
        <td class="col-var">${d.nombreVariedad}</td>
        <td class="col-cant">${d.cantidad}</td>
      </tr>
    `)
    .join("");

  const w = window.open("", "_blank", "width=400,height=600");

  const PRINTABLE_MM = 52;

  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>Comanda Pedido ${numeroPedido}</title>
      <style>
        @page { size: 58mm auto; margin: 0; }

        body {
          margin: 0;
          padding: 0.2mm;
          width: 58mm;
          font-family: Arial, sans-serif;
          font-size: 11px;
        }

        .ticket { width: ${PRINTABLE_MM}mm; }

        .logo-wrap { text-align: center; margin: 0 0 1.5mm 0; }
        .logo {
          max-width: 40mm;
          max-height: 24mm;
          width: auto;
          height: auto;
          object-fit: contain;
          display: inline-block;
        }

        .titulo { text-align: center; font-weight: 700; margin: 0 0 2mm 0; font-size: 16px; }
        .subtitulo { text-align: center; font-size: 10px; margin: 0 0 2mm 0; }

        .cliente { margin: 0 0 1mm 0; ont-size: 12px; }
        .tipo { margin: 0 0 2mm 0; }

        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        th, td { padding: 1mm 0; vertical-align: top; }
        th { border-bottom: 1px solid #000; text-align: left; }

        .col-var { width: calc(100% - 14mm); word-break: break-word; }
        .col-cant { width: 14mm; text-align: right; white-space: nowrap; }

        tfoot td { border-top: 1px solid #000; font-weight: 700; padding-top: 2mm; }

        /* ✅ leyenda fiscal */
        .nota-wrap { margin-top: 3mm; }
        .nota-sep { border-top: 1px dotted #000000ff margin: 0 0 1.5mm 0; }
        .nota-fiscal {
           text-align: center;
        font-size: 8px;
        font-weight: 700;
        color: #000000ff;
        letter-spacing: 0.2px;
        }
      </style>
    </head>
    <body>
      <div class="ticket">
        <div class="logo-wrap">
          <img class="logo" src="./icons/logo_bien_criollas_transparente_negro_fino.png" alt="Bien Criollas" />
        </div>

        <div class="titulo">Bien Criollas</div>
        <div class="subtitulo">
          Pedido ${numeroPedido}<span class="badge"> - ${tipoVentaLabel}</span>
        </div>

        <p class="cliente"><strong>Cliente:</strong> ${cliente}</p>

        <table>
          <thead>
            <tr>
              <th class="col-var">Variedad</th>
              <th class="col-cant">Cant.</th>
            </tr>
          </thead>
          <tbody>
            ${filasHtml}
          </tbody>
          <tfoot>
            <tr>
              <td class="col-var">Total</td>
              <td class="col-cant">$${totalPedidoFmt}</td>
            </tr>
          </tfoot>
        </table>

        
        <div class="nota-wrap">
          <div class="nota-sep"></div>
          <div class="nota-fiscal">NO VÁLIDO COMO FACTURA</div>
        </div>
      </div>

      <script>
        setTimeout(() => { window.print(); window.close(); }, 200);
      </script>
    </body>
  </html>
  `;

  w.document.open();
  w.document.write(html);
  w.document.close();
}





export function resetFormularioPedido() {
  const inputCliente       = document.querySelector('input[placeholder="Nombre del cliente"]');
  const inputTotal         = document.getElementById('total-pedido') || document.querySelector('input[placeholder="0.00"]');
  const selTipoVenta       = document.getElementById('tipo-venta-nuevo-pedido') || document.getElementById('tipo-venta');
  const selTipoPago        = document.getElementById('tipo-pago');
  const numPedidoPY        = document.getElementById('numero-pedido');
  const horaEntrega        = document.getElementById('hora-entrega');
  const montoEfectivoInput = document.getElementById('monto-efectivo');
  const montoTransfInput   = document.getElementById('monto-transferencia');

  if (inputCliente)       inputCliente.value       = "";
  if (inputTotal)         inputTotal.value         = "";
  if (selTipoVenta)       selTipoVenta.value       = "PARTICULAR";
  if (selTipoPago)        selTipoPago.value        = "EFECTIVO";
  if (numPedidoPY)        numPedidoPY.value        = "";
  if (horaEntrega)        horaEntrega.value        = "";
  if (montoEfectivoInput) montoEfectivoInput.value = "";
  if (montoTransfInput)   montoTransfInput.value   = "";

  for (let i = 1; i <= 12; i++) {
    const input = document.getElementById(`var-${i}`);
    if (input) input.value = "";
  }
}



async function crearPedido() {

  // 1) Datos principales del pedido
  const cliente    = document.querySelector('input[placeholder="Nombre del cliente"]')?.value || "";
  const tipoVenta  = document.querySelector('#tipo-venta-nuevo-pedido')?.value || "PARTICULAR";
  const tipoPago   = document.getElementById("tipo-pago")?.value || "EFECTIVO";
  const numeroPedidoPedidosYa = document.querySelector('#numero-pedido')?.value || null;
  const horaEntrega           = document.querySelector('#hora-entrega')?.value || null;
  const totalInput            = document.getElementById('total-pedido') || document.querySelector('input[placeholder="0.00"]');
  const totalPedido           = Number(totalInput?.value || 0);

  // 2) Variedades (1 al 12)
  const detalles = [];
  for (let i = 1; i <= 12; i++) {
    const input = document.getElementById(`var-${i}`);
    if (!input) continue;
    const cantidad = Number(input.value);
    if (cantidad > 0) {
      detalles.push({
        idVariedad: i,
        cantidad: cantidad
      });
    }
  }

  // 3) Montos de pago (solo se envían para COMBINADO)
  let montoEfectivo = null;
  let montoTransferencia = null;

  if (tipoPago === "COMBINADO") {
    const montoEfectivoInput   = document.getElementById('monto-efectivo');
    const montoTransfInput     = document.getElementById('monto-transferencia');

    montoEfectivo      = montoEfectivoInput ? Number(montoEfectivoInput.value || 0) : 0;
    montoTransferencia = montoTransfInput   ? Number(montoTransfInput.value   || 0) : 0;
  }

  const body = {
    cliente,
    tipoVenta,
    tipoPago,
    numeroPedidoPedidosYa: tipoVenta === "PEDIDOS_YA" ? numeroPedidoPedidosYa : null,
    horaEntrega: tipoVenta === "PARTICULAR" ? horaEntrega : null,
    totalPedido,
    detalles
  };

  if (tipoPago === "COMBINADO") {
    body.montoEfectivo = montoEfectivo;
    body.montoTransferencia = montoTransferencia;
  }

  try {
    const response = await fetch(`${window.API_BASE_URL}/pedido/crear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log("Mensaje error backend:", errorText);
      aplicarSinStockDesdeError(errorText);   // 👈 acá va el bloqueo del campo
      return;
    }

    const data = await response.json();
    console.log("Respuesta backend:", data);

    showToast("Pedido creado correctamente");

    // limpiar formulario
    resetFormularioPedido();

    // volver al inicio después de un pequeño delay
    setTimeout(() => {
      window.location.reload();
    }, 800);

  } catch (e) {
    console.error(e);
    alert("Error al enviar el pedido");
  }
}



function generarPaginacion(data) {
  const cont = document.getElementById("paginacion");
  cont.innerHTML = "";

  // Si solo hay una página → no muestres nada
  if (data.totalPages <= 1) return;

  for (let i = 0; i < data.totalPages; i++) {
    const dot = document.createElement("span");

    dot.className =
      "mx-0.5 w-2.5 h-2.5 rounded-full cursor-pointer " +
      "transition-all duration-150 " +
      (i === data.number
        // 🔴 activo → rojo logo + anillo + sombra + un poquito más grande
        ? "bg-rose-600 ring-2 ring-rose-200 shadow-md scale-110"
        // ⚪ inactivo → gris, pero al hover se tiñe un poco de rojo
        : "bg-slate-300 hover:bg-rose-400 hover:shadow-sm hover:scale-105");

    dot.addEventListener("click", () => {
      cargarPedidosPorEstado(estadoActual, i);
    });

    cont.appendChild(dot);
  }
}


function aplicarSinStockDesdeError(mensaje) {
  // Ejemplo mensaje:
  // "No hay suficiente stock disponible para la variedad con id 8"
  console.log("aplicarSinStockDesdeError -> mensaje:", mensaje);

  const match = mensaje.match(/id\s+(\d+)/i);
  if (!match) {
    console.warn("No se pudo detectar el id de variedad en el mensaje:", mensaje);
    return;
  }

  const idVariedad = Number(match[1]);

  // 👉 buscar el input de esa variedad en el formulario de pedido
  //    según tu propio código: var-1, var-2, ..., var-12
  const input = document.getElementById(`var-${idVariedad}`);
  if (!input) {
    console.warn("No se encontró el input #var-" + idVariedad);
    return;
  }

  // card contenedora (por si está dentro de .card-variedad)
  const card = input.closest(".card-variedad");

  // 🔒 Bloquear campo
  input.value = 0;
  input.disabled = true;

  // Visualmente “apagamos” la card si existe
  if (card) {
    card.classList.add("opacity-60", "cursor-not-allowed");
  }

  // 🔴 Mensajito "Sin stock" en rojo chiquito debajo de la fila de cantidad
  // busco el contenedor donde está "Cantidad" + input
  const filaCantidad = input.closest(".mt-2") || input.parentElement;
  if (!filaCantidad) return;

  let helper = filaCantidad.querySelector(".mensaje-sin-stock");
  if (!helper) {
    helper = document.createElement("p");
    helper.className =
      "mensaje-sin-stock w-full text-right mt-1 text-[11px] text-rose-600";
    helper.textContent = "Sin stock";
    filaCantidad.appendChild(helper);
  }
}


// ==============================
//  PAGO COMBINADO (EFECTIVO + TRANSFERENCIA)
// ==============================
function initPagoCombinado() {
  const tipoPagoSelect     = document.getElementById("tipo-pago");
  const bloqueDetallePago  = document.getElementById("bloque-detalle-pago");
  const totalInput         = document.getElementById("total-pedido") || document.querySelector('input[placeholder="0.00"]');
  const montoEfectivoInput = document.getElementById("monto-efectivo");
  const montoTransfInput   = document.getElementById("monto-transferencia");
  const ayudaDetallePago   = document.getElementById("ayuda-detalle-pago");

  // Si no está el formulario de nuevo pedido, salimos sin romper nada
  if (!tipoPagoSelect || !totalInput) {
    return;
  }

  // Helper para leer número de un input
  function leerNumero(input) {
    if (!input) return 0;
    const val = parseFloat((input.value || "").replace(",", "."));
    return isNaN(val) ? 0 : val;
  }

  function actualizarMensajeAyuda() {
    if (!ayudaDetallePago) return;

    const total  = leerNumero(totalInput);
    const efec   = leerNumero(montoEfectivoInput);
    const transf = leerNumero(montoTransfInput);
    const suma   = efec + transf;

    if (total <= 0) {
      ayudaDetallePago.textContent = "Cargá primero el total del pedido.";
      ayudaDetallePago.classList.remove("text-red-500");
      ayudaDetallePago.classList.add("text-slate-500");
      return;
    }

    if (suma === total) {
      ayudaDetallePago.textContent = "OK, la suma de efectivo + transferencia coincide con el total.";
      ayudaDetallePago.classList.remove("text-red-500");
      ayudaDetallePago.classList.add("text-slate-500");
    } else if (suma < total) {
      ayudaDetallePago.textContent = `Faltan $ ${total - suma} para llegar al total.`;
      ayudaDetallePago.classList.remove("text-slate-500");
      ayudaDetallePago.classList.add("text-red-500");
    } else {
      ayudaDetallePago.textContent = `Te pasaste por $ ${suma - total}. Revisá los montos.`;
      ayudaDetallePago.classList.remove("text-slate-500");
      ayudaDetallePago.classList.add("text-red-500");
    }
  }

  function onCambioTipoPago() {
    const valor = tipoPagoSelect.value;

    if (!bloqueDetallePago) return;

    if (valor === "COMBINADO") {
      bloqueDetallePago.classList.remove("hidden");
    } else {
      bloqueDetallePago.classList.add("hidden");
      if (montoEfectivoInput) montoEfectivoInput.value = "";
      if (montoTransfInput)   montoTransfInput.value   = "";
      if (ayudaDetallePago) {
        ayudaDetallePago.textContent =
          "La suma de efectivo + transferencia debe coincidir con el total del pedido.";
        ayudaDetallePago.classList.remove("text-red-500");
        ayudaDetallePago.classList.add("text-slate-500");
      }
    }
  }

  tipoPagoSelect.addEventListener("change", onCambioTipoPago);

  // Cuando escriben EFECTIVO → calcular TRANSFERENCIA
  if (montoEfectivoInput) {
    montoEfectivoInput.addEventListener("input", () => {
      if (tipoPagoSelect.value !== "COMBINADO") return;

      const total = leerNumero(totalInput);
      if (total <= 0) {
        if (montoTransfInput) montoTransfInput.value = "";
        actualizarMensajeAyuda();
        return;
      }

      let efectivo = leerNumero(montoEfectivoInput);
      if (efectivo < 0) efectivo = 0;
      if (efectivo > total) efectivo = total;

      montoEfectivoInput.value = efectivo;

      if (montoTransfInput) {
        const transferencia = total - efectivo;
        montoTransfInput.value = transferencia.toFixed(2);
      }

      actualizarMensajeAyuda();
    });
  }

  // Cuando escriben TRANSFERENCIA → calcular EFECTIVO
  if (montoTransfInput) {
    montoTransfInput.addEventListener("input", () => {
      if (tipoPagoSelect.value !== "COMBINADO") return;

      const total = leerNumero(totalInput);
      if (total <= 0) {
        if (montoEfectivoInput) montoEfectivoInput.value = "";
        actualizarMensajeAyuda();
        return;
      }

      let transf = leerNumero(montoTransfInput);
      if (transf < 0) transf = 0;
      if (transf > total) transf = total;

      montoTransfInput.value = transf;

      if (montoEfectivoInput) {
        const efectivo = total - transf;
        montoEfectivoInput.value = efectivo.toFixed(2);
      }

      actualizarMensajeAyuda();
    });
  }

  // Si cambia el total, recomputar
  totalInput.addEventListener("input", () => {
    if (tipoPagoSelect.value === "COMBINADO") {
      if (montoEfectivoInput) {
        montoEfectivoInput.dispatchEvent(new Event("input"));
      } else {
        actualizarMensajeAyuda();
      }
    } else {
      actualizarMensajeAyuda();
    }
  });

  // Estado inicial
  onCambioTipoPago();
}


// ==============================
//  INTERACCIÓN DE CARDS + STOCK
// ==============================
document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll("[data-variedad-card]");

  cards.forEach(card => {
    const input = card.querySelector("input[type='number']");
    const btnMenos = card.querySelector("[data-step='-1']");
    const btnMas = card.querySelector("[data-step='1']");

    const actualizarEstadoCard = () => {
      const valor = parseInt(input.value || "0", 10);
      if (valor > 0) {
        card.classList.add("ring-1", "ring-rose-400/70", "bg-white");
      } else {
        card.classList.remove("ring-1", "ring-rose-400/70", "bg-white");
      }
    };

    btnMenos?.addEventListener("click", (e) => {
      e.preventDefault();
      let valor = parseInt(input.value || "0", 10);
      if (isNaN(valor)) valor = 0;
      valor = Math.max(0, valor - 1);
      input.value = valor;
      input.dispatchEvent(new Event("input"));
      actualizarEstadoCard();
    });

    btnMas?.addEventListener("click", (e) => {
      e.preventDefault();
      let valor = parseInt(input.value || "0", 10);
      if (isNaN(valor)) valor = 0;
      valor = valor + 1;
      input.value = valor;
      input.dispatchEvent(new Event("input"));
      actualizarEstadoCard();
    });

    input.addEventListener("input", actualizarEstadoCard);

    // estado inicial
    actualizarEstadoCard();
  });

  // 👇 acá cargamos el stock y pintamos los badges al iniciar
  cargarStockParaPedidos();

  // Inicializar comportamiento de pago combinado (efectivo + transferencia)
  initPagoCombinado();
});


// 🔚 AL FINAL DEL ARCHIVO:
document.addEventListener("DOMContentLoaded", () => {
  const selector = document.getElementById("selector-estado");

  if (selector) {
    estadoActual = selector.value || "PENDIENTE";
    cargarPedidosPorEstado(estadoActual);

    selector.addEventListener("change", () => {
      cargarPedidosPorEstado(selector.value);
    });
  } else {
    cargarPedidosPorEstado("PENDIENTE");
  }
});





// ==============================
//  HACER FUNCIONES GLOBALES
// ==============================
window.verDetalle = verDetalle;
window.actualizarEstadoPedido = actualizarEstadoPedido;
window.cerrarModalDetalle = cerrarModalDetalle;
window.imprimirTicket = imprimirTicket;
window.crearPedido = crearPedido;


