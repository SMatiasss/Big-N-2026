import { CarritoService } from '../services/carrito.service.js';

// Punto 13: cuando el mozo rechaza un pedido, el cliente lo modifica -parcial
// o totalmente- en vez de arrancar de cero. Esto arma el carrito (mismo
// formato que usa la carta) a partir de los ítems de ESE pedido, para que la
// pantalla de la carta ya aparezca con lo que tenía. Se ignoran productos
// dados de baja desde entonces: ya no aparecen en la carta y no se pueden
// tocar sus controles de cantidad.
export function precargarCarritoDesdePedido(pedido) {
  const itemsCarrito = (pedido.pedido_items ?? [])
    .filter((item) => item.productos && item.productos.activo !== false)
    .map((item) => ({
      producto: {
        id: item.productos.id,
        nombre: item.productos.nombre,
        precio: item.productos.precio,
        tipo: item.productos.tipo,
        sector: item.productos.sector,
        tiempo_elaboracion_min: item.productos.tiempo_elaboracion_min,
      },
      cantidad: item.cantidad,
    }));
  CarritoService.guardarCarrito(itemsCarrito);
}
