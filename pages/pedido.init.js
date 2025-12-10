import { cargarPedidosPorEstado, crearPedido, resetFormularioPedido } from "./obtenerPedidos.js";
import { cambiarSeccionDesdeJS } from "../components/sidebar.js";

document.addEventListener("DOMContentLoaded", () => {

  // ===============================
  // 🔸 SELECTOR TIPO DE VENTA (nuevo pedido)
  // ===============================
  const tipoVentaSelect = document.getElementById("tipo-venta-nuevo-pedido");
  if (tipoVentaSelect) {
    tipoVentaSelect.addEventListener("change", actualizarCamposVenta);
  }

  // ===============================
  // 🔸 BOTÓN NUEVO PEDIDO
  // ===============================
  const btnNuevoPedido = document.getElementById("btn-nuevo-pedido");
  if (btnNuevoPedido) {
    btnNuevoPedido.addEventListener("click", () => {
      cambiarSeccionDesdeJS("nuevo-pedido");

      // Esperar a que se muestre la sección → luego actualizar campos
      setTimeout(() => {
        actualizarCamposVenta();
      }, 50);
    });
  }

  // ===============================
  // 🔸 BOTÓN VOLVER A PEDIDOS
  // ===============================
  const btnVolver = document.getElementById("btn-volver-pedidos");
  if (btnVolver) {
    btnVolver.addEventListener("click", () => {
      cambiarSeccionDesdeJS("pedidos");

      cargarPedidosPorEstado("PENDIENTE");
    });
  }

  // ===============================
  // 🔸 BOTÓN CREAR PEDIDO
  // ===============================
  const btnCrear = document.getElementById("btn-crear-pedido");
  if (btnCrear) {
    btnCrear.addEventListener("click", crearPedido);
  }
  actualizarTituloFecha();  // ⬅ Aca
});


// ------------------------------
// FUNCIÓN QUE CONTROLA LOS CAMPOS
// ------------------------------
function actualizarCamposVenta() {

  const tipoVenta = document.getElementById("tipo-venta-nuevo-pedido").value;

  const campoNumero = document.getElementById("campo-numero-pedido");
  const inputNumero = document.getElementById("numero-pedido");

  const campoHora = document.getElementById("campo-hora-entrega");
  const inputHora = document.getElementById("hora-entrega");

  const esPy = tipoVenta === "PEDIDOS_YA";
  const esParticular = tipoVenta === "PARTICULAR";

  // ----- PEDIDOS YA -----
  inputNumero.disabled = !esPy;
  campoNumero.classList.toggle("opacity-50", !esPy);

  // ----- PARTICULAR -----
  inputHora.disabled = !esParticular;
  campoHora.classList.toggle("opacity-50", !esParticular);
}

// ------------------------------
// FUNCIÓN QUE ACTUALIZA FECHA ACTUAL
// ------------------------------

function actualizarTituloFecha() {
  const titulo = document.getElementById("titulo-fecha");
  if (!titulo) return;

  const fecha = new Date();

  const dias = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  const meses = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
  ];

  const diaSemana = dias[fecha.getDay()];
  const dia = fecha.getDate();
  const mes = meses[fecha.getMonth()];
  const año = fecha.getFullYear();

  titulo.textContent = `${diaSemana} ${dia} de ${mes} de ${año}`;
}


export function animarTituloFecha() {
  const titulo = document.getElementById("titulo-fecha");
  if (!titulo) {
    console.warn("⛔ No se encontró #titulo-fecha en el DOM");
    return;
  }

  const fecha = new Date();
  const opciones = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  };

  let texto = fecha.toLocaleDateString("es-AR", opciones);
  texto = texto.replace(",", "");

  // escribir fecha
  titulo.textContent = texto;

  // animación
  titulo.classList.remove("visible");
  void titulo.offsetWidth;
  titulo.classList.add("visible");
}


 