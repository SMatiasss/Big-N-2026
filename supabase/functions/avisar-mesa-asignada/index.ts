// HU10: avisa al cliente cuando el metre le asigna una mesa. Mismo patrón que
// enviar-push/avisar-lista-espera: JWT propio contra la cuenta de servicio de
// Firebase y envío directo a la API HTTP v1 de FCM.
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
    etapa = 'validar_sesion';
    const usuarioResp = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: authorization } });
    if (!usuarioResp.ok) return responder({ error: 'Sesión inválida.' }, 401);
    const usuario = await usuarioResp.json();
    const apiHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

    etapa = 'validar_actor';
    // Sólo el metre (o un jefe) puede disparar este aviso: mismo criterio que
    // la policy estadias_alta, que es quien realmente puede crear la asignación.
    const actorResp = await fetch(`${url}/rest/v1/perfiles?id=eq.${usuario.id}&select=rol,estado,activo`, { headers: apiHeaders });
    const actor = (await actorResp.json())[0];
    const esJefe = ['dueno', 'supervisor'].includes(actor?.rol);
    if (!actor?.activo || actor.estado !== 'aprobado' || !(actor.rol === 'metre' || esJefe)) {
      return responder({ error: 'No tenés permiso para enviar este aviso.' }, 403);
    }

    etapa = 'leer_body';
    let body: { estadiaId?: unknown };
    try {
      body = await req.json();
    } catch {
      return responder({ error: 'El cuerpo debe ser JSON válido.' }, 400);
    }
    if (typeof body.estadiaId !== 'string' || !body.estadiaId) {
      return responder({ error: 'estadiaId es obligatorio.' }, 400);
    }

    etapa = 'buscar_estadia';
    // El número de mesa se resuelve del lado del servidor: nunca se confía en
    // un dato de mesa enviado por el cliente para armar el mensaje.
    const estadiaResp = await fetch(`${url}/rest/v1/estadias?id=eq.${body.estadiaId}&select=cliente_id,mesa:mesas(numero)`, { headers: apiHeaders });
    const estadia = (await estadiaResp.json())[0];
    if (!estadia) return responder({ error: 'No se encontró la estadía indicada.' }, 404);

    etapa = 'buscar_tokens';
    const tokensResp = await fetch(`${url}/rest/v1/push_tokens?usuario_id=eq.${estadia.cliente_id}&select=token`, { headers: apiHeaders });
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

    const numero = estadia.mesa?.numero;
    const cuerpo = numero ? `Te asignamos la mesa ${numero}.` : 'Ya tenés una mesa asignada.';

    let enviados = 0;
    etapa = 'enviar_fcm';
    for (const { token } of tokens) {
      const envio = await fetch(`https://fcm.googleapis.com/v1/projects/${cuenta.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${acceso}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: 'Mesa asignada', body: cuerpo },
            data: { ruta: '/lista-espera', tipo: 'mesa_asignada' },
            android: { priority: 'high', notification: { channel_id: 'mesa-asignada' } },
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
      body: JSON.stringify([{ destinatario_id: estadia.cliente_id, titulo: 'Mesa asignada', cuerpo, tipo: 'mesa_asignada', datos: { ruta: '/lista-espera' } }]),
    });
    if (!guardado.ok) throw new Error(`No se pudo guardar la notificación (${guardado.status}).`);

    return responder({ ok: true, enviados });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error en avisar-mesa-asignada.', etapa, mensaje);
    return responder({ error: 'No se pudo completar el aviso push.', etapa }, 500);
  }
});
