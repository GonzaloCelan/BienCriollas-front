


  const NOMBRES_VARIEDAD = {
    1: "Criolla",
    2: "Verdura",
    3: "Choclo",
    4: "Pollo",
    5: "Atún",
    6: "Caprese",
    7: "Fugazza",
    8: "Queso azul",
    9: "Bondiola",
    10: "Vacio desmenuzado",
    11: "Campo (picante)",
    12: "Jamón y queso"
  };

  function formatearFecha(isoDate) {
    if (!isoDate) return "";
    const [y, m, d] = isoDate.split("-");
    return `${d}/${m}/${y}`;
  }

export async function cargarStockActual() {
    const url = `${window.API_BASE_URL}/stock/obtener-stock-actual`;
    console.log("Llamando a:", url);

    try {
      const response = await fetch(url);
      console.log("Status:", response.status);

      if (!response.ok) {
        throw new Error("Error consultando el stock actual");
      }

      const datos = await response.json();
      pintarTablaStock(datos);

    } catch (error) {
      console.error("Error en fetch de stock:", error);
      alert("No se pudo obtener el stock actual del dia");
    }
  }

const UMBRAL_STOCK_BAJO = 50; // acá definís qué es "bajo"

function pintarTablaStock(datos) {
  const tbody = document.getElementById("tbody-stock-actual");
  tbody.innerHTML = "";

  if (!datos || datos.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="5" class="px-3 py-3 text-center text-xs text-slate-500">
        No hay stock cargado
      </td>
    `;
    tbody.appendChild(tr);
    return;
  }

  // ordenar de menor a mayor stock disponible
  datos.sort((a, b) => a.stock_disponible - b.stock_disponible);

  datos.forEach(item => {
    const tr = document.createElement("tr");

    const esStockBajo = item.stock_disponible <= UMBRAL_STOCK_BAJO;
    const nombreVariedad =
      NOMBRES_VARIEDAD[item.id_variedad] || `Variedad #${item.id_variedad}`;
    const fecha = formatearFecha(item.fecha_elaboracion);

    // indicador de nivel de stock (color del chip / punto)
    const nivelClase =
      item.stock_disponible === 0
        ? "bg-rose-100 text-rose-700 border-rose-200"
        : item.stock_disponible <= UMBRAL_STOCK_BAJO
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-emerald-50 text-emerald-700 border-emerald-200";

    const puntoClase =
      item.stock_disponible === 0
        ? "bg-rose-500"
        : item.stock_disponible <= UMBRAL_STOCK_BAJO
        ? "bg-amber-500"
        : "bg-emerald-500";

    // fila con hover suave y fondo distinto si es bajo stock
    tr.className =
      "group border-b border-slate-100 last:border-b-0 transition-colors " +
      (esStockBajo
        ? "bg-rose-50/60 hover:bg-rose-100/80"
        : "hover:bg-slate-50/80");

    tr.innerHTML = `
      <!-- Variedad -->
      <td class="px-4 py-2.5 text-[13px]">
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full ${puntoClase}"></span>
          <span class="font-medium text-slate-800 group-hover:text-slate-900">
            ${nombreVariedad}
          </span>
        </div>
      </td>

      <!-- Fecha elaboración -->
      <td class="px-4 py-2.5 text-[12px] text-slate-500">
        ${fecha}
      </td>

      <!-- Stock total -->
      <td class="px-4 py-2.5 text-right text-[13px] text-slate-700">
        ${item.stock_total}
      </td>

      <!-- Stock disponible (chip) -->
      <td class="px-4 py-2.5 text-right text-[13px]">
        <span class="inline-flex items-center justify-end min-w-[3rem] px-2 py-0.5 rounded-md border ${nivelClase} text-[12px] font-semibold">
          ${item.stock_disponible}
        </span>
      </td>

      <!-- Estado -->
      <td class="px-4 py-2.5 text-center">
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          Activo
        </span>
      </td>
    `;

    tbody.appendChild(tr);
  });
}


// actualizar stock

const API_BASE = "http://localhost:8080";


// ---------- TOAST ----------
function mostrarToast(mensaje, tipo = "success") {
  const toast = document.createElement("div");
  toast.textContent = mensaje;

  toast.className =
    "fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm shadow-lg " +
    "transition-all duration-300 transform " +
    (tipo === "success"
      ? "bg-emerald-600 text-white"
      : "bg-rose-600 text-white");

  document.body.appendChild(toast);

  // salir suave
  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");
  }, 2200);

  setTimeout(() => {
    toast.remove();
  }, 2800);
}






// ---------- GUARDAR PRODUCCIÓN ----------
export async function guardarProduccion() {
  const fechaInput = document.getElementById("fecha-produccion");
  const fecha = fechaInput ? fechaInput.value : "";

  if (!fecha) {
    mostrarToast("Seleccioná la fecha de producción", "error");
    return;
  }

  // ahora sí va a encontrarlos
  const inputs = document.querySelectorAll(".input-cantidad-variedad");
  const payload = [];

  inputs.forEach(input => {
    const valor = Number(input.value || 0);
    const idVariedad = Number(input.dataset.variedadId); // ← data-variedad-id

    console.log("Input cantidad:", { valor, idVariedad });

    if (!Number.isNaN(idVariedad) && valor > 0) {
      payload.push({
        id_variedad: idVariedad,
        fecha_elaboracion: fecha,
        stock_total: valor
      });
    }
  });

  console.log("Payload a enviar:", payload);

  if (payload.length === 0) {
    mostrarToast("No hay cantidades para guardar", "error");
    return;
  }

  try {
    const response = await fetch(`${window.API_BASE_URL}/stock/actualizar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error("Error al actualizar stock");

    mostrarToast("Stock actualizado ✅", "success");

    // resetear inputs
    inputs.forEach(input => (input.value = "0"));

    // refrescar tabla
    await cargarStockActual();
  } catch (error) {
    console.error("Error guardando producción:", error);
    mostrarToast("No se pudo actualizar el stock", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Si ya tenés una función que carga el stock al inicio, la podés llamar acá:
  // cargarStockActual();

  const btnActualizar = document.getElementById("btn-actualizar-tabla");

  if (btnActualizar) {
    btnActualizar.addEventListener("click", async () => {
      cargarStockActual();
    });
  }
});


 

document.addEventListener("DOMContentLoaded", () => {
  const vistaStock = document.getElementById("vista-stock-normal");
  const vistaMermas = document.getElementById("vista-mermas");

  // Ir a vista mermas
  document.getElementById("btn-ir-a-mermas").addEventListener("click", () => {
    vistaStock.classList.add("hidden");
    vistaMermas.classList.remove("hidden");
  });

  // Volver sin guardar
  document.getElementById("btn-cancelar-mermas").addEventListener("click", () => {
    vistaMermas.classList.add("hidden");
    vistaStock.classList.remove("hidden");
  });

  // Botón "Hoy" (si igual querés ver la fecha, aunque no se mande al back)
  const btnMermaHoy = document.getElementById("btn-merma-hoy");
  const inputFechaMerma = document.getElementById("fecha-merma");

  if (btnMermaHoy && inputFechaMerma) {
    btnMermaHoy.addEventListener("click", () => {
      const hoy = new Date();
      const yyyy = hoy.getFullYear();
      const mm = String(hoy.getMonth() + 1).padStart(2, "0");
      const dd = String(hoy.getDate()).padStart(2, "0");
      inputFechaMerma.value = `${yyyy}-${mm}-${dd}`;
    });
  }

  // 👇 AHORA SIN FECHA EN EL PAYLOAD
  async function guardarMermas() {
  const inputs = document.querySelectorAll("[data-perdida-variedad-id]");
  const perdidas = [];

  inputs.forEach(input => {
    const cantidad = parseInt(input.value, 10) || 0;
    const idVariedad = parseInt(input.dataset.perdidaVariedadId, 10);

    if (cantidad > 0) {
      perdidas.push({
        idVariedad: idVariedad,
        cantidad: cantidad
      });
    }
  });

  if (perdidas.length === 0) {
    if (typeof mostrarToast === "function") {
      mostrarToast("No cargaste ninguna merma");
    } else {
      alert("No cargaste ninguna merma");
    }
    return;
  }

  try {
    const resp = await fetch(`${window.API_BASE_URL}/stock/perdidas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(perdidas)
    });

    if (!resp.ok) throw new Error("Error registrando mermas");

    // limpiar campos
    inputs.forEach(i => i.value = 0);
    const inputFechaMerma = document.getElementById("fecha-merma");
    if (inputFechaMerma) inputFechaMerma.value = "";

    // volver a la vista de stock
    vistaMermas.classList.add("hidden");
    vistaStock.classList.remove("hidden");

    // 🔹 refrescar tabla AUTOMÁTICO
    if (typeof cargarStockActual === "function") {
      // si tenés una función que ya hace el fetch y pinta la tabla
      cargarStockActual();
    } else {
      // plan B: simular click en el botón "Actualizar tabla"
      const btnActualizar = document.getElementById("btn-actualizar-tabla");
      if (btnActualizar) btnActualizar.click();
    }

    // 🔹 toast de éxito
    if (typeof mostrarToast === "function") {
      mostrarToast("Mermas registradas y stock actualizado ✅");
    } else {
      alert("Mermas registradas y stock actualizado ✅");
    }
  } catch (e) {
    console.error(e);
    if (typeof mostrarToast === "function") {
      mostrarToast("No se pudieron registrar las mermas");
    } else {
      alert("No se pudieron registrar las mermas");
    }
  }
}


  document.getElementById("btn-guardar-mermas")
          .addEventListener("click", guardarMermas);
});

document.addEventListener("DOMContentLoaded", () => {
  const btnGuardar = document.getElementById("btn-guardar-produccion");
  if (btnGuardar) {
    btnGuardar.addEventListener("click", guardarProduccion);
  }
});
