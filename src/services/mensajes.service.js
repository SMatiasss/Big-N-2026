// Sala de conversación mozo-cliente (punto 11).
import { getSupabase } from './supabase.client.js';
import { TABLAS } from '../config/constantes.js';

export async function enviarMensaje(mensaje) {
  const { data, error } = await getSupabase().from(TABLAS.MENSAJES).insert(mensaje).select().single();
  if (error) throw error;
  return data;
}

export async function listarMensajes(estadiaId) {
  const { data, error } = await getSupabase()
    .from(TABLAS.MENSAJES)
    .select('*')
    .eq('estadia_id', estadiaId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export function suscribirseAMensajes(estadiaId, onNuevoMensaje) {
  return getSupabase()
    .channel(`mensajes-estadia-${estadiaId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: TABLAS.MENSAJES, filter: `estadia_id=eq.${estadiaId}` },
      (payload) => onNuevoMensaje(payload.new)
    )
    .subscribe();
}
