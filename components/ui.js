// ui.js — controla sidebar, navegación, modales y cosas generales
import { cargarPedidosPorEstado } from "./pedidos.js";
import { cargarStockActual } from "./stock.js";
import { cargarEstadisticas } from "./estadistica.js";


// Selecciones globales
const buttons = document.querySelectorAll("[data-section-btn]");
const sections = document.querySelectorAll("[data-section]");
const titulo = document.getElementById("titulo-seccion");
const subtitulo = document.getElementById("subtitulo-seccion");

// Diccionario de textos por sección
const textos = {
  pedidos: {
    titulo: "Pedidos",
    sub: "Listado de pedidos del día",
  },
  stock: {
    titulo: "Stock",
    sub: "Disponibilidad de empanadas por variedad",
  },
  registro: {
    titulo: "Registro",
    sub: "Historial de movimientos y cambios",
  },
  "nuevo-pedido": {
    titulo: "Nuevo pedido",
    sub: "Carga de datos del cliente y selección de empanadas",
  },
  estadisticas: {
    titulo: "Estadísticas",
    sub: "Resumen de ventas y actividad del negocio",
  },
};

// Cambia la sección visible
function cambiarSeccion(target) {
  sections.forEach((sec) => {
    sec.classList.toggle("hidden", sec.dataset.section !== target);
  });

  if (textos[target]) {
    titulo.textContent = textos[target].titulo;
    subtitulo.textContent = textos[target].sub;
  }

  if (target === "estadisticas") {
    const hoy = new Date().toISOString().slice(0, 10);
    cargarEstadisticas(hoy);
  }
}

// Evento botones del sidebar
buttons.forEach((btn) => {
  btn.addEventListener("click", () => {
    cambiarSeccion(btn.dataset.sectionBtn);
  });
});

// Botón "Nuevo pedido"
const btnNuevoPedido = document.getElementById("btn-nuevo-pedido");
if (btnNuevoPedido) {
  btnNuevoPedido.addEventListener("click", () =>
    cambiarSeccion("nuevo-pedido")
  );
}

// Botón "Volver a pedidos"
const btnVolverPedidos = document.getElementById("btn-volver-pedidos");
if (btnVolverPedidos) {
  btnVolverPedidos.addEventListener("click", () =>
    cambiarSeccion("pedidos")
  );
}

// Configuración inicial de fecha actual (título de pedidos)
const tituloDiaActual = document.getElementById("titulo-dia-actual");
if (tituloDiaActual) {
  const hoy = new Date();
  let textoFecha = hoy.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  textoFecha = textoFecha.replace(",", "").toUpperCase();
  tituloDiaActual.textContent = textoFecha;
}

buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.sectionBtn;
    cambiarSeccion(target);

    if (target === "pedidos") cargarPedidosPorEstado("PENDIENTE");
    if (target === "stock") cargarStockActual();
    if (target === "estadisticas") {
        const hoy = new Date().toISOString().slice(0,10);
        cargarEstadisticas(hoy);
    }
  });
});