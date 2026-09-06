// Sala de conversación mozo-cliente (punto 11).
import { getSupabase } from './supabase.client.js';
import { TABLAS } from '../config/constantes.js';
import { consultarHu11 } from './mesa-cliente.service.js';
import { validarMensaje } from '../utils/hu11.js';

export async function enviarMensaje({ estadiaId, cuerpo, id }) {
  // Emisor, permisos y fecha se resuelven en BD. El UUID de intento permite
  // reintentar una respuesta de red incierta sin persistir mensajes duplicados.
  const mensaje = await consultarHu11('hu11_enviar_mensaje', {
    p_estadia_id: estadiaId, p_cuerpo: validarMensaje(cuerpo), p_id: id,
  });
  let aviso = { ok: true, omitido: true };
  if (mensaje.push_pendiente !== false) {
    const resultadoAviso = await getSupabase().functions.invoke('avisar-mensaje-hu11', {
      body: { mensajeId: mensaje.id },
    });
    if (resultadoAviso.error) throw resultadoAviso.error;
    aviso = resultadoAviso.data;
  }
  return { mensaje, aviso };
}

export async function listarMensajes(estadiaId, antes = null) {
  return consultarHu11('hu11_listar_mensajes', {
    p_estadia_id: estadiaId, p_antes: antes?.creado_en ?? null, p_antes_id: antes?.id ?? null,
  });
}

export function suscribirseAMensajes(estadiaId, onNuevoMensaje, onEstado = () => {}) {
  const supabase = getSupabase();
  let cerrado = false;
  const canal = supabase
    .channel(`mensajes-estadia-${estadiaId ?? 'mozos'}-${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: TABLAS.MENSAJES,
        ...(estadiaId ? { filter: `estadia_id=eq.${estadiaId}` } : {}) },
      () => { if (!cerrado) onNuevoMensaje(); }
    )
    .subscribe(estado => {
      if (cerrado) return;
      onEstado(estado);
      if (estado === 'SUBSCRIBED') onNuevoMensaje();
    });
  return () => {
    if (cerrado) return;
    cerrado = true;
    void supabase.removeChannel(canal).catch(() => {});
  };
}
