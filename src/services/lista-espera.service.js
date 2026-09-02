// Anotarse, listar, cancelar y suscribirse por realtime a la lista de espera (punto 9).
import { getSupabase } from './supabase.client.js';
import { ESTADOS_ESPERA, TABLAS } from '../config/constantes.js';

// El cliente_id sale de la sesión verificada, no de un parámetro del llamador
// (mismo criterio que crearPlatoCompleto en productos.service.js). La policy
// espera_propia además exige cliente_id = auth.uid(), así que confiar en el
// caller ni siquiera pasaría el insert.
export async function anotarse({ comensales = 1 } = {}) {
  const supabase = getSupabase();
  // getSession() en vez de getUser(): lee la sesión ya guardada localmente,
  // sin la revalidación por red que getUser() hace contra el servidor de
  // Auth (esa revalidación es la que tira "Auth session missing!" incluso
  // con una sesión activa y funcionando para el resto de las consultas).
  const { data: { session }, error: errorSesion } = await supabase.auth.getSession();
  if (errorSesion) throw errorSesion;
  if (!session) throw new Error('Necesitás iniciar sesión para anotarte en la lista de espera.');

  // uq_espera_activa ya impide anotarse dos veces (mismo cliente_id con
  // estado='esperando'); no se duplica esa validación acá, sólo se deja que
  // el insert falle y el llamador decida qué mostrar.
  const { data, error } = await supabase
    .from(TABLAS.LISTA_ESPERA)
    .insert({ cliente_id: session.user.id, comensales })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// La entrada activa (si existe) del cliente logueado. Sirve para reconstruir
// el estado de la pantalla si el cliente recarga mientras espera.
export async function obtenerMiEspera() {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from(TABLAS.LISTA_ESPERA)
    .select('*')
    .eq('cliente_id', session.user.id)
    .eq('estado', ESTADOS_ESPERA.ESPERANDO)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Listado del metre: sólo los que están esperando, con los datos del perfil
// embebidos (evita N+1 consultas) y ordenados por quien espera hace más tiempo.
export async function listarEsperando() {
  const { data, error } = await getSupabase()
    .from(TABLAS.LISTA_ESPERA)
    .select('*, cliente:perfiles(apellidos, nombres, foto_url, rol)')
    .eq('estado', ESTADOS_ESPERA.ESPERANDO)
    .order('creado_en', { ascending: true });
  if (error) throw error;
  return data;
}

// Cancelar la espera es un DELETE físico real: lista_espera no está alcanzada
// por el trigger de baja lógica (a diferencia de perfiles/mesas/productos/
// estadias/pedidos/cuentas, ver 03_baja_logica.sql), así que este delete
// directo es el comportamiento correcto acá.
export async function eliminarDeEspera(entradaId) {
  const { error } = await getSupabase().from(TABLAS.LISTA_ESPERA).delete().eq('id', entradaId);
  if (error) throw error;
}

// Avisa al propio cliente cuando SU fila cambia (típicamente estado -> 'asignado').
// Devuelve una función para desuscribirse.
export function suscribirseAMiEspera(entradaId, onCambio) {
  const canal = getSupabase()
    .channel(`lista-espera-cliente-${entradaId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: TABLAS.LISTA_ESPERA, filter: `id=eq.${entradaId}` },
      (payload) => onCambio(payload.new),
    )
    .subscribe();

  return () => {
    getSupabase().removeChannel(canal);
  };
}

// Avisa al panel del metre de cualquier alta/baja/cambio en la lista completa.
// Devuelve una función para desuscribirse.
export function suscribirseAListaEspera(onCambio) {
  const canal = getSupabase()
    .channel('lista-espera-metre')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLAS.LISTA_ESPERA },
      onCambio,
    )
    .subscribe();

  return () => {
    getSupabase().removeChannel(canal);
  };
}
