import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getSupabase } from './supabase.client.js';
import { ROLES } from '../config/constantes.js';
import { navegarA } from '../router.js';

let tokenActual = null;
let inicializado = false;
let accionesEscuchadas = false;

// HU09/10: banderas propias para no interferir con iniciarPushAdministracion.
// Nunca coinciden en la misma sesión porque dueño/supervisor, metre y
// cliente_(anonimo|registrado) son roles mutuamente excluyentes; comparten
// tokenActual y borrarTokenActual porque sólo hace falta borrar el token que
// esa sesión efectivamente haya registrado, sea cual sea.
let inicializadoListaEspera = false;
let inicializadoCliente = false;

// Rutas a las que puede llevar un toque sobre la notificación (o el botón
// "Ver" mientras la app está en primer plano). Cada HU agrega la suya acá.
const RUTAS_NOTIFICACION = ['/clientes/aprobacion', '/lista-espera/metre', '/lista-espera'];

function mostrarAvisoEnPrimerPlano(notification) {
  const toast = document.createElement('ion-toast');
  toast.header = notification.title || 'Nuevo aviso';
  toast.message = notification.body || 'Tenés una nueva notificación.';
  toast.duration = 5000;
  toast.position = 'top';
  const ruta = notification.data?.ruta;
  toast.buttons = RUTAS_NOTIFICACION.includes(ruta)
    ? [{ text: 'Ver', handler: () => navegarA(ruta) }]
    : [];
  document.body.appendChild(toast);
  toast.present();
}

async function abrirRutaDeNotificacion(ruta) {
  if (!RUTAS_NOTIFICACION.includes(ruta)) return;

  // Al arrancar desde la bandeja, getSession() puede encontrar primero los
  // datos locales mientras Auth todavía no está listo para getUser(). La ruta
  // protegida sólo se abre cuando Supabase ya validó al usuario de la sesión.
  for (let intento = 0; intento < 20; intento += 1) {
    const supabase = getSupabase();
    const { data: datosSesion } = await supabase.auth.getSession();
    if (datosSesion.session) {
      const { data: datosUsuario, error: errorUsuario } = await supabase.auth.getUser();
      if (!errorUsuario && datosUsuario.user) {
        navegarA(ruta);
        return;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  navegarA('/login');
}

// Este listener se instala al arrancar la aplicación, antes de cargar el perfil.
// Android puede entregar el toque de una notificación inmediatamente durante un
// arranque en frío; si esperamos a renderizar el login, ese evento puede perderse.
export async function escucharAccionesPush() {
  if (accionesEscuchadas || Capacitor.getPlatform() !== 'android') return false;
  await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    void abrirRutaDeNotificacion(notification.data?.ruta);
  });
  accionesEscuchadas = true;
  return true;
}

export async function guardarPushToken(usuarioId, token, plataforma = 'android') {
  if (!usuarioId || !token || !['android', 'ios', 'web'].includes(plataforma)) throw new Error('Token push inválido.');
  const { data: { user }, error: errorUsuario } = await getSupabase().auth.getUser();
  if (errorUsuario) throw errorUsuario;
  if (user?.id !== usuarioId) throw new Error('Sólo podés registrar tu propio dispositivo.');
  const { data, error } = await getSupabase().from('push_tokens')
    .upsert({ usuario_id: usuarioId, token, plataforma }, { onConflict: 'token' })
    .select('id, usuario_id, plataforma, creado_en').single();
  if (error) throw error;
  return data;
}

export async function borrarTokenActual() {
  const tokenAEliminar = tokenActual;
  tokenActual = null;
  inicializado = false;
  inicializadoListaEspera = false;
  inicializadoCliente = false;
  if (Capacitor.getPlatform() === 'android') {
    await PushNotifications.removeAllListeners();
    accionesEscuchadas = false;
  }
  if (!tokenAEliminar) return;
  const { error } = await getSupabase().from('push_tokens').delete().eq('token', tokenAEliminar);
  if (error) throw error;
}

export async function listarNotificaciones(usuarioId) {
  const { data: { user }, error: errorUsuario } = await getSupabase().auth.getUser();
  if (errorUsuario) throw errorUsuario;
  if (user?.id !== usuarioId) throw new Error('Sólo podés consultar tus propias notificaciones.');
  const { data, error } = await getSupabase().from('notificaciones')
    .select('id, destinatario_id, titulo, cuerpo, tipo, datos, leida, creado_en')
    .eq('destinatario_id', usuarioId).order('creado_en', { ascending: false });
  if (error) throw error;
  return data;
}

// Compatibilidad con los avisos persistidos de otros flujos. RLS decide si el
// actor puede crear la fila; esta función no envía por sí sola un push nativo.
export async function enviarNotificacion(notificacion) {
  const { data, error } = await getSupabase().from('notificaciones')
    .insert(notificacion)
    .select('id, destinatario_id, titulo, cuerpo, tipo, datos, leida, creado_en').single();
  if (error) throw error;
  return data;
}

export async function iniciarPushAdministracion(perfil) {
  const autorizado = [ROLES.DUENO, ROLES.SUPERVISOR].includes(perfil?.rol)
    && perfil.activo && perfil.estado === 'aprobado';
  if (!autorizado || inicializado || Capacitor.getPlatform() !== 'android') return false;
  inicializado = true;
  await escucharAccionesPush();
  await PushNotifications.addListener('registration', async ({ value }) => {
    tokenActual = value;
    try { await guardarPushToken(perfil.id, value, 'android'); }
    catch (error) {
      inicializado = false;
      console.error('No se pudo registrar este dispositivo para avisos.', error);
    }
  });
  await PushNotifications.addListener('registrationError', error => {
    inicializado = false;
    console.error('Android no pudo registrar las notificaciones.', error);
  });
  await PushNotifications.addListener('pushNotificationReceived', mostrarAvisoEnPrimerPlano);
  const permiso = await PushNotifications.checkPermissions();
  const estado = permiso.receive === 'prompt'
    ? (await PushNotifications.requestPermissions()).receive : permiso.receive;
  if (estado !== 'granted') {
    inicializado = false;
    return false;
  }
  await PushNotifications.createChannel({
    id: 'clientes-pendientes',
    name: 'Clientes pendientes',
    description: 'Avisos para aprobar o rechazar nuevos clientes.',
    importance: 5,
    visibility: 1,
    vibration: true,
  });
  await PushNotifications.register();
  return true;
}

export async function avisarNuevoClientePendiente() {
  const { data, error } = await getSupabase().functions.invoke('enviar-push', { body: {} });
  if (error) throw error;
  return data;
}

// HU09: el metre necesita recibir un push cuando un cliente se anota en la
// lista de espera. Función independiente de iniciarPushAdministracion (que
// sigue siendo sólo para dueño/supervisor) para no acoplar ambos flujos:
// mismo patrón, canal y destinatario distintos.
export async function iniciarPushListaEspera(perfil) {
  const autorizado = perfil?.rol === ROLES.METRE && perfil.activo && perfil.estado === 'aprobado';
  if (!autorizado || inicializadoListaEspera || Capacitor.getPlatform() !== 'android') return false;
  inicializadoListaEspera = true;
  await escucharAccionesPush();
  await PushNotifications.addListener('registration', async ({ value }) => {
    tokenActual = value;
    try { await guardarPushToken(perfil.id, value, 'android'); }
    catch (error) {
      inicializadoListaEspera = false;
      console.error('No se pudo registrar este dispositivo para avisos de lista de espera.', error);
    }
  });
  await PushNotifications.addListener('registrationError', error => {
    inicializadoListaEspera = false;
    console.error('Android no pudo registrar las notificaciones.', error);
  });
  await PushNotifications.addListener('pushNotificationReceived', mostrarAvisoEnPrimerPlano);
  const permiso = await PushNotifications.checkPermissions();
  const estado = permiso.receive === 'prompt'
    ? (await PushNotifications.requestPermissions()).receive : permiso.receive;
  if (estado !== 'granted') {
    inicializadoListaEspera = false;
    return false;
  }
  await PushNotifications.createChannel({
    id: 'lista-espera-metre',
    name: 'Lista de espera',
    description: 'Avisos de nuevos clientes esperando mesa.',
    importance: 5,
    visibility: 1,
    vibration: true,
  });
  await PushNotifications.register();
  return true;
}

// HU10: el cliente (anónimo o registrado) necesita recibir un push cuando el
// metre le asigna una mesa. A diferencia de iniciarPushAdministracion/
// iniciarPushListaEspera, acá no se exige estado 'aprobado': un cliente
// anónimo siempre lo tiene por default (ver crearClienteAnonimo), pero no
// tiene sentido pedirle "estar aprobado" a un rol que nunca pasa por HU06-08.
export async function iniciarPushCliente(perfil) {
  const autorizado = [ROLES.CLIENTE_ANONIMO, ROLES.CLIENTE_REGISTRADO].includes(perfil?.rol)
    && perfil.activo;
  if (!autorizado || inicializadoCliente || Capacitor.getPlatform() !== 'android') return false;
  inicializadoCliente = true;
  await escucharAccionesPush();
  await PushNotifications.addListener('registration', async ({ value }) => {
    tokenActual = value;
    try { await guardarPushToken(perfil.id, value, 'android'); }
    catch (error) {
      inicializadoCliente = false;
      console.error('No se pudo registrar este dispositivo para avisos de mesa asignada.', error);
    }
  });
  await PushNotifications.addListener('registrationError', error => {
    inicializadoCliente = false;
    console.error('Android no pudo registrar las notificaciones.', error);
  });
  await PushNotifications.addListener('pushNotificationReceived', mostrarAvisoEnPrimerPlano);
  const permiso = await PushNotifications.checkPermissions();
  const estado = permiso.receive === 'prompt'
    ? (await PushNotifications.requestPermissions()).receive : permiso.receive;
  if (estado !== 'granted') {
    inicializadoCliente = false;
    return false;
  }
  await PushNotifications.createChannel({
    id: 'mesa-asignada',
    name: 'Mesa asignada',
    description: 'Aviso de que el metre te asignó una mesa.',
    importance: 5,
    visibility: 1,
    vibration: true,
  });
  await PushNotifications.register();
  return true;
}

// HU09: dispara el aviso al anotarse en la lista de espera. El backend valida
// que quien llama tenga de verdad una entrada activa antes de avisar al metre.
export async function avisarNuevaEspera() {
  const { data, error } = await getSupabase().functions.invoke('avisar-lista-espera', { body: {} });
  if (error) throw error;
  return data;
}

// HU10: dispara el aviso al cliente cuando se le asigna una mesa. El backend
// resuelve destinatario y número de mesa a partir de estadiaId, no confía en
// datos sueltos del formulario.
export async function avisarMesaAsignada(estadiaId) {
  const { data, error } = await getSupabase().functions.invoke('avisar-mesa-asignada', { body: { estadiaId } });
  if (error) throw error;
  return data;
}
