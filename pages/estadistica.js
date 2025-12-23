// 📊 ESTADÍSTICAS

// Registrar plugin de datalabels si está disponible
if (typeof ChartDataLabels !== "undefined") {
  Chart.register(ChartDataLabels);
}

let graficoVariedades = null;
let graficoIngresos = null;
let graficoMermas = null;

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

  const hoyISO = `${yyyy}-${mm}-${dd}`;   // YYYY-MM-DD local
  const mesActual = `${yyyy}-${mm}`;      // YYYY-MM local

  // setear fecha de hoy por defecto

  if (inputFecha) {
    inputFecha.value = hoyISO;
  }

  // setear mes actual por defecto
  if (inputMes) {
    inputMes.value = mesActual;
  }

  // cargar estadísticas de hoy al entrar
  cargarEstadisticaDelDia(hoyISO);

  // cuando haga click en "Ver día", cargar la fecha elegida
  if (btnFecha && inputFecha) {
    btnFecha.addEventListener("click", () => {
      const fecha = inputFecha.value;
      if (fecha) {
        cargarEstadisticaDelDia(fecha);
      }
    });
  }

  // cuando haga click en "Ver mes", cargar el mes elegido
  if (btnMes && inputMes) {
    btnMes.addEventListener("click", () => {
      const periodo = inputMes.value; // "2025-12"
      if (periodo) {
        cargarEstadisticaDelMes(periodo);
      }
    });
  }
}



// 👉 trae estadísticas para una fecha concreta (DÍA)
export async function cargarEstadisticaDelDia(fecha) {
  try {
    const res = await fetch(`${window.API_BASE_URL}/estadistica/${fecha}`);

    if (!res.ok) {
      throw new Error("Error consultando estadísticas");
    }

    const data = await res.json();
    console.log("📅 Estadísticas del día:", fecha, data);

    actualizarKpis(data , "dia");
    actualizarTituloModo("dia", fecha); 
    renderizarGraficoVariedades(data.empanadasMasVendidas || []);
    renderizarGraficoIngresos(
      Number(data.totalEfectivo || 0),
      Number(data.totalTransferencia || 0)
    );
    renderizarGraficosPedidos(
      Number(data.cantidadPedidosPY || 0),
      Number(data.cantidadParticular || 0)
    )
    renderizarGraficoMermas(data.empanadasPerdidas || []);

  } catch (e) {
    console.error("❌ Error cargando estadísticas del día:", e);
    alert("No se pudieron cargar las estadísticas del día");
  }
}



// 👉 trae estadísticas para un mes (YYYY-MM)
export async function cargarEstadisticaDelMes(periodoYYYYMM) {
  try {
    const [anio, mes] = periodoYYYYMM.split("-"); // "2025-12" → ["2025","12"]

    const res = await fetch(
      `${window.API_BASE_URL}/estadistica/mes/${anio}/${mes}`
    );

    if (!res.ok) {
      throw new Error("Error consultando estadísticas del mes");
    }

    const data = await res.json();
    console.log("📆 Estadísticas del mes:", periodoYYYYMM, data);

    // Mismo flujo que el día, pero con datos del mes completo
    actualizarKpis(data , "mes");
    actualizarTituloModo("mes", periodoYYYYMM);    
    renderizarGraficoVariedades(data.empanadasMasVendidas || []);
    renderizarGraficoIngresos(
      Number(data.totalEfectivo || 0),
      Number(data.totalTransferencia || 0)
    );
    renderizarGraficosPedidos(
      Number(data.cantidadPedidosPY || 0),
      Number(data.cantidadParticular || 0)
    )
    renderizarGraficoMermas(data.empanadasPerdidas || []);

  } catch (e) {
    console.error("❌ Error cargando estadísticas del mes:", e);
    alert("No se pudieron cargar las estadísticas del mes");
  }
}


// 🔹 Actualiza los KPI
function actualizarKpis(est, tipo = "dia") {
  const totalEmp = est.totalEmpanadasVendidas ?? 0;
  const totalPedidos = est.totalPedidos ?? 0;
  const totalIngresos = Number(est.totalIngresos || 0);
  const totalMermasImporte = Number(est.totalMermasImporte || 0); // 💰 NUEVO
   const totalPedidosYa = Number(est.totalPedidosYa|| 0);

  // valores numéricos
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
const totalPedidosYaNeto = totalPedidosYa * (1 - 0.31); // 31% de comisión
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

  // 👉 textos dinámicos según filtro (día / mes)
  const labelPedidos = document.getElementById("kpi-label-pedidos");
  const labelIngresos = document.getElementById("kpi-label-ingresos");
  const labelMermasDinero = document.getElementById("kpi-label-mermas-dinero");
  const labelIngresosPedidosya = document.getElementById("kpi-label-pedidosya");

  if (tipo === "mes") {

    if (labelPedidos) labelPedidos.textContent = "Pedidos del mes";
    if (labelIngresos) labelIngresos.textContent = "Ingresos particular (mensual)";
    if(labelIngresosPedidosya) labelIngresosPedidosya.textContent = "Pedidos Ya (sin liquidar mensual)"
    if (labelMermasDinero)
      labelMermasDinero.textContent = "Pérdida por mermas (mensual)";
  } else {
    if (labelPedidos) labelPedidos.textContent = "Pedidos del día";
    if (labelIngresos) labelIngresos.textContent = "Ingresos particular (diario)";
    if(labelIngresosPedidosya) labelIngresosPedidosya.textContent = "Pedidos Ya (sin liquidar diario)"
    if (labelMermasDinero)
      labelMermasDinero.textContent = "Pérdida por mermas (diaria)";
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
  const labels = ordenado.map(e => String(e.nombre ?? ""));
  const valores = ordenado.map(e => parseCant(e.cantidad));

  if (graficoVariedades) {
    graficoVariedades.destroy();
    graficoVariedades = null;
  }

  const maxVal = Math.max(1, ...valores);
  const xMax = maxVal * 1.25; // ✅ aire extra para el número afuera
  const fmt = new Intl.NumberFormat("es-AR");

  const bgColors = valores.map((_, i) =>
    i === 0 ? "rgba(239,68,68,0.95)" : "rgba(239,68,68,0.55)"
  );

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
    hoverBackgroundColor: valores.map((_, i) =>
      i === 0 ? "rgba(239,68,68,1)" : "rgba(239,68,68,0.70)"
    ),
  };

  // ✅ Chart.js v3/v4
  if (!isV2) {
    graficoVariedades = new Chart(ctx, {
      type: "bar",
      data: { labels, datasets: [dataset] },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 8, right: 44, bottom: 8, left: 8 } }, // ✅ espacio para el número
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
              title: items => items?.[0]?.label ?? "",
              label: item => `${fmt.format(item.parsed.x)} empanadas`,
            },
          },

          // ✅ NÚMERO afuera (si tenés chartjs-plugin-datalabels cargado)
          datalabels: {
            display: true,
            color: "rgba(71,85,105,0.90)",
            font: { size: 11, weight: "800" },
            anchor: "end",
            align: "right",   // ✅ afuera, a la derecha
            offset: 8,
            clip: false,      // ✅ que no lo recorte el chart
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

  // ✅ Chart.js v2
  graficoVariedades = new Chart(ctx, {
    type: "horizontalBar",
    data: { labels, datasets: [dataset] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 8, right: 44, bottom: 8, left: 8 } },

      scales: {
        xAxes: [{
          display: false,
          ticks: { beginAtZero: true, max: xMax },
          gridLines: { display: false, drawBorder: false },
        }],
        yAxes: [{
          gridLines: { display: false, drawBorder: false },
          ticks: {
            autoSkip: false,
            fontSize: 12,
            fontStyle: "bold",
            fontColor: "rgba(71,85,105,0.95)",
            callback: (t) => (t.length > 16 ? t.slice(0, 16) + "…" : t),
          },
        }],
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

      // ✅ datalabels v2 también
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

  // ✅ para que un 0% se “vea” igual (evita que desaparezca el slice)
  const EPS = 0.0001;
  const dataReal = [ef, tr];
  const dataDraw = dataReal.map(v => (total > 0 && v === 0 ? EPS : v));

  // ✅ plugin: track suave detrás + texto al centro
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
    }
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
    }
  };

  graficoIngresos = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Efectivo", "Transferencia"],
      datasets: [
        {
          data: dataDraw,

          // ✅ colores Bien Criollas
          backgroundColor: [
            "rgba(239,68,68,0.35)", // efectivo suave
            "rgba(239,68,68,0.95)", // transferencia fuerte
          ],
          borderColor: [
            "rgba(255,255,255,0.60)",
            "rgba(255,255,255,0.30)",
          ],
          borderWidth: 2,

          // ✅ look “premium”
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
        // ✅ queda más pro sin legend default (si querés, la activamos)
        legend: { display: false },

        // ✅ tooltip blanco clean (igual al ranking)
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
            title: items => items?.[0]?.label ?? "",
            label: (t) => {
              const i = t.dataIndex;
              const raw = dataReal[i] ?? 0;
              const pct = total ? (raw * 100) / total : 0;
              return `${fmtMoney.format(raw)} (${fmtPct(pct)})`;
            },
          },
        },

        // ✅ % afuera (si usás chartjs-plugin-datalabels)
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

  // Normalizar + ordenar desc por cantidad
  const items = datos
    .map(m => ({
      nombre: m.nombre ?? "Sin nombre",
      cantidad: Number(m.cantidad) || 0,
      monto: Number(m.montoPerdido || 0),
    }))
    .sort((a, b) => b.cantidad - a.cantidad);

  // Top N + Otros
  const TOP_N = 8;
  const top = items.slice(0, TOP_N);
  const resto = items.slice(TOP_N);

  const otrosCant = resto.reduce((acc, it) => acc + it.cantidad, 0);
  const otrosMonto = resto.reduce((acc, it) => acc + it.monto, 0);

  const final = [...top];
  if (otrosCant > 0) final.push({ nombre: "Otros", cantidad: otrosCant, monto: otrosMonto });

  const labels = final.map(x => x.nombre);
  const valores = final.map(x => x.cantidad);
  const montos = final.map(x => x.monto);

  if (graficoMermas) {
    graficoMermas.destroy();
    graficoMermas = null;
  }

  // ✅ colores Bien Criollas
  const maxVal = Math.max(0, ...valores);
  const idxMax = maxVal > 0 ? valores.indexOf(maxVal) : -1;

  const bgColors = valores.map((_, i) =>
    i === idxMax ? "rgba(239,68,68,0.95)" : "rgba(239,68,68,0.35)"
  );

  graficoMermas = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Mermas (empanadas)",
        data: valores,
        backgroundColor: bgColors,
        borderWidth: 0,
        borderRadius: 999,
        borderSkipped: false,
        barThickness: 14,
        maxBarThickness: 18,
        minBarLength: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,

      // ✅ IMPORTANTE: ACÁ va, adentro de options
      indexAxis: "y",

      layout: { padding: { top: 8, right: 40, bottom: 8, left: 8 } },

      plugins: {
        legend: { display: false },

        // tooltip blanco pro
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
            title: items => items?.[0]?.label || "",
            label: (c) => {
              const i = c.dataIndex;
              const cant = valores[i] ?? 0;
              const monto = montos[i] ?? 0;
              return `${cant} empanadas — $${monto.toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;
            },
          },
        },

        // números afuera (si tenés datalabels)
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

// ✅ DONA: Pedidos por canal (Particular vs PedidosYa) — misma onda “premium” que la otra
function renderizarGraficosPedidos(cantidadPy, cantidadParticular) {
  const canvas = document.getElementById("graficoCanalPedidos"); // <-- asegurate que tu <canvas> tenga este id
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

  // para que un slice en 0% “exista” visualmente
  const dataReal = [pa, py]; // orden: Particular, PedidosYa
  const dataDraw = dataReal.map(v => (total > 0 && v === 0 ? EPS : v));

  // --- track detrás del anillo
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
    }
  };

  // --- texto al centro
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
    }
  };

  // --- si NO tenés chartjs-plugin-datalabels, dibujamos % afuera igual
  const percentLabelsFallback = {
    id: "percentLabelsFallbackPedidos",
    afterDatasetsDraw(chart) {
      // si existe datalabels, no hacemos nada
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

        // posición afuera del arco
        const angle = (arc.startAngle + arc.endAngle) / 2;
        const r = arc.outerRadius + 12;
        const x = arc.x + Math.cos(angle) * r;
        const y = arc.y + Math.sin(angle) * r;

        ctx.fillText(label, x, y);
      });

      ctx.restore();
    }
  };

  graficoPedidosCanal = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Particular", "PedidosYa"],
      datasets: [{
        data: dataDraw,
        backgroundColor: [
          "rgba(239,68,68,0.35)", // Particular (suave)
          "rgba(239,68,68,0.95)", // PedidosYa (fuerte)
        ],
        borderColor: [
          "rgba(255,255,255,0.60)",
          "rgba(255,255,255,0.30)",
        ],
        borderWidth: 2,
        borderRadius: 10,
        spacing: 3,
        hoverOffset: 6,
      }]
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
            title: items => items?.[0]?.label ?? "",
            label: (t) => {
              const i = t.dataIndex;
              const raw = dataReal[i] ?? 0;
              const pct = total ? (raw * 100) / total : 0;
              return `${raw} pedidos (${fmtPct(pct)})`;
            }
          }
        },

        // ✅ si tenés chartjs-plugin-datalabels cargado, esto te pone % afuera
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
          }
        }
      }
    },
    plugins: [ringTrack, centerText, percentLabelsFallback],
  });
}


function actualizarTituloModo(tipo, valor) {
  const el = document.getElementById("estadistica-modo");
  if (!el) return;

  if (tipo === "mes") {
    // valor viene como "YYYY-MM"
    const [anio, mes] = valor.split("-");
    const fecha = new Date(Number(anio), Number(mes) - 1, 1);

    const formatoMes = new Intl.DateTimeFormat("es-AR", {
      month: "long",
      year: "numeric",
    }).format(fecha);

    el.textContent = `Estás viendo: estadísticas del mes (${formatoMes})`;
  } else {
    // tipo "dia" – valor viene como "YYYY-MM-DD"
    const [anio, mes, dia] = valor.split("-"); // "2025-12-11"
    const formatoDia = `${dia}/${mes}/${anio}`;

    el.textContent = `Estás viendo: estadísticas del día (${formatoDia})`;
  }
}
