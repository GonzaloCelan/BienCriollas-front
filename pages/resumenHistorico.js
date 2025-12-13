const ENDPOINT = `${window.API_BASE_URL}/api/resumen/acumulado`;

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
// ✅ Easing más “visible” (arranca suave y se nota el conteo)
function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ✅ Espera a que el navegador pinte (clave cuando venís de hidden -> visible)
function nextPaint() {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );
}

// ===============================
// ✅ CountUp corregido (cancela animación previa + usa formatter rápido)
function animateCountUp(el, toValue, { duration = 1600, formatter = formatARS } = {}) {
  if (!el) return;

  // si ya había una animación corriendo, la cancelamos
  if (el._rafId) cancelAnimationFrame(el._rafId);

  // valor inicial (guardado)
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
      // fijamos el valor final
      el.textContent = formatter(target);
      el.dataset.value = String(target);
      el._rafId = null;
    }
  };

  el._rafId = requestAnimationFrame(frame);
}

// ===============================
// Pintar KPIs (MISMAS IDS)
function pintar(dto) {
  const elEfectivo      = document.getElementById("kpi-acum-efectivo");
  const elTransferencia = document.getElementById("kpi-acum-transferencia");
  const elPedidosYa     = document.getElementById("kpi-acum-pedidosya");
  const elTotal         = document.getElementById("kpi-acum-total");
  const elEgresos       = document.getElementById("kpi-acum-egresos");

  // init dataset si no existe (primera vez)
  [elEfectivo, elTransferencia, elPedidosYa, elTotal, elEgresos].forEach((el) => {
    if (el && el.dataset.value == null) el.dataset.value = "0";
  });

  // duraciones un toque más largas para que SE NOTE
  animateCountUp(elEfectivo,      dto.acumuladoEfectivo,      { duration: 1500 });
  animateCountUp(elTransferencia, dto.acumuladoTransferencia, { duration: 1600 });
  animateCountUp(elPedidosYa,     dto.acumuladoPedidosya,     { duration: 1700 });
  animateCountUp(elTotal,         dto.acumuladoTotal,         { duration: 2000 });
  animateCountUp(elEgresos,       dto.egresoAcumulado,        { duration: 1800 });
}

// ===============================
// ✅ ESTA ES LA QUE LLAMÁS DESDE EL TARGET
export async function cargarResumenHistorico() {
  const elEstado = document.getElementById("resumen-historico-estado");
  const btn = document.getElementById("btn-refrescar-resumen-historico");

  const setEstado = (t) => elEstado && (elEstado.textContent = t);

  try {
    if (btn) btn.disabled = true;
    setEstado("Cargando...");

    const res = await fetch(ENDPOINT, { headers: { Accept: "application/json" } });

    if (res.status === 204) {
      await nextPaint();
      pintar({
        acumuladoEfectivo: 0,
        acumuladoTransferencia: 0,
        acumuladoPedidosya: 0,
        acumuladoTotal: 0,
        egresoAcumulado: 0
      });
      setEstado("Sin datos");
      return;
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const dto = await res.json();

    // 👇 clave para que no se “saltee” la animación
    await nextPaint();

    pintar(dto);
    setEstado("Actualizado ✅");
  } catch (e) {
    console.error(e);
    setEstado("Error ❌");
  } finally {
    if (btn) btn.disabled = false;
  }
}
