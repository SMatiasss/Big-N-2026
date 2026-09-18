// Puntos 21 y 22: los avisos de la cuenta. Una sola función para los tres
// eventos porque entre ellos sólo cambian el destinatario y el texto:
//
//   solicitada -> SÓLO el mozo. "El cliente de la mesa X pidió la cuenta."
//   pagada     -> mozo + dueño + supervisor, JUNTOS. Es deliberadamente de
//                 mayor alcance que el anterior: el pago le interesa también a
//                 la administración, no sólo a quien atiende la mesa.
//   confirmada -> dueño y supervisor (punto 22). No incluye al mozo: es quien
//                 acaba de confirmar, ya lo sabe.
//
// Como en avisar-pedido-listo / avisar-pedido-rechazado, no se confía en el
// llamador: se relee la cuenta y sólo se avisa si su estado real coincide con
// el evento (así un cliente no puede anunciar un pago que no hizo).
import { JWT } from 'npm:google-auth-library@10.5.0';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Content-Type': 'application/json' };
const responder = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

// Estado que tiene que tener la cuenta para que el aviso sea legítimo, a quién
// le llega y con qué texto. Todo lo que distingue un evento del otro está acá.
// `ruta` sólo se pone en los eventos cuyos destinatarios son TODOS mozos: la
// pantalla de cobro (punto 22) es exclusiva de ese rol, así que mandar ahí a un
// dueño lo rebotaría al home con un aviso de "no disponible para tu perfil".
const EVENTOS: Record<string, { estado: string; roles: string[]; titulo: string; cuerpo: (mesa: string) => string; tipo: string; ruta?: string }> = {
  solicitada: {
    estado: 'pendiente',
    roles: ['mozo'],
    titulo: 'Cuenta solicitada',
    cuerpo: (mesa) => `El cliente de la mesa ${mesa} pidió la cuenta.`,
    tipo: 'cuenta_solicitada',
    ruta: '/cuenta/confirmar-pago',
  },
  pagada: {
    estado: 'pagada',
    roles: ['mozo', 'dueno', 'supervisor'],
    titulo: 'Pago registrado',
    cuerpo: (mesa) => `El cliente de la mesa ${mesa} confirmó el pago de su cuenta.`,
    tipo: 'cuenta_pagada',
  },
  confirmada: {
    estado: 'confirmada',
    roles: ['dueno', 'supervisor'],
    titulo: 'Pago confirmado',
    cuerpo: (mesa) => `El mozo confirmó el pago de la mesa ${mesa}. La mesa quedó libre.`,
    tipo: 'cuenta_confirmada',
  },
};

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
    let body: { estadiaId?: string; evento?: string };
    try {
      body = await req.json();
    } catch {
      return responder({ error: 'El cuerpo debe ser JSON válido.' }, 400);
    }

    if (!body.estadiaId) return responder({ error: 'estadiaId es obligatorio.' }, 400);

    const evento = EVENTOS[body.evento ?? ''];
    if (!evento) return responder({ error: 'evento debe ser "solicitada", "pagada" o "confirmada".' }, 400);

    etapa = 'buscar_cuenta';
    const cuentaResp = await fetch(
      `${url}/rest/v1/cuentas?estadia_id=eq.${body.estadiaId}&select=estado,estadias(mesas(numero))`,
      { headers: apiHeaders },
    );
    const cuenta = (await cuentaResp.json())[0];
    if (!cuenta) return responder({ error: 'No se encontró la cuenta de esa estadía.' }, 404);

    if (cuenta.estado !== evento.estado) {
      return responder({ ok: true, enviados: 0, mensaje: `La cuenta no está en estado "${evento.estado}".` });
    }

    const numeroMesa = cuenta.estadias?.mesas?.numero ?? 'desconocida';

    etapa = 'buscar_destinatarios';
    const rolesFiltro = evento.roles.join(',');
    const perfilesResp = await fetch(
      `${url}/rest/v1/perfiles?rol=in.(${rolesFiltro})&activo=eq.true&estado=eq.aprobado&select=id`,
      { headers: apiHeaders },
    );
    const perfiles = await perfilesResp.json();
    if (!perfiles?.length) return responder({ ok: true, enviados: 0, mensaje: 'No hay personal activo para recibir el aviso.' });

    const destinatarios = perfiles.map((perfil: { id: string }) => perfil.id);

    const titulo = evento.titulo;
    const cuerpo = evento.cuerpo(String(numeroMesa));

    // El historial en base se guarda SIEMPRE, aunque nadie tenga un dispositivo
    // registrado: es lo que le permite al personal ver el aviso al abrir la app.
    etapa = 'guardar_notificacion';
    const guardado = await fetch(`${url}/rest/v1/notificaciones`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify(destinatarios.map((id: string) => ({
        destinatario_id: id,
        titulo,
        cuerpo,
        tipo: evento.tipo,
        datos: { estadia_id: body.estadiaId, mesa: numeroMesa, ...(evento.ruta ? { ruta: evento.ruta } : {}) },
      }))),
    });
    if (!guardado.ok) throw new Error(`No se pudo guardar la notificación (${guardado.status}).`);

    etapa = 'buscar_tokens';
    const tokensResp = await fetch(
      `${url}/rest/v1/push_tokens?usuario_id=in.(${destinatarios.join(',')})&select=token`,
      { headers: apiHeaders },
    );
    const tokens = await tokensResp.json();
    if (!tokens?.length) return responder({ ok: true, enviados: 0, mensaje: 'Nadie tiene dispositivos registrados.' });

    etapa = 'leer_firebase';
    const cuenta_servicio = JSON.parse(secretoFirebase);
    if (!cuenta_servicio.client_email || !cuenta_servicio.private_key || !cuenta_servicio.project_id) {
      throw new Error('La cuenta de servicio de Firebase está incompleta.');
    }

    etapa = 'obtener_oauth_firebase';
    const clienteGoogle = new JWT({ email: cuenta_servicio.client_email, key: cuenta_servicio.private_key, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });
    const { token: acceso } = await clienteGoogle.getAccessToken();
    if (!acceso) throw new Error('Firebase no entregó un token de acceso.');

    let enviados = 0;
    etapa = 'enviar_fcm';
    for (const { token } of tokens) {
      const envio = await fetch(`https://fcm.googleapis.com/v1/projects/${cuenta_servicio.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${acceso}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: titulo, body: cuerpo },
            data: { tipo: evento.tipo, estadia_id: String(body.estadiaId), ...(evento.ruta ? { ruta: evento.ruta } : {}) },
            android: { priority: 'high', notification: { channel_id: 'cuentas' } },
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

    return responder({ ok: true, enviados, destinatarios: destinatarios.length });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error en avisar-cuenta.', etapa, mensaje);
    return responder({ error: 'No se pudo completar el aviso push.', etapa }, 500);
  }
});
