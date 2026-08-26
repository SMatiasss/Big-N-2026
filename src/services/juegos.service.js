// Registrar partida, aplicar descuento (puntos 14, 15).
import { getSupabase } from './supabase.client.js';
import { TABLAS } from '../config/constantes.js';

export async function registrarPartida(partida) {
  const { data, error } = await getSupabase().from(TABLAS.PARTIDAS).insert(partida).select().single();
  if (error) throw error;
  return data;
}

export async function aplicarDescuento(estadiaId, porcentaje) {
  const { data, error } = await getSupabase()
    .from(TABLAS.ESTADIAS)
    .update({ descuento: porcentaje })
    .eq('id', estadiaId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
