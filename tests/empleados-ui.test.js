import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('empleados solicita foto real y vuelve al listado después del alta', async () => {
  const servicio = await readFile(new URL('../src/services/perfiles.service.js', import.meta.url), 'utf8');
  const listado = await readFile(new URL('../src/pages/empleados/listado-empleados/index.js', import.meta.url), 'utf8');
  const alta = await readFile(new URL('../src/pages/empleados/alta-empleado/index.js', import.meta.url), 'utf8');
  assert.match(servicio, /nombres, apellidos, rol, estado, foto_url/);
  assert.match(listado, /new URL\(empleado\.foto_url\)/);
  assert.match(listado, /Las iniciales quedan como respaldo/);
  assert.match(alta, /navegarA\('\/empleados'\)/);
  assert.doesNotMatch(alta, /placehold\.co\/200x200\/png\?text=Empleado/);
});
