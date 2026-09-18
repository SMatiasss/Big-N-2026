import { getSupabase } from './supabase.client.js';
import { ESTADOS_ESTADIA, TABLAS } from '../config/constantes.js';

const ESTADOS_HABILITADOS = new Set([
  ESTADOS_ESTADIA.ENTREGADO,
  ESTADOS_ESTADIA.CUENTA_SOLICITADA,
  ESTADOS_ESTADIA.PAGADA,
]);

export async function obtenerEncuestaActiva() {
  const supabase = getSupabase();
  const { data: encuesta, error } = await supabase
    .from(TABLAS.ENCUESTAS)
    .select(`id, nombre, activa, preguntas ( id, texto, control, opciones, obligatoria, orden )`)
    .eq('activa', true)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!encuesta) return null;
  encuesta.preguntas = [...(encuesta.preguntas ?? [])].sort((a, b) => a.orden - b.orden);
  return encuesta;
}

export async function obtenerEstadoEncuesta(encuestaId) {
  const supabase = getSupabase();
  const { data: { session }, error: errorSesion } = await supabase.auth.getSession();
  if (errorSesion) throw errorSesion;
  if (!session) throw new Error('Necesitás iniciar sesión para acceder a la encuesta.');

  const { data: estadia, error: errorEstadia } = await supabase
    .from(TABLAS.ESTADIAS)
    .select('id, estado')
    .eq('cliente_id', session.user.id)
    .neq('estado', ESTADOS_ESTADIA.CERRADA)
    .order('iniciada_en', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errorEstadia) throw errorEstadia;
  if (!estadia) return { estadia: null, respondida: false, habilitada: false };

  const { data: respuesta, error: errorRespuesta } = await supabase
    .from(TABLAS.RESPUESTAS_ENCUESTA)
    .select('id, creado_en')
    .eq('estadia_id', estadia.id)
    .eq('encuesta_id', encuestaId)
    .maybeSingle();
  if (errorRespuesta) throw errorRespuesta;

  return {
    estadia,
    respuesta,
    respondida: Boolean(respuesta),
    habilitada: ESTADOS_HABILITADOS.has(estadia.estado),
  };
}

export async function responderEncuesta(encuestaId, respuestas) {
  const { data, error } = await getSupabase().rpc('enviar_encuesta', {
    p_encuesta_id: encuestaId,
    p_respuestas: respuestas,
  });
  if (error) {
    if (error.code === '23505') throw new Error('Ya respondiste la encuesta durante esta estadía.');
    throw error;
  }
  return data;
}

export async function obtenerResultadosEncuestas() {
  const { data, error } = await getSupabase().rpc('obtener_resultados_encuestas');
  if (error) throw error;

  const porPregunta = new Map();
  (data ?? []).forEach((fila) => {
    if (!porPregunta.has(fila.pregunta_id)) {
      porPregunta.set(fila.pregunta_id, {
        encuestaId: fila.encuesta_id,
        preguntaId: fila.pregunta_id,
        pregunta: fila.pregunta,
        control: fila.control,
        datos: [],
      });
    }
    porPregunta.get(fila.pregunta_id).datos.push({
      valor: fila.valor,
      cantidad: Number(fila.cantidad),
      porcentaje: Number(fila.porcentaje),
    });
  });
  return [...porPregunta.values()];
}
