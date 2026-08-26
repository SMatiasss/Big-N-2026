// Responder encuesta, resultados agrupados para los gráficos (punto 20).
import { getSupabase } from './supabase.client.js';
import { TABLAS } from '../config/constantes.js';

export async function responderEncuesta(respuesta) {
  const { data, error } = await getSupabase().from(TABLAS.RESPUESTAS_ENCUESTA).insert(respuesta).select().single();
  if (error) throw error;
  return data;
}

export async function obtenerResultados(encuestaId) {
  const { data, error } = await getSupabase()
    .from(TABLAS.RESPUESTAS_ENCUESTA)
    .select('*')
    .eq('encuesta_id', encuestaId);
  if (error) throw error;
  return data;
}
