// Push tokens, mandar/leer notificaciones (usado por todos los flujos con push).
import { getSupabase } from './supabase.client.js';

export async function guardarPushToken(perfilId, token) {
  const { data, error } = await getSupabase()
    .from('push_tokens')
    .upsert({ perfil_id: perfilId, token })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function enviarNotificacion(notificacion) {
  const { data, error } = await getSupabase().from('notificaciones').insert(notificacion).select().single();
  if (error) throw error;
  return data;
}

export async function listarNotificaciones(perfilId) {
  const { data, error } = await getSupabase()
    .from('notificaciones')
    .select('*')
    .eq('perfil_id', perfilId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
