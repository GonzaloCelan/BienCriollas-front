// ============================================================================
//  HORARIOS.JS — SISTEMA COMPLETO DE TURNOS (VERSIÓN ORGANIZADA + COLORES FIX)
// ============================================================================

// 🔹 Fecha base = lunes de la semana actual
let lunesActual = obtenerLunes(new Date());
let editandoTurno = null; // null = creando – número = editando turno

// ============================================================================
//  UTILIDADES GENERALES
// ============================================================================

function toISOLocal(date) {
    return date.toISOString().split("T")[0];
}

const coloresCalendar = [
  {bg:"#e8f0fe", border:"#4285f4"}, // azul
  {bg:"#fce8e6", border:"#d93025"}, // rojo
  {bg:"#e6f4ea", border:"#188038"}, // verde
  {bg:"#fef7e0", border:"#f9ab00"}, // amarillo
  {bg:"#f3e8fd", border:"#9334e6"}, // violeta
  {bg:"#e0f2f1", border:"#00897b"}, // teal
  {bg:"#fce8ff", border:"#c2185b"}  // magenta
];

// Cada empleado tiene un color asignado
function colorEmpleadoGoogle(idEmpleado) {
  return coloresCalendar[idEmpleado % coloresCalendar.length];
}

/** Devuelve el lunes de la semana correspondiente */
function obtenerLunes(fecha) {
    const f = new Date(fecha);
    const dia = f.getDay(); // 0 = Domingo
    const diff = f.getDate() - dia + (dia === 0 ? -6 : 1);
    return new Date(f.setDate(diff));
}

/** Suma días a una fecha */
function sumarDias(fecha, dias) {
    const f = new Date(fecha);
    f.setDate(f.getDate() + dias);
    return f;
}

/** Convierte Date → yyyy-MM-dd */
function toISO(d) {
    return d.toISOString().slice(0, 10);
}

/** Devuelve número de día con 2 dígitos */
function diaNum(d) {
    return String(d.getDate()).padStart(2, "0");
}

// ============================================================================
//  CONFIG — Nombres de días + Colores para turnos
// ============================================================================

const diasCortos = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Mapeo de colores válidos de Tailwind (NO dinámicos) */
const colorMap = {
    0: "bg-blue-100 text-blue-800",
    1: "bg-purple-100 text-purple-800",
    2: "bg-green-100 text-green-800",
    3: "bg-rose-100 text-rose-800",
    4: "bg-amber-100 text-amber-800",
    5: "bg-cyan-100 text-cyan-800",
    6: "bg-pink-100 text-pink-800"
};

/** Devuelve la clase de color según ID de empleado */
function claseEmpleado(id) {
    return colorMap[id % 7];
}

// ============================================================================
//  INICIALIZACIÓN DEL MÓDULO
// ============================================================================

export function initHorarios() {
    cargarSemana();
}

// ============================================================================
//  CARGA COMPLETA DE LA SEMANA
// ============================================================================

async function cargarSemana() {

    const lunes = lunesActual;
    const domingo = sumarDias(lunes, 6);

    document.getElementById("horSemRango").textContent =
        `${diaNum(lunes)} - ${diaNum(domingo)} ${lunes.getFullYear()}`;

     document.getElementById("tituloDinamico").textContent =
    `Registrando horarios del ${diaNum(lunes)} al ${diaNum(domingo)} de ${lunes.getFullYear()}`;

    const empleados = await fetch(`${window.API_BASE_URL}/api/empleados`).then(r => r.json());

    const turnos = await fetch(
        `${window.API_BASE_URL}/api/turnos/semana?desde=${toISO(lunes)}&hasta=${toISO(domingo)}`
    ).then(r => r.json());

    pintarGrilla(empleados, turnos, lunes);
    cargarTotalesSemana(lunes, domingo);
    actualizarBotonPagado();


   

}

// ============================================================================
//  RENDER PRINCIPAL DE LA GRILLA SEMANAL
// ============================================================================

// =============================================================
//  PINTAR GRILLA SEMANAL (VERSIÓN CORREGIDA SIN "<" OCULTOS)
// =============================================================
function pintarGrilla(empleados, turnos, lunes) {

    const cont = document.getElementById("horGrid");
    cont.innerHTML = "";

    // HEADER
    let header = `
        <div class="grid grid-cols-8 bg-slate-50 border-b border-slate-200">
            <div class="p-3 text-sm font-semibold text-slate-600">Empleado</div>
    `;
    for (let i = 0; i < 7; i++) {
        const fecha = sumarDias(lunes, i);
        header += `
            <div class="p-3 text-sm font-semibold text-slate-600">
                ${diasCortos[fecha.getDay()]} ${diaNum(fecha)}
            </div>
        `;
    }
    header += `</div>`;
    cont.innerHTML += header;

    // FILAS DE EMPLEADOS
    empleados.forEach(emp => {

        let row = `
            <div class="grid grid-cols-8 border-b border-slate-200">
                <div class="p-3 font-medium text-slate-700">${emp.nombre}</div>
        `;

        for (let dia = 0; dia < 7; dia++) {

            const fechaISO = toISO(sumarDias(lunes, dia));

            // turnos del empleado ese día
            const delDia = turnos.filter(t =>
                t.empleado.idEmpleado === emp.idEmpleado &&
                t.fecha === fechaISO
            );

            const col = colorEmpleadoGoogle(emp.idEmpleado);

            // CELDA DEL DÍA
            row += `
                <div class="p-2">
                    <div class="flex flex-wrap gap-2">
            `;

            // SI TIENE TURNOS → dibujarlos
            delDia.forEach(t => {
                row += `
                    <div onclick="abrirModalEditar(${t.idTurno})"
                         class="cursor-pointer flex items-center gap-1 rounded-lg shadow-sm"
                         style="
                             background: ${col.bg};
                             border-left: 6px solid ${col.border};
                             padding: 6px 10px;
                             font-size: 12px;
                             white-space: nowrap;
                         ">
                        ⏱ ${t.horaInicio.slice(0,5)} - ${t.horaFin.slice(0,5)}
                    </div>
                `;
            });

            // SI NO TIENE TURNOS → botón agregar
            if (delDia.length === 0) {
                row += `
                    <div onclick="abrirModalCrear(${emp.idEmpleado}, '${fechaISO}')"
                        class="cursor-pointer rounded-lg border border-dashed flex items-center justify-center w-full"
                        style="
                            border-color: #cbd5e1;
                            padding: 22px 0;
                            font-size: 12px;
                            color: #94a3b8;
                        ">
                        + agregar turno
                    </div>
                `;
            }

            row += `
                    </div>
                </div>
            `;
        }

        row += `</div>`;
        cont.innerHTML += row;
    });
}





// ============================================================================
//  TOTALES SEMANALES
// ============================================================================
async function cargarTotalesSemana(lun, dom) {

    const panel = document.getElementById("horTotales");
    panel.innerHTML = "";

    const totales = await fetch(
        `${window.API_BASE_URL}/api/horarios/totales?desde=${toISO(lun)}&hasta=${toISO(dom)}`
    ).then(r => r.json());

    let totalGeneral = 0;

    totales.forEach(t => {

        totalGeneral += t.pagoTotal;

        const horas = Math.round(t.horasTotales * 100) / 100;
        const pago = t.pagoTotal.toLocaleString("es-AR");

        panel.innerHTML += `
            <div class="border border-slate-300 border-l-4 border-indigo-400 rounded-lg p-4 bg-white shadow-sm 
                        hover:shadow-md hover:border-indigo-500 transition-all duration-150 animate-slideFade">
                
                <div class="font-semibold text-slate-800 text-sm mb-2">
                    ${t.empleado}
                </div>

                <div class="flex items-center justify-between text-xs text-slate-600">

                    <!-- HORAS -->
                    <div class="flex items-center gap-1">
                        <span class="text-indigo-500 text-sm">🕒</span>
                        <span>${horas} hs</span>
                    </div>

                    <!-- PAGO -->
                    <div class="flex items-center gap-1">
                        <span class="text-emerald-600 text-sm">💵</span>
                        <span class="font-medium">$${pago}</span>
                    </div>
                </div>

                <!-- Barra de progreso opcional (horas trabajadas del máximo 48h por ej.) -->
                <div class="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-3">
                    <div class="h-full bg-indigo-500" style="width: ${Math.min((horas / 48) * 100, 100)}%"></div>
                </div>

            </div>
        `;
    });

    // TOTAL SEMANAL PREMIUM
    const totalDiv = document.getElementById("horTotalSemana");

    totalDiv.innerHTML = `
        <div class="bg-slate-50 border border-slate-300 rounded-lg p-4 shadow-sm animate-slideFade">
            <div class="flex items-center gap-2 mb-1">
                <span class="text-blue-600 text-xl">📘</span>
                <span class="font-medium text-slate-700">Total de la semana</span>
            </div>

            <div class="text-2xl font-bold text-slate-900">
                $${totalGeneral.toLocaleString("es-AR")}
            </div>
        </div>
    `;
}


// ============================================================================
//  NAVEGACIÓN ENTRE SEMANAS
// ============================================================================

window.semanaAnterior = () => {
    lunesActual = sumarDias(lunesActual, -7);
    cargarSemana();
};

window.semanaSiguiente = () => {
    lunesActual = sumarDias(lunesActual, 7);
    cargarSemana();
};

// ============================================================================
//  VISTA SOLO DE UN DÍA
// ============================================================================

window.verDia = async function (fecha) {

    const cont = document.getElementById("horGrid");
    cont.innerHTML = "";

    const empleados = await fetch(`${window.API_BASE_URL}/api/empleados`).then(r => r.json());
    const turnos = await fetch(
        `${window.API_BASE_URL}/api/turnos/dia?fecha=${fecha}`
    ).then(r => r.json());

    let html = `
        <div class="bg-slate-50 border-b border-slate-200 p-3 font-semibold text-slate-700">
            Turnos del día ${fecha}
        </div>
    `;

    empleados.forEach(e => {
        let ts = turnos.filter(t => t.empleado.id === e.idEmpleado);

        html += `
            <div class="p-3 border-b border-slate-200">
                <div class="font-medium">${e.nombre}</div>
        `;

        if (ts.length === 0) {
            html += `
                <div onclick="abrirModalCrear(${e.idEmpleado}, '${fecha}')"
                     class="mt-1 text-xs text-slate-300 border border-dashed border-slate-300 px-2 py-1 w-max rounded cursor-pointer">
                    + agregar turno
                </div>
            `;
        } else {
            ts.forEach(t => {
                const clase = claseEmpleado(e.idEmpleado);
                html += `
                    <div onclick="abrirModalEditar(${t.idTurno})"
                         class="mt-1 cursor-pointer text-xs ${clase} px-2 py-1 rounded shadow-sm">
                        ${t.horaInicio.slice(0, 5)} - ${t.horaFin.slice(0, 5)}
                    </div>
                `;
            });
        }

        html += `</div>`;
    });

    cont.innerHTML = html;
};

// ============================================================================
//  CONTROL DE SEMANA PAGADA
// ============================================================================

function semanaBloqueada() {
    return document.body.classList.contains("semana-pagada");
}

window.marcarSemanaPagada = async function() {
    const lunes = lunesActual;
    const domingo = sumarDias(lunes, 6);

    // Primero verificar antes de ejecutar
    const respCheck = await fetch(
        `${window.API_BASE_URL}/api/liquidacion/semana?inicio=${toISO(lunes)}&fin=${toISO(domingo)}`
    );

    const liquidaciones = await respCheck.json();

    if (liquidaciones.some(l => l.pagado === 1)) {
        mostrarToast("La semana ya estaba pagada ✔");
        actualizarBotonPagado();
        return; // <-- IMPORTANTE
    }

    // 1️⃣ Generar liquidación primero
    const empleados = await fetch(`${window.API_BASE_URL}/api/empleados`).then(r => r.json());

    for (const emp of empleados) {
        // Crear liquidación semanal
        const resp = await fetch(`${window.API_BASE_URL}/api/liquidacion/generar?idEmpleado=${emp.idEmpleado}&semanaInicio=${toISO(lunes)}&semanaFin=${toISO(domingo)}`, {
            method: "POST"
        });

        const liq = await resp.json();

        // 2️⃣ Marcar como pagado
        await fetch(`${window.API_BASE_URL}/api/liquidacion/${liq.idLiquidacion}/pagar`, {
            method: "PUT"
        });
    }

    // 3️⃣ Cambiar botón
    const btn = document.getElementById("btnMarcarPagado");
    btn.disabled = true;
    btn.textContent = "Semana pagada ✔";
    btn.classList.remove("bg-red-600");
    btn.classList.add("bg-green-600");

    // 4️⃣ Toast
    mostrarToast("La semana fue marcada como pagada correctamente ✔");

    cargarSemana();
};

// ============================================================================
//  DESCARGA DE PDF
// ============================================================================

window.descargarPDFSemana = function () {
    const lunes = lunesActual;
    window.open(`${window.API_BASE_URL}/api/horarios/pdf?desde=${toISO(lunes)}`, "_blank");
};

// ============================================================================
//  MODALES — CREAR Y EDITAR
// ============================================================================

/** Abre modal vacío para crear un nuevo turno */
window.abrirModalCrear = function (idEmpleado, fecha) {
    editandoTurno = null;

    cargarSelectEmpleados().then(() => {
        document.getElementById("turnoEmpleado").value = idEmpleado;
    });

    document.getElementById("turnoFecha").value = fecha;
    document.getElementById("turnoInicio").value = "";
    document.getElementById("turnoFin").value = "";

    document.getElementById("btnEliminarTurno").classList.add("hidden");
    document.getElementById("modalTurno").classList.remove("hidden");
};

/** Abre modal con datos existentes para editar */
window.abrirModalEditar = async function (idTurno) {
    editandoTurno = idTurno;

    const data = await fetch(`${window.API_BASE_URL}/api/turnos/${idTurno}`).then(r => r.json());

    await cargarSelectEmpleados();
    document.getElementById("turnoEmpleado").value = data.empleado.idEmpleado;
    document.getElementById("turnoFecha").value = data.fecha;
    document.getElementById("turnoInicio").value = data.horaInicio;
    document.getElementById("turnoFin").value = data.horaFin;

    document.getElementById("btnEliminarTurno").classList.remove("hidden");
    document.getElementById("modalTurno").classList.remove("hidden");
};

// ============================================================================
//  CERRAR MODAL
// ============================================================================

window.cerrarModalTurno = function () {
    document.getElementById("modalTurno").classList.add("hidden");
};

// ============================================================================
//  GUARDAR TURNO (CREAR O EDITAR)
// ============================================================================

window.guardarTurno = async function () {

    const esEdicion = editandoTurno !== null;

    const payload = esEdicion
        ? {
            horaInicio: document.getElementById("turnoInicio").value,
            horaFin: document.getElementById("turnoFin").value
        }
        : {
            empleado: {
                idEmpleado: parseInt(document.getElementById("turnoEmpleado").value)
            },
            fecha: document.getElementById("turnoFecha").value,
            horaInicio: document.getElementById("turnoInicio").value,
            horaFin: document.getElementById("turnoFin").value
        };

    const url = esEdicion
        ? `${window.API_BASE_URL}/api/turnos/${editandoTurno}`
        : `${window.API_BASE_URL}/api/turnos/crear`;

    const method = esEdicion ? "PUT" : "POST";

    const resp = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!resp.ok) {
        console.error(await resp.text());
        alert("Error al guardar turno");
        return;
    }

    cerrarModalTurno();
    cargarSemana();
};

// ============================================================================
//  ELIMINAR TURNO
// ============================================================================

async function eliminarTurno(idTurno) {
    await fetch(`${window.API_BASE_URL}/api/turnos/${idTurno}`, { method: "DELETE" });
    cerrarModalTurno();
    cargarSemana();
}

// ============================================================================
//  CARGAR LISTA DE EMPLEADOS EN EL SELECT DEL MODAL
// ============================================================================

async function cargarSelectEmpleados() {
    const empleados = await fetch(`${window.API_BASE_URL}/api/empleados`).then(r => r.json());
    const sel = document.getElementById("turnoEmpleado");

    sel.innerHTML = "";

    empleados.forEach(emp => {
        sel.innerHTML += `<option value="${emp.idEmpleado}">${emp.nombre}</option>`;
    });
}

// ============================================================================
//  RESETA EL BOTON DE PAGADO
// ============================================================================

async function actualizarBotonPagado() {

    const lunes = lunesActual;
    const domingo = sumarDias(lunes, 6);

    let liquidaciones = [];

    try {
        const resp = await fetch(
            `${window.API_BASE_URL}/api/liquidacion/semana?inicio=${toISO(lunes)}&fin=${toISO(domingo)}`
        );

        if (resp.ok) {
            liquidaciones = await resp.json();
        }
    } catch (e) {
        console.error("Error consultando liquidaciones:", e);
    }

    const algunaPagada = liquidaciones.some(l => l.pagado === 1);

    const btn = document.getElementById("btnMarcarPagado");

    if (algunaPagada) {
        btn.disabled = true;
        btn.textContent = "Semana pagada ✔";
        btn.classList.remove("bg-red-600");
        btn.classList.add("bg-green-600");
    } else {
        btn.disabled = false;
        btn.textContent = "Marcar semana como pagada";
        btn.classList.remove("bg-green-600");
        btn.classList.add("bg-red-600");
    }
}



// ============================================================================
//  INICIALIZACIÓN AUTOMÁTICA
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector("[data-section='horarios']")) {
        initHorarios();
    }
});
