// Crear, confirmar, rechazar pedidos e ítems (puntos 12-19).
import { getSupabase } from './supabase.client.js';
import { TABLAS, ESTADOS_PEDIDO } from '../config/constantes.js';

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
