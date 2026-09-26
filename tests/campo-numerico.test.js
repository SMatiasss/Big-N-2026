// soloNumeros limpia lo que se tipea o pega en precio y tiempo, y avisa sólo
// cuando había algo que no era un número.
import test from 'node:test';
import assert from 'node:assert/strict';
import { soloNumeros } from '../src/utils/campo-numerico.js';

// Un input mínimo: valor + un único listener de 'input'.
function escribir(valor, opciones) {
  let avisos = 0;
  let manejador;
  const input = { value: valor, addEventListener: (_tipo, fn) => { manejador = fn; } };
  soloNumeros(input, { ...opciones, alInvalido: () => { avisos += 1; } });
  manejador({ stopImmediatePropagation() {} });
  return { valor: input.value, avisos };
}

test('tiempo: sólo dígitos; lo demás se descarta y avisa', () => {
  assert.deepEqual(escribir('15'), { valor: '15', avisos: 0 });
  assert.deepEqual(escribir('1a5 min'), { valor: '15', avisos: 1 });
  assert.deepEqual(escribir('2.5'), { valor: '25', avisos: 1 });
});

test('precio: admite un decimal, con coma o punto, sin avisar', () => {
  const decimales = { decimales: true };
  assert.deepEqual(escribir('1200', decimales), { valor: '1200', avisos: 0 });
  assert.deepEqual(escribir('12,50', decimales), { valor: '12.50', avisos: 0 });
  assert.deepEqual(escribir('$ 1.200', decimales), { valor: '1.200', avisos: 1 });
  assert.deepEqual(escribir('1.2.3', decimales), { valor: '1.23', avisos: 1 });
});
