import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { obtenerMotivoBloqueo, puedeResolverClientes } from '../src/utils/acceso-perfil.js';

const base = { id: 'actor', rol: 'cliente_registrado', estado: 'aprobado', activo: true };
let perfil, sesion, resultado, correo, consultas, cierres, llamadasEmail;
const cliente = {
  auth: {
    getUser: async () => ({ data: { user: { id: 'actor' } }, error: null }),
    getSession: async () => ({ data: { session: sesion }, error: null }),
    signInWithPassword: async () => ({ data: { session: sesion }, error: null }),
    signOut: async () => { cierres++; sesion = null; return { error: null }; },
  },
  from(tabla) {
    const pasos = [['from', tabla]];
    consultas.push(pasos);
    let esActualizacion = false;
    const q = {
      select: (...args) => { pasos.push(['select', ...args]); return q; },
      eq: (...args) => { pasos.push(['eq', ...args]); return q; },
      order: (...args) => { pasos.push(['order', ...args]); return q; },
      update: (...args) => { esActualizacion = true; pasos.push(['update', ...args]); return q; },
      maybeSingle: async () => esActualizacion ? resultado : { data: perfil, error: null },
      then: (ok, fail) => Promise.resolve(resultado).then(ok, fail),
    };
    return q;
  },
  functions: { invoke: async () => { llamadasEmail++; return correo; } },
};
mock.module('../src/services/supabase.client.js', { namedExports: { getSupabase: () => cliente } });
const auth = await import('../src/services/auth.service.js');
const servicio = await import('../src/services/aprobacion-clientes.service.js');

beforeEach(() => {
  perfil = { ...base, rol: 'dueno' };
  sesion = { user: { id: 'actor' } };
  resultado = { data: { id: 'cliente', estado: 'aprobado' }, error: null };
  correo = { data: { ok: true }, error: null };
  consultas = []; cierres = 0; llamadasEmail = 0;
});

test('cliente pendiente/rechazado bloqueado; aprobado habilitado', () => {
  assert.equal(obtenerMotivoBloqueo(base), '');
  for (const estado of ['pendiente', 'rechazado', 'desconocido']) {
    assert.ok(obtenerMotivoBloqueo({ ...base, estado }));
  }
  assert.ok(obtenerMotivoBloqueo(null));
  assert.ok(obtenerMotivoBloqueo({ ...base, activo: false }));
});
test('anónimo activo exento de aprobación', () => {
  assert.equal(obtenerMotivoBloqueo({ ...base, rol: 'cliente_anonimo', estado: 'pendiente' }), '');
});
test('sólo dueño/supervisor activos y aprobados administran', () => {
  for (const rol of ['dueno', 'supervisor']) assert.ok(puedeResolverClientes({ ...base, rol }));
  for (const rol of ['cliente_registrado', 'cliente_anonimo', 'metre', 'mozo', 'cocinero', 'cantinero', 'admin']) {
    assert.equal(puedeResolverClientes({ ...base, rol }), false);
  }
  assert.equal(puedeResolverClientes({ ...base, rol: 'dueno', activo: false }), false);
  assert.equal(puedeResolverClientes({ ...base, rol: 'dueno', estado: 'pendiente' }), false);
});
test('login pendiente cierra sesión local y rechaza acceso', async () => {
  perfil = { ...base, estado: 'pendiente' };
  await assert.rejects(auth.signIn('test@example.invalid', 'no-real'), /pendiente/);
  assert.equal(cierres, 1);
});
test('sesión restaurada rechazada también se bloquea', async () => {
  perfil = { ...base, estado: 'rechazado' };
  await assert.rejects(auth.verificarAccesoSesion(), /rechazado/);
});
test('sesión aprobada y ausencia de sesión', async () => {
  perfil = base;
  assert.ok(await auth.verificarAccesoSesion());
  sesion = null;
  assert.equal(await auth.verificarAccesoSesion(), null);
});
test('listado filtra clientes registrados pendientes sin PII innecesaria', async () => {
  resultado = { data: [], error: null };
  assert.deepEqual(await servicio.listarClientesPendientes(), []);
  const q = consultas.at(-1);
  assert.ok(q.some(p => p[0] === 'eq' && p[1] === 'rol' && p[2] === 'cliente_registrado'));
  assert.ok(q.some(p => p[0] === 'eq' && p[1] === 'estado' && p[2] === 'pendiente'));
  assert.equal(q.find(p => p[0] === 'select')[1], 'id, nombres, apellidos, foto_url, estado');
});
test('actor no autorizado no lista ni modifica clientes', async () => {
  perfil = { ...base, rol: 'metre' };
  await assert.rejects(servicio.listarClientesPendientes(), /Sólo dueño/);
  await assert.rejects(servicio.listarClientesAceptados(), /Sólo dueño/);
  await assert.rejects(servicio.resolverClientePendiente('cliente', 'aprobado'), /Sólo dueño/);
  assert.equal(consultas.flat().some(p => p[0] === 'update'), false);
});

test('aceptados consulta sólo clientes registrados aprobados', async () => {
  resultado = { data: [], error: null };
  assert.deepEqual(await servicio.listarClientesAceptados(), []);
  const q = consultas.at(-1);
  assert.ok(q.some(p => p[0] === 'eq' && p[1] === 'rol' && p[2] === 'cliente_registrado'));
  assert.ok(q.some(p => p[0] === 'eq' && p[1] === 'estado' && p[2] === 'aprobado'));
});
test('decisión condicional y autor de resolución', async () => {
  const res = await servicio.resolverClientePendiente('cliente', 'aprobado');
  assert.equal(res.emailEnviado, true);
  const q = consultas.at(-1);
  assert.ok(q.some(p => p[0] === 'eq' && p[1] === 'estado' && p[2] === 'pendiente'));
  assert.ok(q.some(p => p[0] === 'eq' && p[1] === 'id' && p[2] === 'cliente'));
  assert.equal(q.find(p => p[0] === 'update')[1].resuelto_por, 'actor');
});
test('concurrencia: cero filas no envía email', async () => {
  resultado = { data: null, error: null };
  await assert.rejects(servicio.resolverClientePendiente('cliente', 'rechazado'), /ya fue resuelto/);
  assert.equal(llamadasEmail, 0);
});
test('error RLS no envía correo', async () => {
  resultado = { data: null, error: new Error('RLS') };
  await assert.rejects(servicio.resolverClientePendiente('cliente', 'rechazado'), /RLS/);
  assert.equal(llamadasEmail, 0);
});
test('correo fallido o placeholder no finge envío ni revierte decisión', async () => {
  for (const respuesta of [{ data: null, error: new Error('sin despliegue') }, { data: { enviado: true }, error: null }]) {
    correo = respuesta;
    const res = await servicio.resolverClientePendiente('cliente', 'rechazado');
    assert.equal(res.emailEnviado, false);
    assert.equal(res.cliente.id, 'cliente');
  }
});
test('estado inválido rechazado antes de consultar', async () => {
  await assert.rejects(servicio.resolverClientePendiente('cliente', 'pendiente'), /decisión/);
  assert.equal(consultas.length, 0);
});

test('Realtime escucha cambios de clientes y sincroniza al conectar/reconectar', () => {
  let evento, estadoCanal, filtro;
  let cambios = 0;
  const estados = [];
  const canal = {
    on(tipo, opciones, callback) {
      assert.equal(tipo, 'postgres_changes');
      filtro = opciones; evento = callback; return canal;
    },
    subscribe(callback) { estadoCanal = callback; return canal; },
  };
  cliente.channel = () => canal;
  cliente.removeChannel = async () => 'ok';
  const detener = servicio.observarClientesPendientes(() => cambios++, e => estados.push(e));
  assert.deepEqual(filtro, {
    event: '*', schema: 'public', table: 'perfiles', filter: 'rol=eq.cliente_registrado',
  });
  estadoCanal('SUBSCRIBED');
  evento({ eventType: 'INSERT' });
  evento({ eventType: 'UPDATE' });
  estadoCanal('CHANNEL_ERROR');
  estadoCanal('SUBSCRIBED');
  assert.equal(cambios, 4);
  assert.deepEqual(estados, ['SUBSCRIBED', 'CHANNEL_ERROR', 'SUBSCRIBED']);
  detener();
});

test('salir cierra el canal una sola vez e ignora eventos tardíos', () => {
  let evento, estadoCanal, eliminados = 0, cambios = 0;
  const canal = {
    on(tipo, filtro, callback) { evento = callback; return canal; },
    subscribe(callback) { estadoCanal = callback; return canal; },
  };
  cliente.channel = () => canal;
  cliente.removeChannel = async (actual) => { assert.equal(actual, canal); eliminados++; };
  const detener = servicio.observarClientesPendientes(() => cambios++);
  detener(); detener();
  evento(); estadoCanal('SUBSCRIBED');
  assert.equal(eliminados, 1);
  assert.equal(cambios, 0);
});
