// Responder encuesta, resultados agrupados para los gráficos (puntos 9 y 20).
import { getSupabase } from './supabase.client.js';
import { TABLAS, VISTAS } from '../config/constantes.js';

// NOTA: responderEncuesta queda pendiente de HU20 — el insert real necesita
// resolverse contra respuestas + respuesta_items (una fila por pregunta), no
// como un insert único; no se toca acá para no improvisar esa lógica.
export async function responderEncuesta(respuesta) {
  const { data, error } = await getSupabase().from(TABLAS.RESPUESTAS_ENCUESTA).insert(respuesta).select().single();
  if (error) throw error;
  return data;
}

// Resultados de TODAS las encuestas ya respondidas, agrupados por pregunta
// (una entrada por pregunta_id, con sus valores y cantidades) para pasarle
// directo a crearGraficoEncuesta. Sale de v_resultados_encuestas, la vista
// que ya hace el GROUP BY en el schema (01_schema.sql) — no se reconstruye
// la agregación acá.
export async function obtenerResultadosEncuestas() {
  const { data, error } = await getSupabase()
    .from(VISTAS.RESULTADOS_ENCUESTAS)
    .select('*');
  if (error) throw error;

  const porPregunta = new Map();
  data.forEach((fila) => {
    if (!porPregunta.has(fila.pregunta_id)) {
      porPregunta.set(fila.pregunta_id, {
        preguntaId: fila.pregunta_id,
        pregunta: fila.pregunta,
        control: fila.control,
        datos: [],
      });
    }
    porPregunta.get(fila.pregunta_id).datos.push({ valor: fila.valor, cantidad: fila.cantidad });
  });

  return [...porPregunta.values()];
}
