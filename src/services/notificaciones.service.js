// Push tokens, mandar/leer notificaciones (usado por todos los flujos con push).
import { getSupabase } from './supabase.client.js';

async function exigirDestinatarioPropio(perfilId) {
  const { data, error } = await getSupabase().auth.getUser();
  if (error) throw error;
  if (!data.user || data.user.id !== perfilId) throw new Error('Sólo podés gestionar tus propias notificaciones.');
}

// Preparación del contrato real; todavía no hay registro nativo del dispositivo.
// No registrar/loguear el token ni confundir guardarlo con recibir un push.
export async function guardarPushToken(perfilId, token, plataforma) {
  if (typeof token !== 'string' || !token.trim() || !['android', 'ios', 'web'].includes(plataforma)) {
    throw new Error('Se necesita un token y una plataforma válida.');
  }
  await exigirDestinatarioPropio(perfilId);
  const { error } = await getSupabase()
    .from('push_tokens')
    .upsert({ usuario_id: perfilId, token: token.trim(), plataforma }, { onConflict: 'token' });
  if (error) throw error;
  return { registrado: true }; // No reenviar el token a la UI.
}

export async function enviarNotificacion(notificacion) {
  const { data, error } = await getSupabase().from('notificaciones').insert(notificacion).select().single();
  if (error) throw error;
  return data;
}

export async function listarNotificaciones(perfilId) {
  await exigirDestinatarioPropio(perfilId);
  const { data, error } = await getSupabase()
    .from('notificaciones')
    .select('id, titulo, cuerpo, tipo, datos, leida, creado_en')
    .eq('destinatario_id', perfilId)
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return data;
}
