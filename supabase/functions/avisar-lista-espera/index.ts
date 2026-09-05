// HU09: avisa a los metres cuando un cliente se anota en la lista de espera.
// Mismo patrón que supabase/functions/enviar-push (HU06): JWT propio contra
// la cuenta de servicio de Firebase y envío directo a la API HTTP v1 de FCM.
// No se generaliza enviar-push para no acoplar HU06 con HU09/10: cada evento
// de push tiene su propia función, autocontenida, igual que ya hace el resto
// de las Edge Functions del proyecto (enviar-email-aprobacion/rechazo/pendiente).
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

    etapa = 'validar_espera_propia';
    // Sólo quien realmente tiene una entrada activa en la lista de espera
    // puede disparar este aviso: evita que cualquier sesión spamee al metre.
    const esperaResp = await fetch(`${url}/rest/v1/lista_espera?cliente_id=eq.${usuario.id}&estado=eq.esperando&select=id&limit=1`, { headers: apiHeaders });
    const espera = await esperaResp.json();
    if (!espera.length) return responder({ error: 'No tenés una entrada activa en la lista de espera.' }, 403);

    etapa = 'buscar_destinatarios';
    const metresResp = await fetch(`${url}/rest/v1/perfiles?rol=eq.metre&estado=eq.aprobado&activo=eq.true&select=id`, { headers: apiHeaders });
    const metres = await metresResp.json();
    const ids = metres.map((item: { id: string }) => item.id);
    if (!ids.length) return responder({ ok: true, enviados: 0 });

    etapa = 'buscar_tokens';
    const tokensResp = await fetch(`${url}/rest/v1/push_tokens?usuario_id=in.(${ids.join(',')})&select=token`, { headers: apiHeaders });
    const tokens = await tokensResp.json();

    etapa = 'leer_firebase';
    const cuenta = JSON.parse(secretoFirebase);
    if (!cuenta.client_email || !cuenta.private_key || !cuenta.project_id) {
      throw new Error('La cuenta de servicio de Firebase está incompleta.');
    }
    etapa = 'obtener_oauth_firebase';
    const clienteGoogle = new JWT({ email: cuenta.client_email, key: cuenta.private_key, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });
    const { token: acceso } = await clienteGoogle.getAccessToken();
    if (!acceso) throw new Error('Firebase no entregó un token de acceso.');

    let enviados = 0;
    etapa = 'enviar_fcm';
    for (const { token } of tokens) {
      const envio = await fetch(`https://fcm.googleapis.com/v1/projects/${cuenta.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${acceso}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: 'Nuevo cliente en espera', body: 'Hay un cliente esperando que le asignes una mesa.' },
            data: { ruta: '/lista-espera/metre', tipo: 'nueva_espera' },
            android: { priority: 'high', notification: { channel_id: 'lista-espera-metre' } },
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
    const filas = ids.map((destinatario_id: string) => ({
      destinatario_id,
      titulo: 'Nuevo cliente en espera',
      cuerpo: 'Hay un cliente esperando que le asignes una mesa.',
      tipo: 'nueva_espera',
      datos: { ruta: '/lista-espera/metre' },
    }));
    const guardado = await fetch(`${url}/rest/v1/notificaciones`, { method: 'POST', headers: apiHeaders, body: JSON.stringify(filas) });
    if (!guardado.ok) throw new Error(`No se pudo guardar la notificación (${guardado.status}).`);

    return responder({ ok: true, enviados });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error en avisar-lista-espera.', etapa, mensaje);
    return responder({ error: 'No se pudo completar el aviso push.', etapa }, 500);
  }
});
