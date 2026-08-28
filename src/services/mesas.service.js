// Alta de mesa, disponibilidad, QR (punto 4).
import { getSupabase } from './supabase.client.js';
import { TABLAS } from '../config/constantes.js';

export async function altaMesa(mesa) {
  //.select() devuelve la tabla generada (util ya que mesas crea su QR automaticamente en sql)
  //.single() devuelve la data como un objeto, normalmente lo haría como un array.
  //(si viene mas de 1 objeto, lo trata como error)
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
