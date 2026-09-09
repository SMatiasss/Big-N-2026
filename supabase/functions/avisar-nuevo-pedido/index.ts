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
    // Buscamos el pedido para saber de qué mesa viene
    const pedidoResp = await fetch(`${url}/rest/v1/pedidos?id=eq.${body.pedidoId}&select=estadia_id,estadias(mesa_id,mesas(numero))`, { headers: apiHeaders });
    const pedidoData = await pedidoResp.json();
    const pedido = pedidoData[0];
    
    if (!pedido) return responder({ error: 'No se encontró el pedido indicado.' }, 404);
    
    // Obtenemos el número de la mesa
    const numeroMesa = pedido.estadias?.mesas?.numero || 'desconocida';

    etapa = 'buscar_mozos';
    // Buscamos a todos los mozos activos y aprobados
    const mozosResp = await fetch(`${url}/rest/v1/perfiles?rol=eq.mozo&activo=eq.true&estado=eq.aprobado&select=id`, { headers: apiHeaders });
    const mozos = await mozosResp.json();
    if (!mozos || !mozos.length) return responder({ ok: true, enviados: 0, mensaje: 'No hay mozos activos para recibir el aviso.' });
    
    const mozosIds = mozos.map((m: any) => m.id);

    etapa = 'buscar_tokens';
    const tokensResp = await fetch(`${url}/rest/v1/push_tokens?usuario_id=in.(${mozosIds.join(',')})&select=token,usuario_id`, { headers: apiHeaders });
    const tokens = await tokensResp.json();
    if (!tokens || !tokens.length) return responder({ ok: true, enviados: 0, mensaje: 'Los mozos no tienen dispositivos registrados.' });

    etapa = 'leer_firebase';
    const cuenta = JSON.parse(secretoFirebase);
    if (!cuenta.client_email || !cuenta.private_key || !cuenta.project_id) {
      throw new Error('La cuenta de servicio de Firebase está incompleta.');
    }
    
    etapa = 'obtener_oauth_firebase';
    const clienteGoogle = new JWT({ email: cuenta.client_email, key: cuenta.private_key, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });
    const { token: acceso } = await clienteGoogle.getAccessToken();
    if (!acceso) throw new Error('Firebase no entregó un token de acceso.');

    const titulo = 'Nuevo Pedido';
    const cuerpo = `La mesa ${numeroMesa} acaba de enviar un nuevo pedido.`;
    
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
            data: { ruta: '/pedidos/confirmacion', tipo: 'nuevo_pedido' },
            // Puedes cambiar el channel_id por uno adecuado si lo configuras en frontend
            android: { priority: 'high', notification: { channel_id: 'pedidos-mozo' } },
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
    // Guardar una notificación en BD para cada mozo
    const notificacionesInsert = mozosIds.map((id: string) => ({
      destinatario_id: id,
      titulo,
      cuerpo,
      tipo: 'nuevo_pedido',
      datos: { ruta: '/pedidos/confirmacion' }
    }));
    
    await fetch(`${url}/rest/v1/notificaciones`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify(notificacionesInsert),
    });

    return responder({ ok: true, enviados });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error en avisar-nuevo-pedido.', etapa, mensaje);
    return responder({ error: 'No se pudo completar el aviso push.', etapa }, 500);
  }
});
