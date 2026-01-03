// ===============================
// Resumen histórico (KPIs + gráfico mensual + liquidaciones PedidosYa)
// Requiere (si querés el filtro de año):
//   - <input id="filtro-anio-grafico" ...>
//   - <button id="btn-refresh-grafico-mensual" ...>Actualizar</button>

const API_BASE = String(window.API_BASE_URL ?? "").replace(/\/$/, "");

const ENDPOINT = `${API_BASE}/api/resumen/acumulado`;
const ENDPOINT_GRAFICO = `${API_BASE}/api/resumen/mensual/grafico`;

// ✅ endpoint liquidaciones PedidosYa
const ENDPOINT_PYA_LIQ = `${API_BASE}/api/resumen/pedidosya/acumulado`;

// ===============================
// ✅ Formatter rápido (mejor que toLocaleString por frame)
const moneyFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function formatARS(value) {
  return moneyFmt.format(Number(value ?? 0));
}

// ===============================
// ✅ Easing “visible”
function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ✅ Espera a que el navegador pinte (clave hidden -> visible)
function nextPaint() {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );
}

// ===============================
// ✅ CountUp corregido (cancela animación previa)
function animateCountUp(el, toValue, { duration = 1600, formatter = formatARS } = {}) {
  if (!el) return;

  if (el._rafId) cancelAnimationFrame(el._rafId);

  const fromValue = Number(el.dataset.value ?? "0");
  const target = Number(toValue ?? 0);

  const start = performance.now();

  const frame = (now) => {
    const p = Math.min(1, (now - start) / duration);
    const eased = easeInOutCubic(p);

    const current = fromValue + (target - fromValue) * eased;
    el.textContent = formatter(current);

    if (p < 1) {
      el._rafId = requestAnimationFrame(frame);
    } else {
      el.textContent = formatter(target);
      el.dataset.value = String(target);
      el._rafId = null;
    }
  };

  el._rafId = requestAnimationFrame(frame);
}

// ===============================
// Helpers filtro mes
function getCurrentMonthValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`; // YYYY-MM
}

function parseMonthValue(yyyyMm) {
  if (!yyyyMm || typeof yyyyMm !== "string" || !/^\d{4}-\d{2}$/.test(yyyyMm)) return null;
  const [yStr, mStr] = yyyyMm.split("-");
  const anio = Number(yStr);
  const mes = Number(mStr);
  if (!anio || !mes || mes < 1 || mes > 12) return null;
  return { anio, mes };
}

function buildUrl({ anio, mes } = {}) {
  if (!anio || !mes) return ENDPOINT;

  const params = new URLSearchParams();
  // backend espera "año" (con ñ)
  params.set("año", String(anio));
  params.set("mes", String(mes));
  return `${ENDPOINT}?${params.toString()}`;
}

// ===============================
// ✅ URL gráfico por año
function buildUrlGrafico(anio) {
  const params = new URLSearchParams();
  // controller soporta "anio" (sin ñ)
  params.set("anio", String(anio));
  return `${ENDPOINT_GRAFICO}?${params.toString()}`;
}

// ===============================
// ✅ Año (filtro gráfico)
function getCurrentYear() {
  return new Date().getFullYear();
}

function parseYearValue(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const y = Math.trunc(n);
  // rango razonable para el negocio
  if (y < 2000 || y > 2100) return null;
  return y;
}

function getYearInputEls() {
  return {
    inp: document.getElementById("filtro-anio-grafico"),
    btn: document.getElementById("btn-refresh-grafico-mensual")
  };
}

function getSelectedChartYear({ fallbackYear = getCurrentYear() } = {}) {
  const { inp } = getYearInputEls();
  const y = parseYearValue(inp?.value);
  return y ?? fallbackYear;
}

function setChartYearInputValue(anio) {
  const { inp } = getYearInputEls();
  if (inp) inp.value = String(anio);
}

// ===============================
// Pintar KPIs (MISMAS IDS + NUEVO balance)
function pintar(dto) {
  const elEfectivo = document.getElementById("kpi-acum-efectivo");
  const elTransferencia = document.getElementById("kpi-acum-transferencia");
  const elPedidosYa = document.getElementById("kpi-acum-pedidosya");
  const elTotal = document.getElementById("kpi-acum-total");
  const elEgresos = document.getElementById("kpi-acum-egresos");
  const elBalance = document.getElementById("kpi-acum-balance");

  [elEfectivo, elTransferencia, elPedidosYa, elTotal, elEgresos, elBalance].forEach((el) => {
    if (el && el.dataset.value == null) el.dataset.value = "0";
  });

  const total = Number(dto?.acumuladoTotal ?? 0);
  const egresos = Number(dto?.egresoAcumulado ?? 0);

  const balanceFinal = (dto?.balanceFinal != null)
    ? Number(dto.balanceFinal)
    : (total - egresos);

  animateCountUp(elEfectivo, dto?.acumuladoEfectivo, { duration: 1500 });
  animateCountUp(elTransferencia, dto?.acumuladoTransferencia, { duration: 1600 });
  animateCountUp(elPedidosYa, dto?.acumuladoPedidosya, { duration: 1700 });
  animateCountUp(elTotal, total, { duration: 2000 });
  animateCountUp(elEgresos, egresos, { duration: 1800 });
  animateCountUp(elBalance, balanceFinal, { duration: 1900 });
}

// ===============================
// ✅ Gráfico mensual (Chart.js)
let _chartMensual = null;
let _chartLoading = false;

function ensureChartJs() {
  return typeof window.Chart !== "undefined";
}

function renderGraficoMensual(data) {
  const canvas = document.getElementById("chart-balance-mensual");
  if (!canvas) return;

  if (!ensureChartJs()) {
    console.warn("Chart.js no está cargado. No se puede pintar el gráfico mensual.");
    return;
  }

  const labels = (data ?? []).map((x) => x.mes);
  const values = (data ?? []).map((x) => Number(x.balance ?? 0));

  const ctx = canvas.getContext("2d");

  if (_chartMensual) {
    _chartMensual.data.labels = labels;
    _chartMensual.data.datasets[0].data = values;
    _chartMensual.update();
    return;
  }

  _chartMensual = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Balance",
          data: values,
          borderWidth: 0,
          borderRadius: 10,
          backgroundColor: "rgba(239, 68, 68, 0.85)",

          barPercentage: 0.45,
          categoryPercentage: 0.6,
          maxBarThickness: 26
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          displayColors: false,
          callbacks: {
            title: (items) => items?.[0]?.label ?? "",
            label: (ctx) => `Balance: ${formatARS(ctx.parsed.y)}`
          }
        },
        datalabels: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { font: { weight: "700" } }
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: { display: false }
        }
      }
    }
  });
}

async function cargarGraficoMensualPorAnio(anio) {
  const res = await fetch(buildUrlGrafico(anio), { headers: { Accept: "application/json" } });

  if (res.status === 204) {
    renderGraficoMensual([
      { mes: "Ene", balance: 0 }, { mes: "Feb", balance: 0 }, { mes: "Mar", balance: 0 }, { mes: "Abr", balance: 0 },
      { mes: "May", balance: 0 }, { mes: "Jun", balance: 0 }, { mes: "Jul", balance: 0 }, { mes: "Ago", balance: 0 },
      { mes: "Sep", balance: 0 }, { mes: "Oct", balance: 0 }, { mes: "Nov", balance: 0 }, { mes: "Dic", balance: 0 }
    ]);
    return;
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const lista = await res.json(); // [{mes:"Ene", balance:123}, ...]
  renderGraficoMensual(lista);
}

async function refrescarGraficoMensualDesdeUI({ forceYear } = {}) {
  const { btn } = getYearInputEls();
  if (_chartLoading) return;

  const anio = forceYear ?? getSelectedChartYear({ fallbackYear: getCurrentYear() });

  try {
    _chartLoading = true;
    if (btn) btn.disabled = true;

    await nextPaint();
    await cargarGraficoMensualPorAnio(anio);
  } catch (e) {
    console.error(e);
  } finally {
    if (btn) btn.disabled = false;
    _chartLoading = false;
  }
}

// ===============================
// ✅ Tabla liquidaciones PedidosYa
let _pyaLiquCache = null;
let _pyaLiquCacheAt = 0;
let _pyaShowAll = false;
let _pyaLastFiltered = [];

function formatFechaDMY(yyyyMmDd) {
  if (!yyyyMmDd || typeof yyyyMmDd !== "string") return "";
  const parts = yyyyMmDd.split("-");
  if (parts.length !== 3) return yyyyMmDd;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sortByFechaDesc(a, b) {
  const fa = String(a?.fecha ?? "");
  const fb = String(b?.fecha ?? "");
  if (fa < fb) return 1;
  if (fa > fb) return -1;
  return 0;
}

function filtrarLiquidacionesPorMes(lista, anio, mes) {
  if (!anio || !mes) return lista ?? [];
  const mm = String(mes).padStart(2, "0");
  const prefix = `${anio}-${mm}-`;
  return (lista ?? []).filter((x) => String(x?.fecha ?? "").startsWith(prefix));
}

function renderTablaLiquidacionesPya(lista, { limit = 8 } = {}) {
  const tbody = document.getElementById("tbodyLiquidacionesPya");
  if (!tbody) return;

  const elTotal = document.getElementById("pyaTotalLiquidado");
  const elCant = document.getElementById("pyaCantFilas");

  const totalCount = (lista ?? []).length;
  const totalSum = (lista ?? []).reduce((acc, x) => acc + safeNum(x?.monto), 0);

  if (elTotal) elTotal.textContent = formatARS(totalSum);

  const toShow = _pyaShowAll ? (lista ?? []) : (lista ?? []).slice(0, limit);
  const visibleCount = toShow.length;

  if (elCant) {
    elCant.textContent = (_pyaShowAll || totalCount <= limit)
      ? String(totalCount)
      : `${visibleCount}/${totalCount}`;
  }

  if (!toShow || toShow.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="2" class="px-4 py-10 text-center text-sm text-slate-400">
          No hay liquidaciones cargadas para este período.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = toShow.map((it) => {
    const fecha = formatFechaDMY(it?.fecha);
    const monto = formatARS(it?.monto);
    return `
      <tr class="hover:bg-slate-50/70 transition-colors">
        <td class="px-4 py-3">
          <div class="text-[13px] font-extrabold text-slate-900">${fecha}</div>
        </td>
        <td class="px-4 py-3 text-right">
          <div class="text-[13px] font-extrabold text-slate-900">${monto}</div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderTablaLiquidacionesPyaError(msg = "Error al cargar liquidaciones.") {
  const tbody = document.getElementById("tbodyLiquidacionesPya");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="2" class="px-4 py-10 text-center text-sm text-rose-600 font-extrabold">
        ${msg}
      </td>
    </tr>
  `;
}

async function fetchLiquidacionesPya({ force = false } = {}) {
  const now = Date.now();
  if (!force && _pyaLiquCache && (now - _pyaLiquCacheAt) < 30_000) {
    return _pyaLiquCache;
  }

  const res = await fetch(ENDPOINT_PYA_LIQ, { headers: { Accept: "application/json" } });

  if (res.status === 204) {
    _pyaLiquCache = [];
    _pyaLiquCacheAt = now;
    return [];
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const lista = await res.json(); // [{idIngreso, fecha:"YYYY-MM-DD", monto:123}, ...]
  const normalizada = Array.isArray(lista) ? lista : [];
  normalizada.sort(sortByFechaDesc);

  _pyaLiquCache = normalizada;
  _pyaLiquCacheAt = now;
  return normalizada;
}

async function cargarTablaLiquidacionesPya({ anio, mes } = {}) {
  try {
    const lista = await fetchLiquidacionesPya();

    const filtrada = filtrarLiquidacionesPorMes(lista, anio, mes);
    _pyaLastFiltered = filtrada;

    const btnToggle = document.getElementById("btnVerTodasLiquidaciones");
    if (btnToggle) {
      btnToggle.style.display = (filtrada.length > 8) ? "" : "none";
      btnToggle.textContent = _pyaShowAll ? "Ver menos" : "Ver todas";
    }

    renderTablaLiquidacionesPya(filtrada, { limit: 8 });
  } catch (e) {
    console.error(e);
    renderTablaLiquidacionesPyaError("No se pudieron cargar las liquidaciones.");
  }
}

function initToggleVerTodasLiquidaciones() {
  const btn = document.getElementById("btnVerTodasLiquidaciones");
  if (!btn || btn._inited) return;

  btn._inited = true;
  btn.addEventListener("click", () => {
    _pyaShowAll = !_pyaShowAll;
    btn.textContent = _pyaShowAll ? "Ver menos" : "Ver todas";
    renderTablaLiquidacionesPya(_pyaLastFiltered, { limit: 8 });
  });
}

// ===============================
// Inicializar listeners (una sola vez)
let _rhInited = false;

function initResumenHistoricoFiltro() {
  if (_rhInited) return;
  _rhInited = true;

  const inpMes = document.getElementById("filtro-mes");
  const btnFiltrar = document.getElementById("btn-filtrar-mes");
  const btnLimpiar = document.getElementById("btn-limpiar-mes");
  const btnRefrescar = document.getElementById("btn-refrescar-resumen-historico"); // compat

  // ✅ init toggle tabla
  initToggleVerTodasLiquidaciones();

  // ✅ NUEVO: init filtro año gráfico
  const { inp: inpAnioGraf, btn: btnGraf } = getYearInputEls();
  if (inpAnioGraf && !inpAnioGraf.value) {
    inpAnioGraf.value = String(getCurrentYear());
  }
  if (btnGraf && !btnGraf._inited) {
    btnGraf._inited = true;
    btnGraf.addEventListener("click", () => refrescarGraficoMensualDesdeUI());
  }
  if (inpAnioGraf && !inpAnioGraf._inited) {
    inpAnioGraf._inited = true;
    inpAnioGraf.addEventListener("keydown", (e) => {
      if (e.key === "Enter") refrescarGraficoMensualDesdeUI();
    });
  }

  // Mes actual por defecto si está vacío
  if (inpMes && !inpMes.value) {
    inpMes.value = getCurrentMonthValue();
  }

  // Aplicar
  if (btnFiltrar) {
    btnFiltrar.addEventListener("click", () => cargarResumenHistorico({ preferMesActual: false }));
  }

  // Limpiar -> histórico total
  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", () => {
      if (inpMes) inpMes.value = "";
      cargarResumenHistorico({ forzarHistoricoTotal: true });
    });
  }

  // Compat botón refrescar viejo
  if (btnRefrescar) {
    btnRefrescar.addEventListener("click", () => cargarResumenHistorico({ preferMesActual: false }));
  }

  // Enter en mes
  if (inpMes) {
    inpMes.addEventListener("keydown", (e) => {
      if (e.key === "Enter") cargarResumenHistorico({ preferMesActual: false });
    });
  }
}

// ===============================
// ✅ ESTA ES LA QUE LLAMÁS DESDE EL TARGET
// - Por defecto pinta mes actual (si existe filtro-mes)
// - Gráfico: año del mes filtrado, o el del filtro-anio-grafico, o año actual
export async function cargarResumenHistorico(opts = {}) {
  initResumenHistoricoFiltro();

  const elEstado = document.getElementById("resumen-historico-estado");

  const btnRefrescar = document.getElementById("btn-refrescar-resumen-historico"); // compat
  const btnFiltrar = document.getElementById("btn-filtrar-mes");
  const btnLimpiar = document.getElementById("btn-limpiar-mes");

  const inpMes = document.getElementById("filtro-mes");

  const setEstado = (t) => elEstado && (elEstado.textContent = t);

  let url = ENDPOINT;
  let etiqueta = "Histórico total";

  // ✅ año por defecto para gráfico: del input año (si existe), sino actual
  let anioGrafico = getSelectedChartYear({ fallbackYear: getCurrentYear() });

  // ✅ filtro para tabla liquidaciones
  let filtroTabla = null;

  try {
    if (btnRefrescar) btnRefrescar.disabled = true;
    if (btnFiltrar) btnFiltrar.disabled = true;
    if (btnLimpiar) btnLimpiar.disabled = true;

    setEstado("Cargando...");

    if (opts.forzarHistoricoTotal) {
      url = ENDPOINT;
      etiqueta = "Histórico total";
      // si input año inválido => actual
      anioGrafico = getSelectedChartYear({ fallbackYear: getCurrentYear() });
      setChartYearInputValue(anioGrafico);
      filtroTabla = null;
    } else if (inpMes) {
      if (!inpMes.value && opts.preferMesActual !== false) {
        inpMes.value = getCurrentMonthValue();
      }

      const parsed = parseMonthValue(inpMes.value);
      if (parsed) {
        url = buildUrl(parsed);
        etiqueta = `${parsed.anio}-${String(parsed.mes).padStart(2, "0")}`;
        anioGrafico = parsed.anio;     // ✅ año del mes filtrado
        setChartYearInputValue(anioGrafico); // ✅ sincroniza UI
        filtroTabla = parsed;          // ✅ tabla filtrada por mes
      } else {
        url = ENDPOINT;
        etiqueta = "Histórico total";
        anioGrafico = getSelectedChartYear({ fallbackYear: getCurrentYear() });
        setChartYearInputValue(anioGrafico);
        filtroTabla = null;
      }
    } else {
      url = ENDPOINT;
      etiqueta = "Histórico total";
      anioGrafico = getSelectedChartYear({ fallbackYear: getCurrentYear() });
      setChartYearInputValue(anioGrafico);
      filtroTabla = null;
    }

    // ✅ cargar tabla liquidaciones
    await cargarTablaLiquidacionesPya(filtroTabla ?? {});
    await nextPaint();

    const res = await fetch(url, { headers: { Accept: "application/json" } });

    if (res.status === 204) {
      await nextPaint();
      pintar({
        acumuladoEfectivo: 0,
        acumuladoTransferencia: 0,
        acumuladoPedidosya: 0,
        acumuladoTotal: 0,
        egresoAcumulado: 0,
        balanceFinal: 0
      });

      await nextPaint();
      await cargarGraficoMensualPorAnio(anioGrafico);

      setEstado(`Sin datos (${etiqueta})`);
      return;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const dto = await res.json();

    await nextPaint();
    pintar(dto);

    await nextPaint();
    await cargarGraficoMensualPorAnio(anioGrafico);

    setEstado(`Actualizado ✅ (${etiqueta})`);
  } catch (e) {
    console.error(e);
    setEstado("Error ❌");
  } finally {
    if (btnRefrescar) btnRefrescar.disabled = false;
    if (btnFiltrar) btnFiltrar.disabled = false;
    if (btnLimpiar) btnLimpiar.disabled = false;
  }
}
