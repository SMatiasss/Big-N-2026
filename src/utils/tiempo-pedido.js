const TIEMPO_PREDETERMINADO_MIN = 15;

// Cocina y bar preparan en paralelo: el pedido queda listo cuando termina
// el producto que más demora, no al sumar los tiempos individuales.
export function calcularTiempoEstimadoPedido(items, predeterminado = TIEMPO_PREDETERMINADO_MIN) {
  const tiempos = (items ?? [])
    .map((item) => Number(item?.producto?.tiempo_elaboracion_min ?? item?.productos?.tiempo_elaboracion_min ?? 0))
    .filter((tiempo) => Number.isFinite(tiempo) && tiempo > 0);

  return tiempos.length ? Math.max(...tiempos) : predeterminado;
}

export function formatearTiempoEstimado(minutos) {
  const valor = Number(minutos);
  return Number.isFinite(valor) && valor > 0 ? `${valor} min` : 'No disponible';
}
