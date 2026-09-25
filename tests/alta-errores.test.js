// Traducción de los errores del alta de perfiles: es la que decide qué campo
// se le señala al usuario, así que conviene que no se rompa en silencio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mensajeDeErrorAlta } from '../src/utils/errores-alta.js';

function conMarcas(error) {
  const marcados = {};
  const mensaje = mensajeDeErrorAlta(error, {
    marcarCampo: (campo, texto) => { marcados[campo] = texto; },
  });
  return { mensaje, marcados };
}

test('el choque de unicidad señala el campo exacto, no "DNI o CUIL"', () => {
  const dni = conMarcas({
    code: '23505',
    message: 'duplicate key value violates unique constraint "uq_perfiles_dni"',
  });
  assert.match(dni.mensaje, /DNI/);
  assert.equal(dni.marcados.dni, 'Ese DNI ya está registrado.');
  assert.equal(dni.marcados.cuil, undefined);

  const cuil = conMarcas({
    code: '23505',
    message: 'duplicate key value violates unique constraint "uq_perfiles_cuil"',
  });
  assert.match(cuil.mensaje, /CUIL/);
  assert.equal(cuil.marcados.cuil, 'Ese CUIL ya está registrado.');
  assert.equal(cuil.marcados.dni, undefined);
});

test('un 23505 de otra restricción no inventa un campo', () => {
  const { marcados } = conMarcas({ code: '23505', message: 'algo_desconocido' });
  assert.deepEqual(marcados, {});
});

test('el correo ya usado en Auth señala el campo correo', () => {
  const { mensaje, marcados } = conMarcas({ message: 'User already registered' });
  assert.match(mensaje, /correo/i);
  assert.ok(marcados.email);
});

test('un error sin código ni patrón conocido no rompe y devuelve su mensaje', () => {
  assert.equal(mensajeDeErrorAlta({ message: 'Falló la red' }).mensaje, undefined);
  assert.equal(mensajeDeErrorAlta({ message: 'Falló la red' }), 'Falló la red');
  assert.match(mensajeDeErrorAlta({}), /No se pudo completar el alta/);
  assert.match(mensajeDeErrorAlta(null), /No se pudo completar el alta/);
});
