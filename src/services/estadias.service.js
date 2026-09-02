// Asignar mesa, cerrar estadía (puntos 10, 22).
import { getSupabase } from './supabase.client.js';
import { ESTADOS_ESTADIA, TABLAS } from '../config/constantes.js';

// asignada_por sale de la sesión verificada del metre, no de un parámetro del
// llamador (mismo criterio que crearPlatoCompleto en productos.service.js).
// El insert dispara automáticamente el trigger trg_ocupar_mesa: marca la mesa
// 'ocupada' y pasa lista_espera.estado a 'asignado' en la misma operación,
// así que acá no se repite esa lógica.
// Si dos metres asignan la misma mesa casi a la vez, uq_estadia_activa_mesa
// hace fallar el segundo insert con un error de unicidad (código 23505):
// eso se interpreta en la pantalla que llama a esta función, no acá.
export async function asignarMesa({ clienteId, mesaId, listaEsperaId }) {
  const supabase = getSupabase();
  // getSession() lee la sesión ya guardada localmente; getUser() la
  // revalida por red contra el servidor de Auth y es más propenso a fallar
  // con "Auth session missing!" aunque la sesión esté perfectamente activa
  // (las consultas normales, que sólo adjuntan el JWT, no tienen ese problema).
  const { data: { session }, error: errorSesion } = await supabase.auth.getSession();
  if (errorSesion) throw errorSesion;
  if (!session) throw new Error('Necesitás iniciar sesión para asignar una mesa.');

  const { data, error } = await supabase
    .from(TABLAS.ESTADIAS)
    .insert({
      cliente_id: clienteId,
      mesa_id: mesaId,
      lista_espera_id: listaEsperaId,
      asignada_por: session.user.id,
      estado: ESTADOS_ESTADIA.ABIERTA,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// La estadía activa del cliente logueado, con el número y tipo de mesa ya
// embebidos. La usa el cliente para saber a qué mesa lo asignaron apenas
// detecta (por realtime) que su lista_espera pasó a 'asignado'.
export async function obtenerMiEstadiaActiva() {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from(TABLAS.ESTADIAS)
    .select('*, mesa:mesas(numero, tipo)')
    .eq('cliente_id', session.user.id)
    .neq('estado', ESTADOS_ESTADIA.CERRADA)
    .maybeSingle();
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

// La estadía más reciente del cliente logueado, sin importar su estado (a
// diferencia de obtenerMiEstadiaActiva, que descarta las cerradas). La usa
// sesion-anonima.service.js al arrancar la app para decidir si una sesión
// anónima sigue correspondiendo a una visita en curso o quedó "huérfana" de
// una anterior ya cerrada.
export async function obtenerMiUltimaEstadia() {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from(TABLAS.ESTADIAS)
    .select('*')
    .eq('cliente_id', session.user.id)
    .order('iniciada_en', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Avisa al propio cliente cuando SU fila de estadía cambia (típicamente
// estado -> 'cerrada', disparado por trg_cerrar_estadia cuando el mozo
// confirma el pago). Mismo patrón que suscribirseAMiEspera en
// lista-espera.service.js. Devuelve una función para desuscribirse.
export function suscribirseAMiEstadia(estadiaId, onCambio) {
  const canal = getSupabase()
    .channel(`estadia-cliente-${estadiaId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: TABLAS.ESTADIAS, filter: `id=eq.${estadiaId}` },
      (payload) => onCambio(payload.new),
    )
    .subscribe();

  return () => {
    getSupabase().removeChannel(canal);
  };
}
