import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

const listeners = new Map();
const llamadasNativas = [];
const filas = new Map();
let usuarioActual = { id: 'usuario-a' };

globalThis.localStorage = (() => {
  const valores = new Map();
  return {
    getItem: (clave) => valores.get(clave) ?? null,
    setItem: (clave, valor) => valores.set(clave, valor),
    removeItem: (clave) => valores.delete(clave),
  };
})();

mock.module('@capacitor/core', {
  namedExports: { Capacitor: { getPlatform: () => 'android' } },
});

mock.module('@capacitor/push-notifications', {
  namedExports: {
    PushNotifications: {
      addListener: async (nombre, callback) => { listeners.set(nombre, callback); },
      checkPermissions: async () => ({ receive: 'granted' }),
      requestPermissions: async () => ({ receive: 'granted' }),
      createChannel: async () => llamadasNativas.push('createChannel'),
      register: async () => llamadasNativas.push('register'),
      unregister: async () => llamadasNativas.push('unregister'),
      removeAllListeners: async () => { llamadasNativas.push('removeAllListeners'); listeners.clear(); },
    },
  },
});

function consultaTokens() {
  let operacion = '';
  let payload;
  const filtros = [];
  const consulta = {
    upsert(datos) { operacion = 'upsert'; payload = datos; return consulta; },
    delete() { operacion = 'delete'; return consulta; },
    select() { return consulta; },
    eq(columna, valor) { filtros.push([columna, valor]); return consulta; },
    async single() {
      filas.set(payload.token, payload);
      return { data: { id: 'fila', ...payload, creado_en: 'ahora' }, error: null };
    },
    then(resolver, rechazar) {
      const resultado = (() => {
        if (operacion === 'delete') {
          for (const [token, fila] of filas) {
            if (filtros.every(([campo, valor]) => (campo === 'token' ? token : fila[campo]) === valor)) filas.delete(token);
          }
        }
        return { data: null, error: null };
      })();
      return Promise.resolve(resultado).then(resolver, rechazar);
    },
  };
  return consulta;
}

const supabase = {
  auth: {
    getUser: async () => ({ data: { user: usuarioActual }, error: null }),
    getSession: async () => ({ data: { session: { user: usuarioActual } }, error: null }),
  },
  from: (tabla) => {
    assert.equal(tabla, 'push_tokens');
    return consultaTokens();
  },
  functions: { invoke: async () => ({ data: {}, error: null }) },
};

mock.module('../src/services/supabase.client.js', {
  namedExports: { getSupabase: () => supabase },
});
mock.module('../src/router.js', { namedExports: { navegarA: () => {} } });

const push = await import('../src/services/notificaciones.service.js');

test('registra, elimina al salir y permite registrar otro usuario en el mismo dispositivo', async () => {
  const perfilA = { id: 'usuario-a', rol: 'dueno', estado: 'aprobado', activo: true };
  assert.equal(await push.iniciarPushAdministracion(perfilA), true);
  await listeners.get('registration')({ value: 'token-a' });

  assert.equal(filas.get('token-a').usuario_id, 'usuario-a');
  assert.match(localStorage.getItem('big-n.push-token-actual'), /token-a/);

  await push.borrarTokenActual();
  assert.equal(filas.has('token-a'), false);
  assert.equal(localStorage.getItem('big-n.push-token-actual'), null);
  assert.ok(llamadasNativas.includes('unregister'));

  usuarioActual = { id: 'usuario-b' };
  const perfilB = { id: 'usuario-b', rol: 'supervisor', estado: 'aprobado', activo: true };
  assert.equal(await push.iniciarPushAdministracion(perfilB), true);
  await listeners.get('registration')({ value: 'token-b' });

  assert.equal(filas.get('token-b').usuario_id, 'usuario-b');
  assert.equal(filas.has('token-a'), false);
});

