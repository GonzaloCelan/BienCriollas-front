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
    renderizarGraficoMermas(data.empanadasPerdidas || []);

  } catch (e) {
    console.error("❌ Error cargando estadísticas del mes:", e);
    alert("No se pudieron cargar las estadísticas del mes");
  }
}


// 🔹 Actualiza los KPI
// 🔹 Actualiza los KPI
function actualizarKpis(est, tipo = "dia") {
  const totalEmp = est.totalEmpanadasVendidas ?? 0;
  const totalPedidos = est.totalPedidos ?? 0;
  const totalIngresos = Number(est.totalIngresos || 0);
  const bajoStock = est.variedadBajoStock ?? 0;
  const totalMermas = est.totalMermas ?? 0;
  const totalMermasImporte = Number(est.totalMermasImporte || 0); // 💰 NUEVO

  // valores numéricos
  document.getElementById("kpi-empanadas").textContent = totalEmp;
  document.getElementById("kpi-pedidos").textContent = totalPedidos;
  document.getElementById("kpi-facturacion").textContent =
    "$" +
    totalIngresos.toLocaleString("es-AR", {
      minimumFractionDigits: 0,
    });
  document.getElementById("kpi-bajo-stock").textContent = bajoStock;

  const kpiMermas = document.getElementById("kpi-mermas");
  if (kpiMermas) {
    kpiMermas.textContent = totalMermas;
  }

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

  if (tipo === "mes") {
    if (labelPedidos) labelPedidos.textContent = "Pedidos del mes";
    if (labelIngresos) labelIngresos.textContent = "Ingresos (mensual)";
    if (labelMermasDinero)
      labelMermasDinero.textContent = "Pérdida por mermas (mensual)";
  } else {
    if (labelPedidos) labelPedidos.textContent = "Pedidos del día";
    if (labelIngresos) labelIngresos.textContent = "Ingresos (diario)";
    if (labelMermasDinero)
      labelMermasDinero.textContent = "Pérdida por mermas (diaria)";
  }
}



// 🔹 Gráfico de empanadas vendidas por variedad (BARRAS)
function renderizarGraficoVariedades(lista) {
  const canvas = document.getElementById("graficoVariedades");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  const datos = Array.isArray(lista) ? lista : [];
  console.log("Datos para gráfico de variedades (vendidas):", datos);

  const labels = datos.map(e => e.nombre);
  const valores = datos.map(e => e.cantidad);

  if (graficoVariedades) {
    graficoVariedades.destroy();
    graficoVariedades = null;
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "rgba(248, 113, 113, 0.95)");
  gradient.addColorStop(1, "rgba(248, 113, 113, 0.25)");

  graficoVariedades = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Empanadas vendidas",
          data: valores,
          borderWidth: 1,
          backgroundColor: gradient,
          borderColor: "rgba(220, 38, 38, 0.9)",
          borderRadius: 10,
          barPercentage: 0.45,
          categoryPercentage: 0.7,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 16, right: 16, bottom: 4, left: 4 },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(148, 163, 184, 0.15)",
            drawBorder: false,
          },
          ticks: {
            font: { size: 10 },
            color: "#64748b",
          },
        },
        x: {
          grid: {
            display: false,
          },
          ticks: {
            autoSkip: false,
            maxRotation: 30,
            minRotation: 0,
            font: { size: 11 },
            color: "#64748b",
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0f172a",
          borderColor: "rgba(148, 163, 184, 0.4)",
          borderWidth: 1,
          titleFont: { size: 11, weight: "600" },
          bodyFont: { size: 11 },
          padding: 8,
          callbacks: {
            label: ctx => `${ctx.parsed.y} empanadas`,
          },
        },
        datalabels: {
          anchor: "end",
          align: "end",
          offset: -4,
          formatter: value => value,
          color: "#0f172a",
          font: { size: 11, weight: "600" },
        },
      },
    },
  });
}

// 🔹 DONA 1: Ingresos por medio de pago (porcentaje en la dona)
function renderizarGraficoIngresos(totalEfectivo, totalTransferencia) {
  const canvas = document.getElementById("graficoIngresosMedios");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  if (graficoIngresos) {
    graficoIngresos.destroy();
    graficoIngresos = null;
  }

  const valores = [totalEfectivo, totalTransferencia];

  graficoIngresos = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: [
        `Efectivo: $${totalEfectivo.toLocaleString("es-AR", {
          minimumFractionDigits: 0,
        })}`,
        `Transferencia: $${totalTransferencia.toLocaleString("es-AR", {
          minimumFractionDigits: 0,
        })}`,
      ],
      datasets: [
        {
          data: valores,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          backgroundColor: "#0f172a",
          borderColor: "rgba(148, 163, 184, 0.4)",
          borderWidth: 1,
          titleFont: { size: 11, weight: "600" },
          bodyFont: { size: 11 },
          padding: 8,
          callbacks: {
            label: ctx => {
              const raw = Number(ctx.raw ?? 0);
              const dataArr = ctx.chart.data.datasets[0].data;
              const total = dataArr.reduce(
                (acc, v) => acc + Number(v || 0),
                0
              );
              const pct = total ? Math.round((raw * 100) / total) : 0;

              return `${pct}% — $${raw.toLocaleString("es-AR", {
                minimumFractionDigits: 0,
              })}`;
            },
          },
        },
        datalabels: {
          formatter: (value, ctx) => {
            const dataArr = ctx.chart.data.datasets[0].data;
            const total = dataArr.reduce(
              (acc, v) => acc + Number(v || 0),
              0
            );
            const pct = total ? Math.round((value * 100) / total) : 0;
            return `${pct}%`;
          },
          color: "#0f172a",
          font: { size: 11, weight: "600" },
        },
      },
      cutout: "60%",
    },
  });
}

function renderizarGraficoMermas(listaMermas) {
  const canvas = document.getElementById("graficoMermasVariedad");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  const datos = Array.isArray(listaMermas) ? listaMermas : [];
  console.log("Datos para gráfico de mermas:", datos);

  const labels = datos.map(m => m.nombre);
  const valores = datos.map(m => m.cantidad);
  const montos  = datos.map(m => Number(m.montoPerdido || 0)); // 💰

  if (graficoMermas) {
    graficoMermas.destroy();
    graficoMermas = null;
  }

  graficoMermas = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: valores,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          backgroundColor: "#0f172a",
          borderColor: "rgba(148, 163, 184, 0.4)",
          borderWidth: 1,
          titleFont: { size: 11, weight: "600" },
          bodyFont: { size: 11 },
          padding: 8,
          callbacks: {
            label: ctx => {
              const i = ctx.dataIndex;
              const nombre = labels[i] || "";
              const cant = valores[i] ?? 0;
              const monto = montos[i] ?? 0;

              return `${nombre}: ${cant} empanadas — $${monto.toLocaleString(
                "es-AR",
                { minimumFractionDigits: 0 }
              )}`;
            },
          },
        },
        datalabels: {
          formatter: value => value,
          color: "#0f172a",
          font: { size: 11, weight: "600" },
        },
      },
      cutout: "60%",
    },
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
