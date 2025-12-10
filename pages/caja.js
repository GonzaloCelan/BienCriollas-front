// ============================================================================
// ⭐ ANIMAR NÚMEROS (para balance final)
// ============================================================================
function animarNumero(elemento, valorFinal, duracion = 800) {
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

function esHoy(fechaStr) {
    const hoy = new Date().toISOString().split("T")[0];
    return fechaStr === hoy;
}

function actualizarBotonesSegunFecha(fecha) {
    const esDiaActual = esHoy(fecha);

    const btnCerrar = document.getElementById("btn-cerrar-caja");
    const btnEgreso = document.getElementById("btn-abrir-egreso");
    const btnPy = document.getElementById("btn-pedidosya");

    if (esDiaActual) {
        // HABILITAR TODO
        btnCerrar.disabled = false;
        btnEgreso.disabled = false;
        btnPy.disabled = false;

        btnCerrar.classList.remove("opacity-40", "cursor-not-allowed");
        btnEgreso.classList.remove("opacity-40", "cursor-not-allowed");
        btnPy.classList.remove("opacity-40", "cursor-not-allowed");

    } else {
        // DESHABILITAR TODO
        btnCerrar.disabled = true;
        btnEgreso.disabled = true;
        btnPy.disabled = true;

        btnCerrar.classList.add("opacity-40", "cursor-not-allowed");
        btnEgreso.classList.add("opacity-40", "cursor-not-allowed");
        btnPy.classList.add("opacity-40", "cursor-not-allowed");
    }
}


function pintarColorBalance(balance) {
    const el = document.getElementById("caja-balance");

    // Limpia colores anteriores
    el.classList.remove(
        "text-red-600", "text-green-600",
        "bg-gradient-to-r", "from-green-600", "to-emerald-500",
        "from-red-600", "to-red-400"
    );

    if (balance >= 0) {
        // Texto verde fuerte
        el.classList.add("text-green-600");
    } else {
        // Texto rojo fuerte
        el.classList.add("text-red-600");
    }
}


// ============================================================================
// ⭐ FECHA UTILIDADES
// ============================================================================
function obtenerFechaHoy() {
    return new Date().toISOString().split("T")[0];
}

function formatearFechaVisual(fechaISO) {
    return fechaISO.split("-").reverse().join("/");
}

// ============================================================================
// ⭐ FILTRO PRINCIPAL DE FECHA
// ============================================================================
document.getElementById("btn-ver-caja").addEventListener("click", cargarCajaPorFecha);

async function cargarCajaPorFecha() {
    const fecha = document.getElementById("caja-fecha").value;
    document.getElementById("caja-modo").textContent =
    "Mostrando resultados filtrados por fecha seleccionada";

    if (!fecha) {
        toastError("Seleccioná una fecha para buscar la caja.");
        return;
    }

    document.getElementById("caja-dia-actual").textContent =
        `Caja del día: ${formatearFechaVisual(fecha)}`;

    actualizarBotonesSegunFecha(fecha)
    cargarIngresos(fecha);
    cargarEgresos(fecha);
    cargarBalance(fecha);
}

// ============================================================================
// ⭐ MOSTRAR FECHA ACTUAL AL INICIAR
// ============================================================================
function pintarFechaActual() {
    const hoyISO = obtenerFechaHoy();
    document.getElementById("caja-dia-actual").textContent =
        `Caja del día: ${formatearFechaVisual(hoyISO)}`;
}

// ============================================================================
// ⭐ CARGAR INGRESOS POR FECHA
// ============================================================================
async function cargarIngresos(fecha) {
    try {
        const response = await fetch(`${window.API_BASE_URL}/api/caja/ingresos?fecha=${fecha}`);
        if (!response.ok) throw new Error("Error consultando ingresos");

        const data = await response.json();

        document.getElementById("kpi-ingresos-totales").textContent =
            `$${Number(data.ingresosTotales).toLocaleString("es-AR")}`;

        document.getElementById("kpi-ingresos-efectivo").textContent =
            `$${Number(data.ingresosEfectivo).toLocaleString("es-AR")}`;

        document.getElementById("kpi-ingresos-transferencias").textContent =
            `$${Number(data.ingresosTransferencias).toLocaleString("es-AR")}`;

        document.getElementById("kpi-mermas").textContent =
            `$${Number(data.totalMermas).toLocaleString("es-AR")}`;

        const py = data.pedidosYaLiquidacion;
        document.getElementById("kpi-pedidosya").textContent =
            py ? `$${Number(py).toLocaleString("es-AR")}` : "$0";

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
        const data = await response.json();

        const tbody = document.getElementById("tabla-egresos-body");
        tbody.innerHTML = "";

        data.forEach(e => {
            const monto = Number(e.monto);

            const tr = document.createElement("tr");
            tr.className =
                "border-b border-slate-200 hover:bg-slate-50 transition-colors";

            tr.innerHTML = `
                <td class="px-4 py-3 text-slate-700 flex items-center gap-2">
                    <span class="text-red-500 text-sm">💸</span>
                    <span>${e.descripcion}</span>
                </td>

                <td class="px-4 py-3 text-right">
                    <span class="text-red-600 font-semibold bg-red-50 px-2 py-1 rounded-lg">
                        -$${monto.toLocaleString("es-AR")}
                    </span>
                </td>

                <td class="px-4 py-3 text-right text-slate-500">
                    ${e.hora}
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

        const balance = Number(data.balance);
        const balanceEl = document.getElementById("caja-balance");

        animarNumero(balanceEl, balance);
        pintarColorBalance(balance);

        // ⭐ COLOR DINÁMICO (positivo = verde, negativo = rojo)
        if (balance >= 0) {
            balanceEl.classList.remove("text-red-600");
            balanceEl.classList.add("text-green-600");
        } else {
            balanceEl.classList.remove("text-green-600");
            balanceEl.classList.add("text-red-600");
        }

    } catch (error) {
        console.error("Error cargando balance:", error);
    }
}

// ============================================================================
// ⭐ MODAL EGRESOS (el mismo)
// ============================================================================
const modalEgreso = document.getElementById("modal-egreso");
const btnAbrirEgreso = document.getElementById("btn-abrir-egreso");
const btnCerrarEgreso = document.getElementById("btn-cerrar-egreso");

btnAbrirEgreso.addEventListener("click", () => modalEgreso.classList.remove("hidden"));
btnCerrarEgreso.addEventListener("click", cerrarModalEgreso);

function cerrarModalEgreso() {
    modalEgreso.classList.add("hidden");
    document.getElementById("egreso-descripcion").value = "";
    document.getElementById("egreso-monto").value = "";
}

// ============================================================================
// ⭐ REGISTRAR EGRESO
// ============================================================================
document.getElementById("btn-guardar-egreso")
    .addEventListener("click", registrarEgreso);

async function registrarEgreso() {
    const descripcion = document.getElementById("egreso-descripcion").value.trim();
    const monto = Number(document.getElementById("egreso-monto").value);
    const fecha = document.getElementById("caja-fecha").value || obtenerFechaHoy();

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
        cargarEgresos(fecha);
        cargarBalance(fecha);

        toastOk("Egreso registrado");

    } catch (err) {
        toastError("No se pudo registrar el egreso");
    }
}

// ============================================================================
// ⭐ MODAL PEDIDOS YA
// ============================================================================
document.getElementById("btn-pedidosya")
    .addEventListener("click", () => {
        document.getElementById("modal-pedidosya").classList.remove("hidden");
    });

document.getElementById("py-cancelar").addEventListener("click", cerrarModalPY);

function cerrarModalPY() {
    document.getElementById("modal-pedidosya").classList.add("hidden");
    document.getElementById("py-fecha").value = "";
    document.getElementById("py-monto").value = "";
}

document.getElementById("py-guardar").addEventListener("click", registrarPedidosYa);

async function registrarPedidosYa() {
    const fecha = document.getElementById("py-fecha").value;
    const monto = Number(document.getElementById("py-monto").value);

    if (!fecha || monto <= 0) {
        toastError("Completá la fecha y el monto");
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

        cargarIngresos(fecha);
        cargarBalance(fecha);

    } catch (err) {
        toastError("No se pudo registrar PedidosYa");
    }
}

// ============================================================================
// ⭐ TOASTIFY
// ============================================================================
function toastOk(msg) {
    Toastify({
        text: msg,
        duration: 2500,
        gravity: "top",
        position: "right",
        style: { background: "#10B981" }
    }).showToast();
}

function toastError(msg) {
    Toastify({
        text: msg,
        duration: 2500,
        gravity: "top",
        position: "right",
        style: { background: "#EF4444" }
    }).showToast();
}

// ============================================================================
// ⭐ CERRAR CAJA POR FECHA
// ============================================================================
const modalConfirmar = document.getElementById("modal-confirmar-caja");
const btnCerrarCaja = document.getElementById("btn-cerrar-caja");
const btnCancelar = document.getElementById("btn-caja-cancelar");
const btnConfirmar = document.getElementById("btn-caja-confirmar");

btnCerrarCaja.addEventListener("click", () => {
    modalConfirmar.classList.remove("hidden");
});

btnCancelar.addEventListener("click", () => {
    modalConfirmar.classList.add("hidden");
});

btnConfirmar.addEventListener("click", cerrarCajaDiaria);

async function cerrarCajaDiaria() {
    modalConfirmar.classList.add("hidden");

    const fecha = document.getElementById("caja-fecha").value || obtenerFechaHoy();

    try {
        const response = await fetch(`${window.API_BASE_URL}/api/caja/cierre?fecha=${fecha}`, {
            method: "POST"
        });

        if (!response.ok) throw new Error();

        const data = await response.json();

        animarNumero(document.getElementById("caja-balance"), Number(data.balanceFinal));

        btnCerrarCaja.textContent = "✔ Caja cerrada";
        btnCerrarCaja.classList.add("btn-caja-cerrada");
        btnCerrarCaja.disabled = true;

        mostrarToastCajaCerrada();

    } catch (err) {
        toastError("No se pudo cerrar la caja");
    }
}

function mostrarToastCajaCerrada() {
    const t = document.getElementById("toast-caja");
    t.classList.remove("hidden");

    setTimeout(() => (t.style.opacity = "0"), 2000);
    setTimeout(() => {
        t.classList.add("hidden");
        t.style.opacity = "1";
    }, 2800);
}



// ============================================================================
// ⭐ INICIALIZACIÓN
// ============================================================================
export function initCaja() {
    document.getElementById("caja-modo").textContent =
    "Mostrando caja del día de hoy (automático)";
    pintarFechaActual();

    const hoy = obtenerFechaHoy();

    cargarIngresos(hoy);
    cargarEgresos(hoy);
    cargarBalance(hoy);
    actualizarBotonesSegunFecha(hoy)
}
