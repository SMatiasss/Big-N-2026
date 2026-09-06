import test from 'node:test';
import assert from 'node:assert/strict';
import { rutaClientePorEstado } from '../src/utils/navegacion-cliente.js';

const cliente = { rol: 'cliente_registrado', estado: 'aprobado', activo: true };

test('cliente esperando vuelve a lista de espera sin escanear nuevamente la entrada', () => {
  assert.equal(rutaClientePorEstado({ perfil: cliente, espera: { id: 'e' }, estadia: null, mesaValidada: false }), '/lista-espera');
});

test('cliente asignado sin validar vuelve a lista para escanear su mesa', () => {
  assert.equal(rutaClientePorEstado({ perfil: cliente, espera: null, estadia: { id: 's' }, mesaValidada: false }), '/lista-espera');
});

test('cliente con mesa validada vuelve directamente a la carta', () => {
  assert.equal(rutaClientePorEstado({ perfil: cliente, espera: null, estadia: { id: 's' }, mesaValidada: true }), '/mesa/carta');
});

test('empleados y clientes sin visita conservan su inicio normal', () => {
  assert.equal(rutaClientePorEstado({ perfil: { rol: 'mozo', activo: true }, espera: null, estadia: null, mesaValidada: false }), null);
  assert.equal(rutaClientePorEstado({ perfil: cliente, espera: null, estadia: null, mesaValidada: false }), null);
});
