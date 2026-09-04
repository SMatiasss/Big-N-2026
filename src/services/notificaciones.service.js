import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getSupabase } from './supabase.client.js';
import { ROLES } from '../config/constantes.js';
import { navegarA } from '../router.js';

let tokenActual = null;
let inicializado = false;
let accionesEscuchadas = false;

function mostrarAvisoEnPrimerPlano(notification) {
  const toast = document.createElement('ion-toast');
  toast.header = notification.title || 'Nuevo aviso';
  toast.message = notification.body || 'Tenés una nueva notificación.';
  toast.duration = 5000;
  toast.position = 'top';
  toast.buttons = notification.data?.ruta === '/clientes/aprobacion'
    ? [{ text: 'Ver', handler: () => navegarA('/clientes/aprobacion') }]
    : [];
  document.body.appendChild(toast);
  toast.present();
}

async function abrirRutaDeNotificacion(ruta) {
  if (ruta !== '/clientes/aprobacion') return;

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
    catch (error) { console.error('No se pudo registrar este dispositivo para avisos.', error); }
  });
  await PushNotifications.addListener('registrationError', error => {
    console.error('Android no pudo registrar las notificaciones.', error);
  });
  await PushNotifications.addListener('pushNotificationReceived', mostrarAvisoEnPrimerPlano);
  const permiso = await PushNotifications.checkPermissions();
  const estado = permiso.receive === 'prompt'
    ? (await PushNotifications.requestPermissions()).receive : permiso.receive;
  if (estado !== 'granted') return false;
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
