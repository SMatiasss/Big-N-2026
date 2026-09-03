import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarQrMesa, validarMensaje, ordenarFotosProducto, haySaltoEnHistorial } from '../src/utils/hu11.js';

let llamadas, resultado, evento, suscripcion, retirados;
const cliente = {
  rpc: async (nombre, args) => { llamadas.push({ nombre, args }); return resultado; },
  channel: () => ({
    on(_tipo, filtro, fn) { evento = { filtro, fn }; return this; },
    subscribe(fn) { suscripcion = fn; return this; },
  }),
  removeChannel: async () => { retirados++; },
};
mock.module('../src/services/supabase.client.js', { namedExports: { getSupabase: () => cliente } });
const mesa = await import('../src/services/mesa-cliente.service.js');
const chat = await import('../src/services/mensajes.service.js');
beforeEach(() => { llamadas = []; resultado = { data: [], error: null }; retirados = 0; });
const uuid = '12345678-abcd-1234-abcd-123456789012';

test('QR admite formato del equipo y UUID, pero no QR de ingreso/URL/texto', () => {
  assert.equal(normalizarQrMesa(` mesa:${uuid.toUpperCase()} `), uuid);
  assert.equal(normalizarQrMesa(uuid), uuid);
  for (const qr of ['', null, '7', `ingreso:${uuid}`, `https://ejemplo.invalid/${uuid}`]) {
    assert.throws(() => normalizarQrMesa(qr));
  }
});
test('validación de QR no manda identidad ni reasigna mesa', async () => {
  await mesa.validarQrMesaAsignada(`mesa:${uuid}`);
  assert.deepEqual(llamadas, [{ nombre: 'hu11_validar_qr_mesa', args: { p_token: uuid } }]);
});
test('QR malformado no llama al backend', () => {
  assert.throws(() => mesa.validarQrMesaAsignada('mesa:7'));
  assert.equal(llamadas.length, 0);
});
test('sin migración falla cerrado sin fallback a mensajes directos', async () => {
  resultado = { error: { code: 'PGRST202' } };
  await assert.rejects(mesa.obtenerContextoMesa(), /migración/);
  assert.equal(llamadas.length, 1);
});
test('rechazo de autorización del servidor se conserva', async () => {
  resultado = { error: { code: '42501', message: 'Sin acceso' } };
  await assert.rejects(mesa.obtenerContextoMesa(uuid), error => error.code === '42501');
});
test('mensaje obligatorio, tipado y máximo 1000 caracteres Unicode', () => {
  for (const m of ['', ' \n\t ', null, 22, {}]) assert.throws(() => validarMensaje(m));
  assert.equal(validarMensaje(' hola '), 'hola');
  assert.equal(validarMensaje('😀'.repeat(1000)), '😀'.repeat(1000));
  assert.throws(() => validarMensaje('a'.repeat(1001)));
});
test('enviar usa RPC y conserva ID en reintento; nunca manda autor/fecha', async () => {
  const intento = { estadiaId: uuid, cuerpo: ' Hola ', id: uuid };
  await chat.enviarMensaje(intento);
  await chat.enviarMensaje(intento);
  assert.deepEqual(llamadas[0], llamadas[1]);
  assert.deepEqual(llamadas[0].args, { p_estadia_id: uuid, p_cuerpo: 'Hola', p_id: uuid });
});
test('vacío no llega a persistencia', async () => {
  await assert.rejects(chat.enviarMensaje({ estadiaId: uuid, cuerpo: '\t' }));
  assert.equal(llamadas.length, 0);
});
test('historial usa paginación estable por fecha real e ID', async () => {
  await chat.listarMensajes(uuid, { id: uuid, creado_en: '2026-09-02T12:00:00Z' });
  assert.deepEqual(llamadas[0].args, { p_estadia_id: uuid, p_antes: '2026-09-02T12:00:00Z', p_antes_id: uuid });
});
test('fotos se ordenan 1/2/3 y no se inventan faltantes', () => {
  assert.deepEqual(ordenarFotosProducto([{ orden: 3, url: 'c' }, { orden: 1, url: 'a' }]), ['a', null, 'c']);
  assert.deepEqual(ordenarFotosProducto(), [null, null, null]);
});
test('reconexión con más de una página perdida vuelve a habilitar historial anterior', () => {
  const nuevos = Array.from({length:100},(_,i)=>({id:`nuevo-${i}`}));
  assert.equal(haySaltoEnHistorial([{id:'viejo'}],nuevos),true);
  assert.equal(haySaltoEnHistorial([{id:'nuevo-0'}],nuevos),false);
  assert.equal(haySaltoEnHistorial([],nuevos),false);
  assert.equal(haySaltoEnHistorial([{id:'viejo'}],nuevos.slice(1)),false);
});
test('Realtime limita cliente a estadía y libera eventos al salir', () => {
  let actualizaciones = 0;
  const cancelar = chat.suscribirseAMensajes(uuid, () => actualizaciones++);
  assert.equal(evento.filtro.filter, `estadia_id=eq.${uuid}`);
  suscripcion('SUBSCRIBED'); evento.fn();
  assert.equal(actualizaciones, 2);
  cancelar(); cancelar(); evento.fn(); suscripcion('SUBSCRIBED');
  assert.equal(actualizaciones, 2);
  assert.equal(retirados, 1);
});
