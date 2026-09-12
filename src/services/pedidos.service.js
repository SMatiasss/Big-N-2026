// Crear, confirmar, rechazar pedidos e ítems (puntos 12-19).
import { getSupabase } from './supabase.client.js';
import { TABLAS, ESTADOS_PEDIDO, ESTADOS_ESTADIA } from '../config/constantes.js';

export async function crearPedido(pedido, items) {
  const { data: pedidoCreado, error: errorPedido } = await getSupabase()
    .from(TABLAS.PEDIDOS)
    .insert({ ...pedido, estado: ESTADOS_PEDIDO.CREADO })
    .select()
    .single();
  if (errorPedido) throw errorPedido;

  const itemsConPedido = items.map((item) => ({ ...item, pedido_id: pedidoCreado.id }));
  const { error: errorItems } = await getSupabase().from(TABLAS.ITEMS_PEDIDO).insert(itemsConPedido);
  if (errorItems) throw errorItems;

  return pedidoCreado;
}

export async function confirmarPedido(pedidoId) {
  return cambiarEstadoPedido(pedidoId, ESTADOS_PEDIDO.CONFIRMADO);
}

export async function rechazarPedido(pedidoId) {
  return cambiarEstadoPedido(pedidoId, ESTADOS_PEDIDO.RECHAZADO);
}

export async function marcarEnPreparacion(pedidoId) {
  return cambiarEstadoPedido(pedidoId, ESTADOS_PEDIDO.EN_PREPARACION);
}

export async function marcarEntregado(pedidoId) {
  return cambiarEstadoPedido(pedidoId, ESTADOS_PEDIDO.ENTREGADO);
}

async function cambiarEstadoPedido(pedidoId, estado) {
  const { data, error } = await getSupabase()
    .from(TABLAS.PEDIDOS)
    .update({ estado })
    .eq('id', pedidoId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listarItemsPedido(pedidoId) {
  const { data, error } = await getSupabase().from(TABLAS.ITEMS_PEDIDO).select('*').eq('pedido_id', pedidoId);
  if (error) throw error;
  return data;
}

/* =========================================================
   PUNTOS 18 y 19 — el pedido termina, se entrega y se recibe

   El recorrido de estados es:

     en_preparacion  el mozo confirmó y se derivó a cocina y bar (punto 14)
     listo           NO lo escribe la app: lo pone el trigger
                     trg_estado_pedido cuando ya no queda ningún ítem sin
                     marcar 'listo' (punto 18, ver 01_schema.sql)
     + entregado_en  el mozo entregó el pedido en la mesa (punto 19)
     entregado       el cliente confirmó que lo recibió (punto 19)

   Por eso "entregado_en" es una fecha aparte y no un estado: entre que el
   mozo entrega y el cliente confirma hay un tramo en el que el pedido sigue
   estando 'listo'.
   ========================================================= */

const SELECT_PEDIDO_EN_CURSO = `
  id,
  estadia_id,
  estado,
  creado_en,
  confirmado_en,
  entregado_en,
  recibido_en,
  estadias (
    mesas ( numero ),
    cliente:perfiles!cliente_id ( nombres, apellidos )
  ),
  pedido_items (
    cantidad,
    sector,
    estado,
    productos ( nombre )
  )
`;

// Punto 18: lo que ve el mozo en su listado de pedidos pendientes. Incluye los
// que todavía se están preparando (para que vea "cada parte del pedido") y los
// que ya están completos. Los 'entregado' quedan afuera: ésos ya se cerraron
// con la confirmación del cliente.
export async function listarPedidosEnCurso() {
  const { data, error } = await getSupabase()
    .from(TABLAS.PEDIDOS)
    .select(SELECT_PEDIDO_EN_CURSO)
    .in('estado', [ESTADOS_PEDIDO.EN_PREPARACION, ESTADOS_PEDIDO.LISTO])
    .order('creado_en', { ascending: true });
  if (error) throw error;
  return data;
}

// Punto 19: el mozo entrega el pedido completo. Sólo deja la marca de tiempo;
// el estado no cambia hasta que el cliente confirme la recepción.
export async function marcarPedidoEntregado(pedidoId) {
  const { data, error } = await getSupabase()
    .from(TABLAS.PEDIDOS)
    .update({ entregado_en: new Date().toISOString() })
    .eq('id', pedidoId)
    .select('id, estado, entregado_en')
    .single();
  if (error) throw error;
  return data;
}

// Punto 19 (lado cliente): el pedido de su estadía activa, para ver el estado.
export async function obtenerMiPedidoEnCurso() {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: estadia, error: errorEstadia } = await supabase
    .from(TABLAS.ESTADIAS)
    .select('id')
    .eq('cliente_id', session.user.id)
    .neq('estado', ESTADOS_ESTADIA.CERRADA)
    .maybeSingle();
  if (errorEstadia) throw errorEstadia;
  if (!estadia) return null;

  const { data, error } = await supabase
    .from(TABLAS.PEDIDOS)
    .select(SELECT_PEDIDO_EN_CURSO)
    .eq('estadia_id', estadia.id)
    .neq('estado', ESTADOS_PEDIDO.RECHAZADO)
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Punto 19: el cliente confirma la recepción. Además de cerrar el pedido deja
// la estadía en 'entregado', que es lo que habilita juegos, encuesta y cuenta.
export async function confirmarRecepcionPedido(pedidoId) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(TABLAS.PEDIDOS)
    .update({ estado: ESTADOS_PEDIDO.ENTREGADO, recibido_en: new Date().toISOString() })
    .eq('id', pedidoId)
    .select('id, estadia_id, estado, recibido_en')
    .single();
  if (error) throw error;

  const { error: errorEstadia } = await supabase
    .from(TABLAS.ESTADIAS)
    .update({ estado: ESTADOS_ESTADIA.ENTREGADO })
    .eq('id', data.estadia_id);
  if (errorEstadia) throw errorEstadia;

  return data;
}

// Realtime sobre pedidos y sus ítems: es lo que hace que la pantalla del mozo
// se entere sola de que un sector terminó, con la app abierta y sin recargar.
// Devuelve la función para desuscribirse.
export function suscribirseAPedidosEnCurso(onCambio) {
  const supabase = getSupabase();
  const canal = supabase
    .channel('pedidos-en-curso')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLAS.PEDIDOS },
      (payload) => onCambio(payload.new ?? null),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLAS.ITEMS_PEDIDO },
      () => onCambio(null),
    )
    .subscribe();

  return () => { supabase.removeChannel(canal); };
}

// Lo mismo del lado del cliente, pero sólo sobre su propio pedido.
export function suscribirseAMiPedido(pedidoId, onCambio) {
  const supabase = getSupabase();
  const canal = supabase
    .channel(`pedido-cliente-${pedidoId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: TABLAS.PEDIDOS, filter: `id=eq.${pedidoId}` },
      (payload) => onCambio(payload.new),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLAS.ITEMS_PEDIDO, filter: `pedido_id=eq.${pedidoId}` },
      () => onCambio(null),
    )
    .subscribe();

  return () => { supabase.removeChannel(canal); };
}


export async function listarPedidosPendientes() {
  const { data, error } = await getSupabase()
    .from(TABLAS.PEDIDOS)
    .select(`
      *,
      estadias (
        cliente:perfiles!cliente_id ( nombres, apellidos ),
        mesas ( numero )
      ),
      pedido_items (
        cantidad,
        productos ( nombre )
      )
    `)
    .eq('estado', ESTADOS_PEDIDO.CREADO)
    .order('creado_en', { ascending: true });
    
  if (error) throw error;
  return data;
}
