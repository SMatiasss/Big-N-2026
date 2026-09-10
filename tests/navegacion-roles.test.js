import test from 'node:test';
import assert from 'node:assert/strict';
import { obtenerAccionesHome, puedeAccederRuta } from '../src/config/navegacion.js';
import { completarCredenciales } from '../src/utils/login-rapido.js';
import { readFile } from 'node:fs/promises';

test('ingreso rápido solamente completa credenciales', () => {
  const email = { value: '' };
  const password = { value: '' };
  let ingresos = 0;
  completarCredenciales({
    cuenta: { email: 'dueno@larosaria.com' },
    password: '123456',
    inputEmail: email,
    inputPassword: password,
  });
  assert.equal(email.value, 'dueno@larosaria.com');
  assert.equal(password.value, '123456');
  assert.equal(ingresos, 0);
});

test('la demostración está separada del acceso normal y visible como acceso rápido', async () => {
  const login = await readFile(new URL('../src/pages/auth/login/index.js', import.meta.url), 'utf8');
  assert.match(login, /Acceso rápido/);
  assert.match(login, /id="panel-demostracion"/);
  assert.doesNotMatch(login, /id="panel-demostracion" hidden/);
  assert.match(login, /La sesión comienza al presionar/);
  assert.match(login, /Registrate aquí/);
  assert.match(login, /Ingresar como cliente anónimo/);
});

test('cada rol recibe sólo sus acciones operativas implementadas', () => {
  const rutas = (rol) => {
    const acciones = obtenerAccionesHome(rol);
    return [...acciones.principales, ...acciones.secundarias].map((accion) => accion.ruta).filter(Boolean);
  };
  assert.deepEqual(rutas('cocinero'), ['/productos']);
  assert.deepEqual(rutas('cantinero'), ['/productos']);
  assert.deepEqual(rutas('mozo'), ['/pedidos/consulta', '/pedidos/confirmacion', '/mesas']);
  assert.deepEqual(rutas('metre'), ['/lista-espera/metre', '/mesas', '/clientes/alta']);
  assert.ok(rutas('dueno').includes('/clientes/aprobacion'));
  assert.ok(!rutas('dueno').some((ruta) => ruta.includes('/pedidos/cocina')));
});

test('permisos por ruta rechazan accesos manuales de otro rol', () => {
  assert.equal(puedeAccederRuta('/clientes/aprobacion', 'dueno'), true);
  assert.equal(puedeAccederRuta('/clientes/aprobacion', 'mozo'), false);
  assert.equal(puedeAccederRuta('/empleados/alta-empleado', 'supervisor'), true);
  assert.equal(puedeAccederRuta('/empleados/alta-empleado', 'metre'), false);
  assert.equal(puedeAccederRuta('/pedidos/consulta', 'cliente_registrado'), true);
  assert.equal(puedeAccederRuta('/pedidos/cocina', 'cocinero'), false);
});
