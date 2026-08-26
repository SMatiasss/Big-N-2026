// Anotarse, listar, eliminar de la lista de espera (punto 9).
import { getSupabase } from './supabase.client.js';
import { TABLAS } from '../config/constantes.js';

export async function anotarse(entrada) {
  const { data, error } = await getSupabase().from(TABLAS.LISTA_ESPERA).insert(entrada).select().single();
  if (error) throw error;
  return data;
}

export async function listarEspera() {
  const { data, error } = await getSupabase()
    .from(TABLAS.LISTA_ESPERA)
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function eliminarDeEspera(entradaId) {
  const { error } = await getSupabase().from(TABLAS.LISTA_ESPERA).delete().eq('id', entradaId);
  if (error) throw error;
}
