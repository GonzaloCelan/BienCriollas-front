// 📊 ESTADÍSTICAS

// Registrar plugin de datalabels si está disponible
if (typeof ChartDataLabels !== "undefined" && typeof Chart !== "undefined") {
  Chart.register(ChartDataLabels);
}

let graficoVariedades = null;
let graficoIngresos = null;
let graficoMermas = null;

// 📊 ESTADÍSTICAS
// (IMPORTANTE: asegurate que esta línea tenga // y no un / suelto)

// ✅ NUEVO: tabla pedidos (DISEÑO GLASS + ORDEN + ESTADO FIJO)
const PEDIDOS_TABLE = {
  tbodyId: "tabla-pedidos-estadisticas",
  countId: "pedidos-count",
  page: 0,
  size: 200,
};

function escHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtMoneyAR(n) {
  const num = Number(n) || 0;
  return "$" + num.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function normalizarTipoVenta(tv) {
  const t = String(tv ?? "").trim().toUpperCase();
  if (/PEDIDOS[\s_]*YA|PEDIDOS_YA|PYA/.test(t)) return "PEDIDOSYA";
  if (t === "PARTICULAR") return "PARTICULAR";
  return t || "—";
}

function normalizarPago(tp) {
  return String(tp ?? "").trim().toUpperCase() || "—";
}

function setPedidosCount(n) {
  const el = document.getElementById(PEDIDOS_TABLE.countId);
  if (el) el.textContent = String(Number(n) || 0);
}

/** ✅ Pill premium (con "tema" opcional) */
function pill(label, theme = "") {
  const base =
    "inline-flex items-center gap-2 rounded-full px-2.5 py-[3px] " +
    "text-[10px] font-black tracking-wide " +
    "border ring-1 backdrop-blur";

  const def =
    "bg-slate-900/5 border-slate-200/80 ring-slate-900/5 text-slate-700";

  return `
    <span class="${base} ${theme || def}">
      ${escHtml(label)}
    </span>
  `;
}

function badgeVenta(tipoVenta) {
  const v = String(tipoVenta ?? "").toUpperCase();

  // ✅ PEDIDOSYA: pill roja + letra roja
  if (v === "PEDIDOSYA") {
    return pill(
      "PEDIDOSYA",
      "bg-red-50 text-red-700 border-red-200/80 ring-red-600/10"
    );
  }

  // ✅ PARTICULAR: normal (default)
  if (v === "PARTICULAR") return pill("PARTICULAR");

  // Otros: neutra
  return pill(v || "—", "bg-slate-50 text-slate-700 border-slate-200/80 ring-slate-900/5");
}

function badgePago(tipoPago) {
  const p = String(tipoPago ?? "").toUpperCase();

  // ✅ Libres y bien diferenciadas
  if (p.includes("EFECTIVO")) {
    return pill("EFECTIVO", "bg-emerald-50 text-emerald-700 border-emerald-200/80 ring-emerald-600/10");
  }

  if (p.includes("TRANSFER")) {
    return pill("TRANSFERENCIA", "bg-indigo-50 text-indigo-700 border-indigo-200/80 ring-indigo-600/10");
  }

  if (p.includes("MP") || p.includes("MERCADO")) {
    return pill("MERCADO PAGO", "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/80 ring-fuchsia-600/10");
  }

  if (p.includes("DEBIT") || p.includes("DÉBIT")) {
    return pill("DÉBITO", "bg-sky-50 text-sky-700 border-sky-200/80 ring-sky-600/10");
  }

  if (p.includes("CRED") || p.includes("CRÉD")) {
    return pill("CRÉDITO", "bg-amber-50 text-amber-700 border-amber-200/80 ring-amber-600/10");
  }

  return pill(p || "—", "bg-slate-50 text-slate-700 border-slate-200/80 ring-slate-900/5");
}

function badgeEstado(estado) {
  const eRaw = String(estado ?? "").trim().toUpperCase();

  // ✅ ENTREGADO: pill toda verde + letra verde
  if (/ENTREG/.test(eRaw)) {
    return pill(
      "ENTREGADO",
      "bg-emerald-50 text-emerald-700 border-emerald-200/80 ring-emerald-600/10"
    );
  }

  if (/CANCEL/.test(eRaw)) {
    return pill("CANCELADO", "bg-rose-50 text-rose-700 border-rose-200/80 ring-rose-600/10");
  }

  if (/PREPAR/.test(eRaw)) {
    return pill("EN PREPARACIÓN", "bg-amber-50 text-amber-700 border-amber-200/80 ring-amber-600/10");
  }

  if (/PEND/.test(eRaw)) {
    return pill("PENDIENTE", "bg-sky-50 text-sky-700 border-sky-200/80 ring-sky-600/10");
  }

  return pill(eRaw.replaceAll("_", " ") || "—", "bg-slate-50 text-slate-700 border-slate-200/80 ring-slate-900/5");
}


// ✅ ORDEN: particulares primero, particulares A→Z, luego pedidosya
function ordenarPedidosParaTabla(items) {
  const arr = Array.isArray(items) ? [...items] : [];

  const esParticular = (p) => String(p?.tipoVenta ?? "").toUpperCase() === "PARTICULAR";
  const esPedidosYa = (p) => /PEDIDOS[\s_]*YA|PEDIDOS_YA|PYA/.test(String(p?.tipoVenta ?? "").toUpperCase());

  const nombreCliente = (p) => String(p?.cliente ?? "").trim().toLocaleUpperCase("es-AR");

  arr.sort((a, b) => {
    const ga = esParticular(a) ? 0 : esPedidosYa(a) ? 1 : 2;
    const gb = esParticular(b) ? 0 : esPedidosYa(b) ? 1 : 2;
    if (ga !== gb) return ga - gb;

    if (ga === 0 && gb === 0) {
      return nombreCliente(a).localeCompare(nombreCliente(b), "es", { sensitivity: "base" });
    }
    return 0;
  });

  return arr;
}

function renderizarTablaPedidos(items) {
  const tbody = document.getElementById(PEDIDOS_TABLE.tbodyId);
  if (!tbody) return;

  const arr = ordenarPedidosParaTabla(items);
  setPedidosCount(arr.length);

  if (arr.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-5 py-7 text-center text-[12px] text-slate-500">
          No hay pedidos para mostrar.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = arr
    .map((p, i) => {
      const cliente = String(p?.cliente ?? "").trim().toLocaleUpperCase("es-AR");
      const tipoVenta = normalizarTipoVenta(p?.tipoVenta);
      const tipoPago = normalizarPago(p?.tipoPago);
      const estado = String(p?.estadoPedido ?? "").trim().toUpperCase() || "—";

      const esPya = tipoVenta === "PEDIDOSYA";
      const numPya = esPya ? String(p?.numeroPedidoPedidosYa ?? "").trim() : "";
      const numPyaShow = numPya ? escHtml(numPya) : "—";

      const total = fmtMoneyAR(p?.totalPedido);

      // ✅ Zebra: rojo clarito / blanco (sin bordes)
      const zebraClass = i % 2 === 0 ? "bg-red-100/70" : "bg-white";

      return `
      <tr class="group ${zebraClass} transition-colors duration-150 hover:bg-red-100/70">
        <td class="px-5 py-1.5 relative">
          <span class="absolute left-0 top-2 bottom-2 w-[2px] rounded-full
                       bg-rose-500/0 group-hover:bg-rose-500/70"></span>

          <div class="font-black text-[12px] text-slate-900 truncate max-w-[260px] group-hover:text-slate-950">
            ${escHtml(cliente || "—")}
          </div>
        </td>

        <td class="px-5 py-1.5">${badgeVenta(tipoVenta)}</td>
        <td class="px-5 py-1.5">${badgePago(tipoPago)}</td>

        <td class="px-5 py-1.5">
          <span class="text-[12px] font-extrabold text-slate-600 tabular-nums">
            ${numPyaShow}
          </span>
        </td>

        <td class="px-5 py-1.5 text-right">
          <span class="text-[12px] font-black text-slate-900 tabular-nums group-hover:text-slate-950">
            ${escHtml(total)}
          </span>
        </td>

        <td class="px-5 py-1.5 text-center">
          ${badgeEstado(estado)}
        </td>
      </tr>
    `;
    })
    .join("");
}



function limpiarTablaPedidos(mensaje) {
  const tbody = document.getElementById(PEDIDOS_TABLE.tbodyId);
  if (!tbody) return;

  setPedidosCount(0);
  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="px-5 py-7 text-center text-[12px] text-slate-500">
        ${escHtml(mensaje || "No hay datos para mostrar.")}
      </td>
    </tr>
  `;
}

async function cargarPedidosDelDia(fecha) {
  const tbody = document.getElementById(PEDIDOS_TABLE.tbodyId);
  if (!tbody) return;

  try {
    const estado = "ENTREGADO"; // ✅ fijo

    const params = new URLSearchParams();
    params.set("estado", estado);
    params.set("fecha", fecha);
    params.set("page", String(PEDIDOS_TABLE.page));
    params.set("size", String(PEDIDOS_TABLE.size));

    const url = `${window.API_BASE_URL}/estadistica/pedidos?${params.toString()}`;
    console.log("📦 URL pedidos:", url);

    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} - ${body}`);
    }

    const data = await res.json();
    const content = Array.isArray(data?.content) ? data.content : [];
    renderizarTablaPedidos(content);
  } catch (e) {
    console.error("❌ Error cargando pedidos del día:", e);
    limpiarTablaPedidos("No se pudieron cargar los pedidos para esa fecha.");
  }
}



// 👉 se llama desde sidebar.js cuando entras a la sección
export function initEstadisticas() {
  const inputFecha = document.getElementById("estadistica-fecha");
  const btnFecha = document.getElementById("btn-estadistica-fecha");

  const inputMes = document.getElementById("estadistica-mes");
  const btnMes = document.getElementById("btn-estadistica-mes");

  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, "0");
  const dd = String(hoy.getDate()).padStart(2, "0");

  const hoyISO = `${yyyy}-${mm}-${dd}`; // YYYY-MM-DD local
  const mesActual = `${yyyy}-${mm}`; // YYYY-MM local

  // setear fecha de hoy por defecto
  if (inputFecha) inputFecha.value = hoyISO;

  // setear mes actual por defecto
  if (inputMes) inputMes.value = mesActual;

  // ✅ cargar estadísticas + tabla pedidos de HOY por defecto
  cargarEstadisticaDelDia(hoyISO);

  // cuando haga click en "Ver día", cargar la fecha elegida (stats + tabla)
  if (btnFecha && inputFecha) {
    btnFecha.addEventListener("click", () => {
      const fecha = inputFecha.value;
      if (fecha) cargarEstadisticaDelDia(fecha);
    });
  }

  // cuando haga click en "Ver mes", cargar el mes elegido
  if (btnMes && inputMes) {
    btnMes.addEventListener("click", () => {
      const periodo = inputMes.value; // "2025-12"
      if (periodo) cargarEstadisticaDelMes(periodo);
    });
  }
}

// 👉 trae estadísticas para una fecha concreta (DÍA)
// ✅ ahora también trae y pinta la TABLA de pedidos para esa fecha
export async function cargarEstadisticaDelDia(fecha) {
  // ✅ en paralelo: stats + pedidos
  const urlStats = `${window.API_BASE_URL}/estadistica/${fecha}`;

  try {
    const [statsResult] = await Promise.allSettled([
      (async () => {
        const res = await fetch(urlStats);
        if (!res.ok) throw new Error("Error consultando estadísticas");
        return res.json();
      })(),
      // pedidos no bloquea si stats falla
      cargarPedidosDelDia(fecha),
    ]);

    if (statsResult.status !== "fulfilled") {
      throw statsResult.reason;
    }

    const data = statsResult.value;
    console.log("📅 Estadísticas del día:", fecha, data);

    actualizarKpis(data, "dia");
    actualizarTituloModo("dia", fecha);
    renderizarGraficoVariedades(data.empanadasMasVendidas || []);
    renderizarGraficoIngresos(Number(data.totalEfectivo || 0), Number(data.totalTransferencia || 0));
    renderizarGraficosPedidos(Number(data.cantidadPedidosPY || 0), Number(data.cantidadParticular || 0));
    renderizarGraficoMermas(data.empanadasPerdidas || []);
  } catch (e) {
    console.error("❌ Error cargando estadísticas del día:", e);
    alert("No se pudieron cargar las estadísticas del día");
    // igual intentamos que la tabla quede coherente
    await cargarPedidosDelDia(fecha);
  }
}

// 👉 trae estadísticas para un mes (YYYY-MM)
export async function cargarEstadisticaDelMes(periodoYYYYMM) {
  try {
    const [anio, mes] = periodoYYYYMM.split("-"); // "2025-12" → ["2025","12"]

    const res = await fetch(`${window.API_BASE_URL}/estadistica/mes/${anio}/${mes}`);

    if (!res.ok) {
      throw new Error("Error consultando estadísticas del mes");
    }

    const data = await res.json();
    console.log("📆 Estadísticas del mes:", periodoYYYYMM, data);

    // Mismo flujo que el día, pero con datos del mes completo
    actualizarKpis(data, "mes");
    actualizarTituloModo("mes", periodoYYYYMM);
    renderizarGraficoVariedades(data.empanadasMasVendidas || []);
    renderizarGraficoIngresos(Number(data.totalEfectivo || 0), Number(data.totalTransferencia || 0));
    renderizarGraficosPedidos(Number(data.cantidadPedidosPY || 0), Number(data.cantidadParticular || 0));
    renderizarGraficoMermas(data.empanadasPerdidas || []);

    // ✅ tabla pedidos: como el endpoint que pasaste filtra por FECHA (día),
    // en modo mes dejamos un mensaje para no inventar datos.
    limpiarTablaPedidos("Estás viendo estadísticas del mes. Para ver pedidos, elegí un día.");
  } catch (e) {
    console.error("❌ Error cargando estadísticas del mes:", e);
    alert("No se pudieron cargar las estadísticas del mes");
    limpiarTablaPedidos("No se pudieron cargar los pedidos (modo mes).");
  }
}

// 🔹 Actualiza los KPI
function actualizarKpis(est, tipo = "dia") {
  const totalEmp = est.totalEmpanadasVendidas ?? 0;
  const totalPedidos = est.totalPedidos ?? 0;
  const totalIngresos = Number(est.totalIngresos || 0);
  const totalMermasImporte = Number(est.totalMermasImporte || 0);
  const totalPedidosYa = Number(est.totalPedidosYa || 0);

  document.getElementById("kpi-empanadas").textContent = totalEmp;
  document.getElementById("kpi-pedidos").textContent = totalPedidos;

  document.getElementById("kpi-facturacion").textContent =
    "$" +
    totalIngresos.toLocaleString("es-AR", {
      minimumFractionDigits: 0,
    });

  document.getElementById("kpi-pedidosya").textContent =
    "$" +
    totalPedidosYa.toLocaleString("es-AR", {
      minimumFractionDigits: 0,
    });

  // 💰 Calcular y mostrar el neto estimado (descontando el 31% de comisión)
  const totalPedidosYaNeto = totalPedidosYa * (1 - 0.31);
  document.getElementById("kpi-pedidosya-neto").textContent =
    "≈ Neto estimado (31%): $" +
    totalPedidosYaNeto.toLocaleString("es-AR", {
      minimumFractionDigits: 0,
    });

  // 💰 KPI de plata perdida por mermas
  const kpiMermasDinero = document.getElementById("kpi-mermas-dinero");
  if (kpiMermasDinero) {
    kpiMermasDinero.textContent =
      "$" +
      totalMermasImporte.toLocaleString("es-AR", {
        minimumFractionDigits: 0,
      });
  }

  const labelPedidos = document.getElementById("kpi-label-pedidos");
  const labelIngresos = document.getElementById("kpi-label-ingresos");
  const labelMermasDinero = document.getElementById("kpi-label-mermas-dinero");
  const labelIngresosPedidosya = document.getElementById("kpi-label-pedidosya");

  if (tipo === "mes") {
    if (labelPedidos) labelPedidos.textContent = "Pedidos del mes";
    if (labelIngresos) labelIngresos.textContent = "Ingresos particular (mensual)";
    if (labelIngresosPedidosya) labelIngresosPedidosya.textContent = "Pedidos Ya (sin liquidar mensual)";
    if (labelMermasDinero) labelMermasDinero.textContent = "Pérdida por mermas (mensual)";
  } else {
    if (labelPedidos) labelPedidos.textContent = "Pedidos del día";
    if (labelIngresos) labelIngresos.textContent = "Ingresos particular (diario)";
    if (labelIngresosPedidosya) labelIngresosPedidosya.textContent = "Pedidos Ya (sin liquidar diario)";
    if (labelMermasDinero) labelMermasDinero.textContent = "Pérdida por mermas (diaria)";
  }
}

// 🔹 Ranking horizontal tipo “Spotify” (Bien Criollas rojo) — número FUERA de la barra
function renderizarGraficoVariedades(lista) {
  const canvas = document.getElementById("graficoVariedades");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const datos = Array.isArray(lista) ? lista : [];

  const parseCant = (v) => {
    if (typeof v === "number") return v;
    if (typeof v !== "string") return 0;

    const s = v.trim().replace(/\s/g, "");
    if (/[.,]\d{1,2}$/.test(s)) {
      const normalized = s.replace(/\./g, "").replace(",", ".");
      const n = Number(normalized);
      return Number.isFinite(n) ? n : 0;
    }
    const normalized = s.replace(/[^\d-]/g, "");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  };

  const ordenado = [...datos].sort((a, b) => parseCant(b.cantidad) - parseCant(a.cantidad));
  const labels = ordenado.map((e) => String(e.nombre ?? ""));
  const valores = ordenado.map((e) => parseCant(e.cantidad));

  if (graficoVariedades) {
    graficoVariedades.destroy();
    graficoVariedades = null;
  }

  const maxVal = Math.max(1, ...valores);
  const xMax = maxVal * 1.25;
  const fmt = new Intl.NumberFormat("es-AR");

  const bgColors = valores.map((_, i) => (i === 0 ? "rgba(239,68,68,0.95)" : "rgba(239,68,68,0.55)"));

  const major = parseInt(String(Chart?.version || "4").split(".")[0], 10);
  const isV2 = major < 3;

  const dataset = {
    label: "Empanadas vendidas",
    data: valores,
    borderRadius: 999,
    borderSkipped: false,
    barThickness: 14,
    maxBarThickness: 18,
    backgroundColor: bgColors,
    borderWidth: 0,
    hoverBackgroundColor: valores.map((_, i) => (i === 0 ? "rgba(239,68,68,1)" : "rgba(239,68,68,0.70)")),
  };

  if (!isV2) {
    graficoVariedades = new Chart(ctx, {
      type: "bar",
      data: { labels, datasets: [dataset] },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 8, right: 44, bottom: 8, left: 8 } },
        interaction: { mode: "index", intersect: false },

        scales: {
          x: {
            display: false,
            beginAtZero: true,
            suggestedMax: xMax,
            grid: { display: false },
            border: { display: false },
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              autoSkip: false,
              color: "rgba(71,85,105,0.95)",
              font: { size: 12, weight: "800" },
              padding: 10,
              callback: function (val) {
                const t = this.getLabelForValue(val);
                return t.length > 16 ? t.slice(0, 16) + "…" : t;
              },
            },
          },
        },

        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(255,255,255,0.92)",
            titleColor: "rgba(15,23,42,0.90)",
            bodyColor: "rgba(15,23,42,0.75)",
            borderColor: "rgba(226,232,240,1)",
            borderWidth: 1,
            cornerRadius: 12,
            padding: 10,
            displayColors: false,
            callbacks: {
              title: (items) => items?.[0]?.label ?? "",
              label: (item) => `${fmt.format(item.parsed.x)} empanadas`,
            },
          },
          datalabels: {
            display: true,
            color: "rgba(71,85,105,0.90)",
            font: { size: 11, weight: "800" },
            anchor: "end",
            align: "right",
            offset: 8,
            clip: false,
            clamp: true,
            formatter: (v) => fmt.format(v),
          },
        },

        animation: { duration: 650 },
        onHover: (evt, elements) => {
          if (evt?.native?.target) evt.native.target.style.cursor = elements?.length ? "pointer" : "default";
        },
      },
    });
    return;
  }

  graficoVariedades = new Chart(ctx, {
    type: "horizontalBar",
    data: { labels, datasets: [dataset] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 8, right: 44, bottom: 8, left: 8 } },

      scales: {
        xAxes: [
          {
            display: false,
            ticks: { beginAtZero: true, max: xMax },
            gridLines: { display: false, drawBorder: false },
          },
        ],
        yAxes: [
          {
            gridLines: { display: false, drawBorder: false },
            ticks: {
              autoSkip: false,
              fontSize: 12,
              fontStyle: "bold",
              fontColor: "rgba(71,85,105,0.95)",
              callback: (t) => (t.length > 16 ? t.slice(0, 16) + "…" : t),
            },
          },
        ],
      },

      legend: { display: false },
      tooltips: {
        backgroundColor: "rgba(255,255,255,0.92)",
        titleFontColor: "rgba(15,23,42,0.90)",
        bodyFontColor: "rgba(15,23,42,0.75)",
        borderColor: "rgba(226,232,240,1)",
        borderWidth: 1,
        cornerRadius: 12,
        displayColors: false,
        callbacks: { label: (item) => `${fmt.format(item.xLabel)} empanadas` },
      },

      plugins: {
        datalabels: {
          display: true,
          color: "rgba(71,85,105,0.90)",
          font: { size: 11, weight: "bold" },
          anchor: "end",
          align: "right",
          offset: 8,
          clip: false,
          clamp: true,
          formatter: (v) => fmt.format(v),
        },
      },
    },
  });
}

function renderizarGraficoIngresos(totalEfectivo, totalTransferencia) {
  const canvas = document.getElementById("graficoIngresosMedios");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  if (graficoIngresos) {
    graficoIngresos.destroy();
    graficoIngresos = null;
  }

  const ef = Number(totalEfectivo) || 0;
  const tr = Number(totalTransferencia) || 0;
  const total = ef + tr;

  const fmtMoney = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
  const fmtPct = (n) => `${Math.round(n)}%`;

  const EPS = 0.0001;
  const dataReal = [ef, tr];
  const dataDraw = dataReal.map((v) => (total > 0 && v === 0 ? EPS : v));

  const ringTrack = {
    id: "ringTrack",
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      const meta = chart.getDatasetMeta(0);
      if (!meta?.data?.[0]) return;

      const cx = (chartArea.left + chartArea.right) / 2;
      const cy = (chartArea.top + chartArea.bottom) / 2;

      const outer = meta.data[0].outerRadius;
      const inner = meta.data[0].innerRadius;
      const r = (outer + inner) / 2;

      ctx.save();
      ctx.lineWidth = outer - inner;
      ctx.strokeStyle = "rgba(239,68,68,0.12)";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },
  };

  const centerText = {
    id: "centerText",
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      const cx = (chartArea.left + chartArea.right) / 2;
      const cy = (chartArea.top + chartArea.bottom) / 2;

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillStyle = "rgba(15,23,42,0.55)";
      ctx.font = "800 11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText("TOTAL", cx, cy - 14);

      ctx.fillStyle = "rgba(15,23,42,0.92)";
      ctx.font = "900 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(fmtMoney.format(total), cx, cy + 2);

      ctx.fillStyle = "rgba(15,23,42,0.55)";
      ctx.font = "700 10px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText("Efectivo vs Transfer", cx, cy + 18);

      ctx.restore();
    },
  };

  graficoIngresos = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Efectivo", "Transferencia"],
      datasets: [
        {
          data: dataDraw,
          backgroundColor: ["rgba(239,68,68,0.35)", "rgba(239,68,68,0.95)"],
          borderColor: ["rgba(255,255,255,0.60)", "rgba(255,255,255,0.30)"],
          borderWidth: 2,
          borderRadius: 10,
          spacing: 3,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      rotation: -90,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(255,255,255,0.92)",
          titleColor: "rgba(15,23,42,0.90)",
          bodyColor: "rgba(15,23,42,0.75)",
          borderColor: "rgba(226,232,240,1)",
          borderWidth: 1,
          cornerRadius: 12,
          padding: 10,
          displayColors: false,
          callbacks: {
            title: (items) => items?.[0]?.label ?? "",
            label: (t) => {
              const i = t.dataIndex;
              const raw = dataReal[i] ?? 0;
              const pct = total ? (raw * 100) / total : 0;
              return `${fmtMoney.format(raw)} (${fmtPct(pct)})`;
            },
          },
        },
        datalabels: {
          display: true,
          color: "rgba(71,85,105,0.90)",
          font: { size: 11, weight: "900" },
          anchor: "end",
          align: "end",
          offset: 6,
          clamp: true,
          clip: false,
          formatter: (value, context) => {
            const i = context.dataIndex;
            const raw = dataReal[i] ?? 0;
            const pct = total ? (raw * 100) / total : 0;
            return fmtPct(pct);
          },
        },
      },
    },
    plugins: [ringTrack, centerText],
  });
}

function renderizarGraficoMermas(listaMermas) {
  const canvas = document.getElementById("graficoMermasVariedad");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const datos = Array.isArray(listaMermas) ? listaMermas : [];

  const items = datos
    .map((m) => ({
      nombre: m.nombre ?? "Sin nombre",
      cantidad: Number(m.cantidad) || 0,
      monto: Number(m.montoPerdido || 0),
    }))
    .sort((a, b) => b.cantidad - a.cantidad);

  const TOP_N = 8;
  const top = items.slice(0, TOP_N);
  const resto = items.slice(TOP_N);

  const otrosCant = resto.reduce((acc, it) => acc + it.cantidad, 0);
  const otrosMonto = resto.reduce((acc, it) => acc + it.monto, 0);

  const final = [...top];
  if (otrosCant > 0) final.push({ nombre: "Otros", cantidad: otrosCant, monto: otrosMonto });

  const labels = final.map((x) => x.nombre);
  const valores = final.map((x) => x.cantidad);
  const montos = final.map((x) => x.monto);

  if (graficoMermas) {
    graficoMermas.destroy();
    graficoMermas = null;
  }

  const maxVal = Math.max(0, ...valores);
  const idxMax = maxVal > 0 ? valores.indexOf(maxVal) : -1;

  const bgColors = valores.map((_, i) => (i === idxMax ? "rgba(239,68,68,0.95)" : "rgba(239,68,68,0.35)"));

  graficoMermas = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Mermas (empanadas)",
          data: valores,
          backgroundColor: bgColors,
          borderWidth: 0,
          borderRadius: 999,
          borderSkipped: false,
          barThickness: 14,
          maxBarThickness: 18,
          minBarLength: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      layout: { padding: { top: 8, right: 40, bottom: 8, left: 8 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(255,255,255,0.92)",
          titleColor: "rgba(15,23,42,0.90)",
          bodyColor: "rgba(15,23,42,0.75)",
          borderColor: "rgba(226,232,240,1)",
          borderWidth: 1,
          cornerRadius: 12,
          padding: 10,
          displayColors: false,
          callbacks: {
            title: (items) => items?.[0]?.label || "",
            label: (c) => {
              const i = c.dataIndex;
              const cant = valores[i] ?? 0;
              const monto = montos[i] ?? 0;
              return `${cant} empanadas — $${monto.toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;
            },
          },
        },
        datalabels: {
          anchor: "end",
          align: "right",
          offset: 8,
          color: "rgba(71,85,105,0.9)",
          font: { size: 11, weight: "900" },
          formatter: (v) => v,
          clamp: true,
          clip: false,
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { display: false },
          border: { display: false },
          ticks: { display: false },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            display: true,
            color: "rgba(71,85,105,0.95)",
            font: { size: 12, weight: "800" },
            callback: function (val) {
              const t = this.getLabelForValue(val);
              return t.length > 16 ? t.slice(0, 16) + "…" : t;
            },
          },
        },
      },
      animation: { duration: 650 },
    },
  });
}

// Global (arriba de todo, fuera de la función)
let graficoPedidosCanal = null;

// ✅ DONA: Pedidos por canal (Particular vs PedidosYa)
function renderizarGraficosPedidos(cantidadPy, cantidadParticular) {
  const canvas = document.getElementById("graficoCanalPedidos");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  if (graficoPedidosCanal) {
    graficoPedidosCanal.destroy();
    graficoPedidosCanal = null;
  }

  const py = Math.max(0, Number(cantidadPy) || 0);
  const pa = Math.max(0, Number(cantidadParticular) || 0);
  const total = py + pa;

  const fmtPct = (n) => `${Math.round(n)}%`;
  const EPS = 0.0001;

  const dataReal = [pa, py];
  const dataDraw = dataReal.map((v) => (total > 0 && v === 0 ? EPS : v));

  const ringTrack = {
    id: "ringTrackPedidos",
    beforeDatasetsDraw(chart) {
      const meta = chart.getDatasetMeta(0);
      if (!meta?.data?.[0]) return;

      const { ctx, chartArea } = chart;
      const cx = (chartArea.left + chartArea.right) / 2;
      const cy = (chartArea.top + chartArea.bottom) / 2;

      const outer = meta.data[0].outerRadius;
      const inner = meta.data[0].innerRadius;
      const r = (outer + inner) / 2;

      ctx.save();
      ctx.lineWidth = outer - inner;
      ctx.strokeStyle = "rgba(239,68,68,0.12)";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },
  };

  const centerText = {
    id: "centerTextPedidos",
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      const cx = (chartArea.left + chartArea.right) / 2;
      const cy = (chartArea.top + chartArea.bottom) / 2;

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillStyle = "rgba(15,23,42,0.55)";
      ctx.font = "800 11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText("TOTAL", cx, cy - 14);

      ctx.fillStyle = "rgba(15,23,42,0.92)";
      ctx.font = "900 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(String(total), cx, cy + 2);

      ctx.fillStyle = "rgba(15,23,42,0.55)";
      ctx.font = "700 10px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText("Pedidos", cx, cy + 18);

      ctx.restore();
    },
  };

  const percentLabelsFallback = {
    id: "percentLabelsFallbackPedidos",
    afterDatasetsDraw(chart) {
      if (chart?.options?.plugins?.datalabels?.display) return;

      const meta = chart.getDatasetMeta(0);
      const arcs = meta?.data || [];
      const { ctx } = chart;

      ctx.save();
      ctx.fillStyle = "rgba(71,85,105,0.90)";
      ctx.font = "900 11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      arcs.forEach((arc, i) => {
        const raw = dataReal[i] ?? 0;
        const pct = total ? (raw * 100) / total : 0;
        const label = fmtPct(pct);

        const angle = (arc.startAngle + arc.endAngle) / 2;
        const r = arc.outerRadius + 12;
        const x = arc.x + Math.cos(angle) * r;
        const y = arc.y + Math.sin(angle) * r;

        ctx.fillText(label, x, y);
      });

      ctx.restore();
    },
  };

  graficoPedidosCanal = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Particular", "PedidosYa"],
      datasets: [
        {
          data: dataDraw,
          backgroundColor: ["rgba(239,68,68,0.35)", "rgba(239,68,68,0.95)"],
          borderColor: ["rgba(255,255,255,0.60)", "rgba(255,255,255,0.30)"],
          borderWidth: 2,
          borderRadius: 10,
          spacing: 3,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      rotation: -90,
      layout: { padding: { top: 10, right: 18, bottom: 10, left: 18 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(255,255,255,0.92)",
          titleColor: "rgba(15,23,42,0.90)",
          bodyColor: "rgba(15,23,42,0.75)",
          borderColor: "rgba(226,232,240,1)",
          borderWidth: 1,
          cornerRadius: 12,
          padding: 10,
          displayColors: false,
          callbacks: {
            title: (items) => items?.[0]?.label ?? "",
            label: (t) => {
              const i = t.dataIndex;
              const raw = dataReal[i] ?? 0;
              const pct = total ? (raw * 100) / total : 0;
              return `${raw} pedidos (${fmtPct(pct)})`;
            },
          },
        },
        datalabels: {
          display: true,
          color: "rgba(71,85,105,0.90)",
          font: { size: 11, weight: "900" },
          anchor: "end",
          align: "end",
          offset: 6,
          clamp: true,
          clip: false,
          formatter: (_, context) => {
            const i = context.dataIndex;
            const raw = dataReal[i] ?? 0;
            const pct = total ? (raw * 100) / total : 0;
            return fmtPct(pct);
          },
        },
      },
    },
    plugins: [ringTrack, centerText, percentLabelsFallback],
  });
}

function actualizarTituloModo(tipo, valor) {
  const el = document.getElementById("estadistica-modo");
  if (!el) return;

  if (tipo === "mes") {
    const [anio, mes] = valor.split("-");
    const fecha = new Date(Number(anio), Number(mes) - 1, 1);

    const formatoMes = new Intl.DateTimeFormat("es-AR", {
      month: "long",
      year: "numeric",
    }).format(fecha);

    el.textContent = `Estás viendo: estadísticas del mes (${formatoMes})`;
  } else {
    const [anio, mes, dia] = valor.split("-");
    const formatoDia = `${dia}/${mes}/${anio}`;
    el.textContent = `Estás viendo: estadísticas del día (${formatoDia})`;
  }
}
