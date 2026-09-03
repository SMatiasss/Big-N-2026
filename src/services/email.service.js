// Invoca la Edge Function de correo (puntos 7, 8: aprobación/rechazo de perfiles).
import { getSupabase } from './supabase.client.js';

export async function enviarEmailAprobacion(perfilId) {
  const { data, error } = await getSupabase().functions.invoke('enviar-email-aprobacion', {
    body: { perfilId },
  });
  if (error) throw error;
  return data;
}

export async function enviarEmailRechazo(perfilId) {
  const { data, error } = await getSupabase().functions.invoke('enviar-email-rechazo', {
    body: { perfilId },
  });
  if (error) throw error;
  return data;
}
