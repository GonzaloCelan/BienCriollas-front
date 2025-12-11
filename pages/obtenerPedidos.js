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

  // 🔹 HORA ACTUAL (una sola vez)
  const ahora = new Date();

  // 🔹 SIN PEDIDOS
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

  pedidos.forEach(p => {
    const tr = document.createElement("tr");

    // 🔸 CÁLCULO DE COLOR POR HORA DE ENTREGA
    let highlightClass = "";

    if (
      p.estadoPedido === "PENDIENTE" &&
      p.tipoVenta === "PARTICULAR" &&
      p.horaEntrega
    ) {
      // Se espera formato "HH:mm"
      const [hStr, mStr] = p.horaEntrega.split(":");
      const horaNum = parseInt(hStr, 10);
      const minNum = parseInt(mStr, 10);

      if (!isNaN(horaNum) && !isNaN(minNum)) {
        const horaEntregaDate = new Date();
        horaEntregaDate.setHours(horaNum, minNum, 0, 0);

        const diffMs = horaEntregaDate.getTime() - ahora.getTime();
        const diffMin = diffMs / 60000; // minutos

        // ⏳ Se acerca (0–20 min) → amarillo suave
        if (diffMin > 0 && diffMin <= 10) {
          highlightClass = "bg-amber-50";
        }
        // ⌛ Ya se pasó y sigue pendiente → rojo suave
        else if (diffMin <= 0) {
          highlightClass = "bg-rose-50";
        }
      }
    }

    // Estilos base de la fila + highlight al final (pisa el zebra)
    tr.className = `
      group
      text-[13px] text-slate-700
      border-b border-slate-100 last:border-b-0
      odd:bg-white even:bg-slate-50/40
      hover:bg-slate-50/90
      transition-colors
      ${highlightClass}
    `;

    // Chip tipo de venta
    const chipTipoVentaClass =
      p.tipoVenta === "PARTICULAR"
        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
        : "bg-sky-50 text-sky-700 ring-1 ring-sky-100";

    // Chip estado
    let estadoClass = "";
    switch (p.estadoPedido) {
      case "PENDIENTE":
        estadoClass = "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
        break;
      case "ENTREGADO":
        estadoClass = "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
        break;
      default:
        estadoClass = "bg-rose-50 text-rose-700 ring-1 ring-rose-100";
        break;
    }

    const inicialCliente = p.cliente ? p.cliente.charAt(0).toUpperCase() : "?";

    const numeroPedidoHtml =
      p.tipoVenta === "PEDIDOS_YA"
        ? `#${p.numeroPedidoPedidosYa}`
        : `<span class="text-slate-300">—</span>`;

    const horaEntregaHtml =
      p.tipoVenta === "PARTICULAR"
        ? `<span class="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
             ${p.horaEntrega || "-"}
           </span>`
        : `<span class="text-slate-300 text-[12px]">—</span>`;

    const accionesHtml =
      p.estadoPedido === "PENDIENTE"
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

    tr.innerHTML = `
      <!-- Cliente -->
      <td class="px-3 py-3 font-medium text-slate-800">
        <div class="flex items-center gap-2">
          <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[11px] text-slate-500">
            ${inicialCliente}
          </span>
          <span class="truncate max-w-[160px]" title="${p.cliente || ""}">
            ${p.cliente || "-"}
          </span>
        </div>
      </td>

      <!-- Tipo de venta -->
      <td class="px-3 py-3">
        <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${chipTipoVentaClass}">
          <span class="h-1.5 w-1.5 rounded-full bg-current opacity-80"></span>
          ${p.tipoVenta}
        </span>
      </td>

      <!-- Tipo de pago -->
      <td class="px-3 py-3 text-[12px] text-slate-600">
        ${p.tipoPago || "-"}
      </td>

      <!-- Nº Pedido (PedidosYa) -->
      <td class="px-3 py-3 text-[12px] text-slate-600">
        ${numeroPedidoHtml}
      </td>

      <!-- Hora entrega -->
      <td class="px-3 py-3 text-[12px] text-slate-600">
        ${horaEntregaHtml}
      </td>

      <!-- Estado -->
      <td class="px-3 py-3">
        <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${estadoClass}">
          <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
          ${p.estadoPedido}
        </span>
      </td>

      <!-- Ver detalle -->
      <td class="px-3 py-3">
        <button
          onclick="verDetalle(${p.idPedido})"
          class="text-[11px] font-medium text-sky-600 hover:text-sky-700 hover:underline decoration-sky-400">
          Ver detalle
        </button>
      </td>

      <!-- Total -->
      <td class="px-3 py-3 text-right">
        <span class="text-[13px] font-semibold text-slate-900">
          $${totalFormateado}
        </span>
      </td>

      <!-- Acciones -->
      <td class="px-3 py-3">
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




function imprimirTicket() {
  // Si no hay detalle cargado, avisamos
  if (!ultimoDetallePedido || ultimoDetallePedido.length === 0) {
    alert("Primero abrí el detalle de un pedido para imprimir la comanda.");
    return;
  }

  // Datos principales
  const numeroPedido = ultimoIdPedido ?? "";
  const cliente = ultimoNombreCliente || ultimoDetallePedido[0]?.cliente || "";
  const totalPedido = Number(ultimoDetallePedido[0]?.subtotal || 0);

  // Filas de variedades + cantidad
  const filasHtml = ultimoDetallePedido
    .map(d => `
      <tr>
        <td>${d.nombreVariedad}</td>
        <td style="text-align:right;">${d.cantidad}</td>
      </tr>
    `)
    .join("");

  // Abrimos ventanita con el ticket
  const w = window.open("", "_blank", "width=400,height=600");

  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>Comanda Pedido ${numeroPedido}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 12px;
          margin: 0;
          padding: 8px;
        }
        .ticket { width: 260px; }
        .titulo { text-align: center; font-weight: 700; margin-bottom: 4px; }
        .subtitulo { text-align: center; font-size: 11px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 2px 0; }
        th { border-bottom: 1px solid #000; text-align: left; }
        tfoot td { border-top: 1px solid #000; font-weight: 700; padding-top: 4px; }
      </style>
    </head>
    <body onload="window.print(); window.close();">
      <div class="ticket">
        <div class="titulo">Bien Criollas</div>
        <div class="subtitulo">Comanda Pedido ${numeroPedido}</div>

        <p><strong>Cliente:</strong> ${cliente}</p>

        <table>
          <thead>
            <tr>
              <th>Variedad</th>
              <th style="text-align:right;">Cant.</th>
            </tr>
          </thead>
          <tbody>
            ${filasHtml}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td style="text-align:right;">$${totalPedido}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </body>
  </html>
  `;

  w.document.open();
  w.document.write(html);
  w.document.close();
}


export function resetFormularioPedido() {
  const inputCliente = document.querySelector('input[placeholder="Nombre del cliente"]');
  const inputTotal   = document.querySelector('input[placeholder="0.00"]');
  const selTipoVenta = document.getElementById('tipo-venta');
  const selTipoPago  = document.getElementById('tipo-pago');
  const numPedidoPY  = document.getElementById('numero-pedido');
  const horaEntrega  = document.getElementById('hora-entrega');

  if (inputCliente) inputCliente.value = "";
  if (inputTotal)   inputTotal.value   = "";
  if (selTipoVenta) selTipoVenta.value = "PARTICULAR";
  if (selTipoPago)  selTipoPago.value  = "EFECTIVO";
  if (numPedidoPY)  numPedidoPY.value  = "";
  if (horaEntrega)  horaEntrega.value = "";

  for (let i = 1; i <= 12; i++) {
    const input = document.getElementById(`var-${i}`);
    if (input) input.value = "";
  }
}



async function crearPedido() {

  // 1) Datos principales del pedido
  const cliente = document.querySelector('input[placeholder="Nombre del cliente"]').value;
  const tipoVenta = document.querySelector('#tipo-venta-nuevo-pedido').value;
  const tipoPago = document.getElementById("tipo-pago").value;
  const numeroPedidoPedidosYa = document.querySelector('#numero-pedido').value || null;
  const horaEntrega = document.querySelector('#hora-entrega').value || null;
  const totalPedido = Number(document.querySelector('input[placeholder="0.00"]').value);

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

  const body = {
    cliente,
    tipoVenta,
    tipoPago,
    numeroPedidoPedidosYa: tipoVenta === "PEDIDOS_YA" ? numeroPedidoPedidosYa : null,
    horaEntrega: tipoVenta === "PARTICULAR" ? horaEntrega : null,
    totalPedido,
    detalles
  };

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
