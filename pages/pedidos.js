import { cargarPedidosPorEstado } from "../obtenerPedidos.js"; 
// (o donde tengas implementado el fetch de pedidos)

/* Pedidos.js debe manejar SOLO pedidos */
document.addEventListener("DOMContentLoaded", () => {
  cargarPedidosPorEstado("PENDIENTE");
});




