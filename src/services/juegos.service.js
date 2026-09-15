// Registrar partida, aplicar descuento (puntos 14, 15).
import { getSupabase } from './supabase.client.js';
export async function listarJuegos() {
  const { data, error } = await getSupabase()
    .from('juegos')
    .select('id, nombre, descuento_pct')
    .order('descuento_pct');
  if (error) throw error;
  return data ?? [];
}

export async function jugar({ juegoId, eleccion = null }) {
  const { data, error } = await getSupabase().rpc('hu15_jugar', {
    p_juego_id: juegoId,
    p_eleccion: eleccion,
  });
  if (error) throw error;
  return data;
}

export async function obtenerEstadoJuegos() {
  const { data: estadia, error: errorEstadia } = await getSupabase()
    .from('estadias')
    .select('id, descuento_pct')
    .neq('estado', 'cerrada')
    .maybeSingle();
  if (errorEstadia) throw errorEstadia;
  if (!estadia) return { descuentoAplicado: 0, intentos: {} };

  const { data: partidas, error } = await getSupabase()
    .from('partidas')
    .select('juego_id, intento_nro')
    .eq('estadia_id', estadia.id);
  if (error) throw error;

  const intentos = {};
  for (const partida of partidas ?? []) {
    intentos[partida.juego_id] = Math.max(intentos[partida.juego_id] ?? 0, partida.intento_nro);
  }
  return { descuentoAplicado: Number(estadia.descuento_pct), intentos };
}
