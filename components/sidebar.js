// ==========================
// 🔒 CONFIG TEMPORAL
// ==========================
const EGRESOS_HABILITADO = false;

// ==========================
// 🟩 FUNCIÓN GLOBAL EXPORTABLE
// ==========================
export function cambiarSeccion(target) {
  if (target === "egreso" && !EGRESOS_HABILITADO) {
    alert("La sección Egresos está temporalmente desactivada por mantenimiento.");
    target = "pedidos";
  }

  const sections = document.querySelectorAll("[data-section]");

  sections.forEach(sec => {
    sec.classList.remove("visible");
    sec.classList.add("hidden");
  });

  const destino = document.querySelector(`[data-section="${target}"]`);

  if (destino) {
    destino.classList.remove("hidden");

    // animación fade-in
    setTimeout(() => destino.classList.add("visible"), 10);
  }

  // actualizar títulos si existen
  const titulo = document.getElementById("titulo-seccion");
  const subtitulo = document.getElementById("subtitulo-seccion");

  const textos = {
    pedidos: {
      titulo: "Pedidos",
      sub: "Listado de pedidos del día"
    },
    stock: {
      titulo: "Stock",
      sub: "Disponibilidad de empanadas por variedad"
    },
    caja: {
      titulo: "Caja diaria",
      sub: "Resumen financiero del día: ingresos, egresos y balance final."
    },
    "nuevo-pedido": {
      titulo: "Nuevo pedido",
      sub: "Carga de datos del cliente y selección de empanadas"
    },
    estadisticas: {
      titulo: "Estadísticas",
      sub: "Resumen de ventas y actividad del negocio"
    },
    "resumen-historico": {
      titulo: "Totales acumulados",
      sub: "Acumulado general de cajas cerradas: efectivo, transferencias, PedidosYa, egresos y total."
    },
    horarios: {
      titulo: "Horarios del Personal",
      sub: "Turnos, horas trabajadas y cálculo semanal"
    },
    egreso: {
      titulo: "Control de egresos",
      sub: "Registrá gastos y mirá cómo impactan en el mes"
    },
    configuracion: {
      titulo: "Configuración",
      sub: "Cards dinámicas · Editás costos/estado · Abajo tabla de precio unitario"
    }
  };

  if (textos[target] && titulo && subtitulo) {
    titulo.textContent = textos[target].titulo;
    subtitulo.textContent = textos[target].sub;
  }
}

// ==========================
// 🟩 FUNCIÓN EXPORTABLE DESDE JS
// llamada por otros módulos
// ==========================
export function cambiarSeccionDesdeJS(target) {
  if (target === "egreso" && !EGRESOS_HABILITADO) {
    alert("La sección Egresos está temporalmente desactivada por mantenimiento.");
    target = "pedidos";
  }

  cambiarSeccion(target);
  actualizarPaginacion(target);

  const buttons = document.querySelectorAll("[data-section-btn]");

  buttons.forEach(b => {
    if (b.dataset.sectionBtn === target) {
      b.classList.add("activo");
    } else {
      b.classList.remove("activo");
    }
  });
}

// ==========================
// 🟩 INICIALIZACIÓN DEL SIDEBAR
// ==========================
document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll("[data-section-btn]");

  // Marcar visualmente Egresos como desactivado
  const egresoBtn = document.querySelector('[data-section-btn="egreso"]');

  if (egresoBtn && !EGRESOS_HABILITADO) {
    egresoBtn.classList.add("disabled");
    egresoBtn.title = "Sección temporalmente desactivada";
  }

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.sectionBtn;

      // ======================
      // 🔒 BLOQUEO TEMPORAL EGRESOS
      // ======================
      if (target === "egreso" && !EGRESOS_HABILITADO) {
        alert("La sección Egresos está temporalmente desactivada por mantenimiento.");
        return;
      }

      // activar visualmente el botón
      buttons.forEach(b => b.classList.remove("activo"));
      btn.classList.add("activo");

      cambiarSeccion(target);
      actualizarPaginacion(target);

      // ======================
      // 📌 SECCIÓN: PEDIDOS
      // ======================
      if (target === "pedidos") {
        import("../pages/obtenerPedidos.js").then(mod => {
          mod.cargarPedidosPorEstado("PENDIENTE");
        });

        import("../pages/pedido.init.js").then(mod => {
          mod.animarTituloFecha();
        });
      }

      // ======================
      // 📌 SECCIÓN: STOCK
      // ======================
      if (target === "stock") {
        import("../pages/stock.js").then(mod => {
          mod.cargarStockActual();
        });
      }

      // ======================
      // 📌 SECCIÓN: CAJA
      // ======================
      if (target === "caja") {
        import("../pages/caja.js").then(mod => {
          mod.initCaja();
        });
      }

      // ======================
      // 📌 SECCIÓN: ESTADÍSTICAS
      // ======================
      if (target === "estadisticas") {
        import("../pages/estadistica.js").then(mod => {
          mod.initEstadisticas();
        });
      }

      // ======================
      // 📌 SECCIÓN: RESUMEN HISTÓRICO
      // ======================
      if (target === "resumen-historico") {
        import("../pages/resumenHistorico.js").then(mod => {
          mod.cargarResumenHistorico();
        });
      }

      // ======================
      // 📌 SECCIÓN: HORARIOS
      // ======================
      if (target === "horarios") {
        import("../pages/horarios.js").then(mod => {
          if (mod.initHorarios) mod.initHorarios();
        });
      }

      // ======================
      // 🔒 SECCIÓN: EGRESOS DESACTIVADA
      // ======================
      // No importar egresos.js mientras EGRESOS_HABILITADO esté en false.
      /*
      if (target === "egreso" && EGRESOS_HABILITADO) {
        import("../pages/egresos.js").then(mod => {
          if (mod.initEgresos) mod.initEgresos();
        });
      }
      */

      // ======================
      // 📌 SECCIÓN: CONFIGURACIÓN
      // ======================
      if (target === "configuracion") {
        import("../pages/configuracion.js").then(mod => {
          if (mod.initSeccionConfiguracion) mod.initSeccionConfiguracion();
        });
      }
    });
  });

  // sección por defecto → PEDIDOS
  cambiarSeccion("pedidos");
  actualizarPaginacion("pedidos");

  // cargar pedidos al iniciar
  import("../pages/obtenerPedidos.js").then(mod => {
    mod.cargarPedidosPorEstado("PENDIENTE");
  });
});

// ==========================
// 🔧 MOSTRAR / OCULTAR PAGINACIÓN DE PEDIDOS
// ==========================
function actualizarPaginacion(target) {
  const paginacion = document.getElementById("paginacion-pedidos");

  if (!paginacion) return;

  if (target === "pedidos") {
    paginacion.classList.remove("hidden");
  } else {
    paginacion.classList.add("hidden");
  }
}