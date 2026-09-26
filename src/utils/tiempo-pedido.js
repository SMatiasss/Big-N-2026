const TIEMPO_PREDETERMINADO_MIN = 15;

// El requisito pide el tiempo total del pedido y que cambie junto con las
// cantidades. Cada unidad aporta el tiempo de elaboración de su producto.
export function calcularTiempoEstimadoPedido(items, predeterminado = TIEMPO_PREDETERMINADO_MIN) {
  const tiempos = (items ?? []).map((item) => {
    const tiempo = Number(item?.producto?.tiempo_elaboracion_min ?? item?.productos?.tiempo_elaboracion_min ?? 0);
    const cantidadInformada = Number(item?.cantidad ?? 1);
    const cantidad = Number.isFinite(cantidadInformada) && cantidadInformada > 0 ? cantidadInformada : 1;
    return Number.isFinite(tiempo) && tiempo > 0 ? tiempo * cantidad : 0;
  });

  const total = tiempos.reduce((suma, tiempo) => suma + tiempo, 0);
  return total > 0 ? total : predeterminado;
}

export function formatearTiempoEstimado(minutos) {
  const valor = Number(minutos);
  return Number.isFinite(valor) && valor > 0 ? `${valor} min` : 'No disponible';
}
