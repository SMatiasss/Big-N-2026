// Asignar mesa, cerrar estadía (puntos 10, 22).
import { getSupabase } from './supabase.client.js';
import { TABLAS, ESTADOS_ESTADIA } from '../config/constantes.js';

export async function asignarMesa(estadia) {
  const { data, error } = await getSupabase()
    .from(TABLAS.ESTADIAS)
    .insert({ ...estadia, estado: ESTADOS_ESTADIA.ABIERTA })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cerrarEstadia(estadiaId) {
  const { data, error } = await getSupabase()
    .from(TABLAS.ESTADIAS)
    .update({ estado: ESTADOS_ESTADIA.CERRADA })
    .eq('id', estadiaId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
