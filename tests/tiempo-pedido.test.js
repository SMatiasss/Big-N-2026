import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularTiempoEstimadoPedido, formatearTiempoEstimado } from '../src/utils/tiempo-pedido.js';

test('usa el producto más lento porque los sectores preparan en paralelo', () => {
  const items = [
    { producto: { tiempo_elaboracion_min: 12 }, cantidad: 2 },
    { producto: { tiempo_elaboracion_min: 25 }, cantidad: 1 },
    { producto: { tiempo_elaboracion_min: 8 }, cantidad: 3 },
  ];
  assert.equal(calcularTiempoEstimadoPedido(items), 25);
});

test('admite productos recuperados desde un pedido y aplica respaldo', () => {
  assert.equal(calcularTiempoEstimadoPedido([{ productos: { tiempo_elaboracion_min: '18' } }]), 18);
  assert.equal(calcularTiempoEstimadoPedido([]), 15);
  assert.equal(calcularTiempoEstimadoPedido([{ producto: { tiempo_elaboracion_min: null } }]), 15);
});

test('formatea el tiempo para las pantallas', () => {
  assert.equal(formatearTiempoEstimado(20), '20 min');
  assert.equal(formatearTiempoEstimado(null), 'No disponible');
});
