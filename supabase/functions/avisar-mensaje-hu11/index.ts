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

    etapa = 'validar_sesion';
    const usuarioResp = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: authorization } });
    if (!usuarioResp.ok) return responder({ error: 'Sesión inválida.' }, 401);
    const usuario = await usuarioResp.json();

    etapa = 'leer_body';
    const body = await req.json().catch(() => ({}));
    if (typeof body.mensajeId !== 'string' || !body.mensajeId) return responder({ error: 'mensajeId es obligatorio.' }, 400);

    etapa = 'buscar_mensaje';
    const mensajeResp = await fetch(`${url}/rest/v1/mensajes?id=eq.${encodeURIComponent(body.mensajeId)}&select=id,autor_id,estadia_id,creado_en`, { headers: apiHeaders });
    if (!mensajeResp.ok) throw new Error(`No se pudo consultar el mensaje (${mensajeResp.status}).`);
    const mensaje = (await mensajeResp.json())[0];
    if (!mensaje) return responder({ error: 'No se encontró el mensaje.' }, 404);
    if (mensaje.autor_id !== usuario.id) return responder({ error: 'Sólo el autor puede avisar este mensaje.' }, 403);
    if (Date.now() - new Date(mensaje.creado_en).getTime() > 5 * 60 * 1000) return responder({ error: 'El mensaje ya no admite reenvío.' }, 409);

    etapa = 'resolver_contexto';
    const estadiaResp = await fetch(`${url}/rest/v1/estadias?id=eq.${mensaje.estadia_id}&estado=neq.cerrada&select=cliente_id,mesa:mesas(numero)`, { headers: apiHeaders });
    const estadia = (await estadiaResp.json())[0];
    if (!estadia) return responder({ error: 'La conversación ya no está activa.' }, 409);
    const actorResp = await fetch(`${url}/rest/v1/perfiles?id=eq.${usuario.id}&activo=eq.true&select=id,rol,estado,nombres,apellidos`, { headers: apiHeaders });
    const actor = (await actorResp.json())[0];
    const esMozo = actor?.rol === 'mozo' && actor.estado === 'aprobado';
    const esCliente = ['cliente_registrado', 'cliente_anonimo'].includes(actor?.rol) && actor.id === estadia.cliente_id
      && (actor.rol === 'cliente_anonimo' || actor.estado === 'aprobado');
    if (!esMozo && !esCliente) return responder({ error: 'Perfil no habilitado para esta conversación.' }, 403);

    etapa = 'resolver_destinatarios';
    let destinatarios: Array<{ id: string }>;
    if (esMozo) destinatarios = [{ id: estadia.cliente_id }];
    else {
      const resp = await fetch(`${url}/rest/v1/perfiles?rol=eq.mozo&activo=eq.true&estado=eq.aprobado&select=id`, { headers: apiHeaders });
      destinatarios = await resp.json();
    }
    if (!destinatarios.length) return responder({ ok: true, enviados: 0, destinatarios: 0 });
    const ids = destinatarios.map(({ id }) => id);
    const filtroIds = encodeURIComponent(`(${ids.join(',')})`);
    const tokensResp = await fetch(`${url}/rest/v1/push_tokens?usuario_id=in.${filtroIds}&select=token,usuario_id`, { headers: apiHeaders });
    const tokens = await tokensResp.json();

    etapa = 'leer_firebase';
    const cuenta = JSON.parse(secretoFirebase);
    if (!cuenta.client_email || !cuenta.private_key || !cuenta.project_id) throw new Error('La cuenta de servicio de Firebase está incompleta.');
    const clienteGoogle = new JWT({ email: cuenta.client_email, key: cuenta.private_key, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });
    const { token: acceso } = await clienteGoogle.getAccessToken();
    if (!acceso) throw new Error('Firebase no entregó un token de acceso.');

    const numero = estadia.mesa?.numero;
    const nombre = [actor.nombres, actor.apellidos].filter(Boolean).join(' ') || (esMozo ? 'Un mozo' : 'Un cliente');
    const titulo = esMozo ? `Respuesta del mozo${numero ? ` — Mesa ${numero}` : ''}` : `Nueva consulta${numero ? ` — Mesa ${numero}` : ''}`;
    const cuerpo = `${nombre} envió un mensaje.`;
    let enviados = 0;
    etapa = 'enviar_fcm';
    for (const { token } of tokens) {
      const envio = await fetch(`https://fcm.googleapis.com/v1/projects/${cuenta.project_id}/messages:send`, {
        method: 'POST', headers: { Authorization: `Bearer ${acceso}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { token, notification: { title: titulo, body: cuerpo },
          data: { ruta: '/pedidos/consulta', tipo: esMozo ? 'respuesta_mozo' : 'consulta_mozo', estadia_id: mensaje.estadia_id, mensaje_id: mensaje.id },
          android: { priority: 'high', notification: { channel_id: 'consultas-mozo' } } } }),
      });
      if (envio.ok) enviados++;
      else console.error('FCM rechazó el envío.', envio.status, await envio.text());
    }
    return responder({ ok: true, enviados, destinatarios: destinatarios.length });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error en avisar-mensaje-hu11.', etapa, mensaje);
    return responder({ error: 'No se pudo completar el aviso push.', etapa }, 500);
  }
});
