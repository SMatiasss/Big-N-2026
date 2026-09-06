import { getSupabase } from './supabase.client.js';
import { normalizarQrMesa } from '../utils/hu11.js';

// No hay fallback a consultas inseguras: estas RPC requieren la migración HU11.
export async function consultarHu11(nombre, parametros = {}) {
  const { data, error } = await getSupabase().rpc(nombre, parametros);
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    throw new Error('HU11 necesita la migración de seguridad, todavía pendiente de aprobación.');
  }
  if (error) throw error;
  return data;
}

export function validarQrMesaAsignada(contenido) {
  // El backend compara el token con la mesa de la estadía del usuario autenticado.
  // No recibe cliente_id ni modifica la asignación que hizo el metre.
  return consultarHu11('hu11_validar_qr_mesa', { p_token: normalizarQrMesa(contenido) });
}

export function obtenerContextoMesa(estadiaId = null) {
  return consultarHu11('hu11_contexto_mesa', { p_estadia_id: estadiaId });
}

export function listarConversacionesMozo() {
  return consultarHu11('hu11_conversaciones_mozo');
}
