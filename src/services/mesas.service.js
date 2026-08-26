// Alta de mesa, disponibilidad, QR (punto 4).
import { getSupabase } from './supabase.client.js';
import { TABLAS } from '../config/constantes.js';

export async function altaMesa(mesa) {
  const { data, error } = await getSupabase().from(TABLAS.MESAS).insert(mesa).select().single();
  if (error) throw error;
  return data;
}

export async function listarMesas() {
  const { data, error } = await getSupabase().from(TABLAS.MESAS).select('*');
  if (error) throw error;
  return data;
}

export async function actualizarDisponibilidad(mesaId, disponible) {
  const { data, error } = await getSupabase()
    .from(TABLAS.MESAS)
    .update({ disponible })
    .eq('id', mesaId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
