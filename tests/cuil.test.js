// errorCuil decide qué le dice el alta de empleado al usuario sobre el CUIL:
// tiene que distinguir cada causa y no aceptar CUIL que no pueden existir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { errorCuil, esCuilValido } from '../src/utils/validadores.js';

test('un CUIL válido y coherente con el DNI no tiene error', () => {
  assert.equal(errorCuil('20314279582', '31427958'), null);
  assert.equal(errorCuil('27-29183746-3', '29183746'), null); // con guiones
  assert.equal(esCuilValido('20314279582'), true);
});

test('cada causa tiene su propio mensaje', () => {
  assert.equal(errorCuil('2031427958'), 'CUIL de 11 dígitos.');
  assert.equal(errorCuil(''), 'CUIL de 11 dígitos.');
  assert.equal(errorCuil('99314279582'), 'Prefijo de CUIL inválido.');
  assert.equal(errorCuil('30314279582'), 'Prefijo de CUIL inválido.'); // 30 es de empresa
  assert.equal(errorCuil('20314279582', '31427959'), 'No coincide con el DNI.');
  assert.equal(errorCuil('20314279583'), 'Último dígito inválido.');
});

test('con un DNI inválido no se compara: ese error lo marca el campo DNI', () => {
  assert.equal(errorCuil('20314279582', '123'), null);
});

test('un resto de 10 no es un CUIL posible: se usa el prefijo 23', () => {
  // DNI 27364159 con prefijo 20 da resto 10. Antes se aceptaba como "...-9".
  assert.equal(errorCuil('20273641599'), 'Último dígito inválido.');
  assert.equal(errorCuil('23273641599', '27364159'), null);
  assert.equal(errorCuil('27273641594', '27364159'), null);
});
