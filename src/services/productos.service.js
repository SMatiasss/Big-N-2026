// Alta de plato/bebida, listar carta (puntos 2, 3, 11).
import { getSupabase } from './supabase.client.js';
import { TABLAS } from '../config/constantes.js';

export async function altaProducto(producto) {
  const { data, error } = await getSupabase().from(TABLAS.PRODUCTOS).insert(producto).select().single();
  if (error) throw error;
  return data;
}

export async function listarCarta() {
  const { data, error } = await getSupabase().from(TABLAS.PRODUCTOS).select('*');
  if (error) throw error;
  return data;
}
