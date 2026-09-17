// Punto 13: avisa al CLIENTE que el mozo rechazó su pedido, para que lo
// modifique (parcial o totalmente) y lo vuelva a enviar. Sin motivo: el punto
// no lo pide, y el pedido nunca se borra (03_baja_logica.sql) -sigue existiendo
// con estado 'rechazado' como historial-, así que esta función sólo relee ese
// estado real antes de avisar, mismo patrón defensivo que avisar-pedido-listo.
import { JWT } from 'npm:google-auth-library@10.5.0';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Content-Type': 'application/json' };
const responder = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req) => {
  let etapa = 'inicio';
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return responder({ error: 'Método no permitido.' }, 405);

    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const secretoFirebase = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!url || !serviceKey || !secretoFirebase) return responder({ error: 'Push no configurado.' }, 500);

    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return responder({ error: 'No autorizado.' }, 401);

    const apiHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

    etapa = 'leer_body';
    let body: { pedidoId?: string };
    try {
      body = await req.json();
    } catch {
      return responder({ error: 'El cuerpo debe ser JSON válido.' }, 400);
    }

    if (!body.pedidoId) return responder({ error: 'pedidoId es obligatorio.' }, 400);

    etapa = 'buscar_pedido';
    const pedidoResp = await fetch(`${url}/rest/v1/pedidos?id=eq.${body.pedidoId}&select=estado,estadias(cliente_id,mesas(numero))`, { headers: apiHeaders });
    const pedidoData = await pedidoResp.json();
    const pedido = pedidoData[0];

    if (!pedido) return responder({ error: 'No se encontró el pedido indicado.' }, 404);

    // Sólo avisamos si de verdad quedó rechazado: quien llama no puede forzar
    // el aviso sobre un pedido en otro estado.
    if (pedido.estado !== 'rechazado') {
      return responder({ ok: true, enviados: 0, mensaje: 'El pedido no está rechazado.' });
    }

    const clienteId = pedido.estadias?.cliente_id;
    if (!clienteId) return responder({ error: 'El pedido no tiene un cliente asociado.' }, 404);

    const numeroMesa = pedido.estadias?.mesas?.numero || 'desconocida';

    etapa = 'buscar_tokens';
    const tokensResp = await fetch(`${url}/rest/v1/push_tokens?usuario_id=eq.${clienteId}&select=token`, { headers: apiHeaders });
    const tokens = await tokensResp.json();
    if (!tokens.length) return responder({ ok: true, enviados: 0 });

    etapa = 'leer_firebase';
    const cuenta = JSON.parse(secretoFirebase);
    if (!cuenta.client_email || !cuenta.private_key || !cuenta.project_id) {
      throw new Error('La cuenta de servicio de Firebase está incompleta.');
    }

    etapa = 'obtener_oauth_firebase';
    const clienteGoogle = new JWT({ email: cuenta.client_email, key: cuenta.private_key, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });
    const { token: acceso } = await clienteGoogle.getAccessToken();
    if (!acceso) throw new Error('Firebase no entregó un token de acceso.');

    const titulo = 'Pedido rechazado';
    const cuerpo = `El mozo rechazó el pedido de la mesa ${numeroMesa}. Podés modificarlo y volver a enviarlo.`;

    let enviados = 0;
    etapa = 'enviar_fcm';
    for (const { token } of tokens) {
      const envio = await fetch(`https://fcm.googleapis.com/v1/projects/${cuenta.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${acceso}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: titulo, body: cuerpo },
            data: { ruta: '/pedidos/estado', tipo: 'pedido_rechazado' },
            android: { priority: 'high', notification: { channel_id: 'pedidos-cliente' } },
          },
        }),
      });
      if (envio.ok) {
        enviados++;
      } else {
        const detalle = await envio.json().catch(() => ({}));
        console.error('FCM rechazó el envío.', envio.status, detalle?.error?.status || 'sin_detalle');
      }
    }

    etapa = 'guardar_notificacion';
    const guardado = await fetch(`${url}/rest/v1/notificaciones`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify([{ destinatario_id: clienteId, titulo, cuerpo, tipo: 'pedido_rechazado', datos: { ruta: '/pedidos/estado' } }]),
    });
    if (!guardado.ok) throw new Error(`No se pudo guardar la notificación (${guardado.status}).`);

    return responder({ ok: true, enviados });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error en avisar-pedido-rechazado.', etapa, mensaje);
    return responder({ error: 'No se pudo completar el aviso push.', etapa }, 500);
  }
});
