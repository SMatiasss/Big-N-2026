// ROLES (src/config/constantes.js) tiene que ser exactamente el enum
// rol_usuario de la base. Si se desfasan, una comparación contra un rol que no
// existe da siempre falso sin ningún error (pasó con ROLES.CLIENTE = 'cliente').
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ROLES } from '../src/config/constantes.js';

test('ROLES coincide exactamente con el enum rol_usuario', async () => {
  const esquema = await readFile(
    new URL('../supabase/migrations/01_schema.sql', import.meta.url), 'utf8');

  const definicion = esquema.match(/create type rol_usuario as enum \(([^)]*)\)/i);
  assert.ok(definicion, 'No se encontró el enum rol_usuario en 01_schema.sql');

  const enumBase = [...definicion[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(Object.values(ROLES).sort(), enumBase);
});
