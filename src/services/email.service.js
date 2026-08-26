// Invoca la Edge Function de correo (puntos 7, 8: aprobación/rechazo de perfiles).
import { getSupabase } from './supabase.client.js';

export async function enviarEmailAprobacion(perfil) {
  const { data, error } = await getSupabase().functions.invoke('enviar-email-aprobacion', { body: perfil });
  if (error) throw error;
  return data;
}

export async function enviarEmailRechazo(perfil) {
  const { data, error } = await getSupabase().functions.invoke('enviar-email-rechazo', { body: perfil });
  if (error) throw error;
  return data;
}
