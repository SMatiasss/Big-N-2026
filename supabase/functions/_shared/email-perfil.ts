import nodemailer from 'npm:nodemailer@9.0.6';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

type TipoCorreo = 'aprobacion' | 'rechazo';

function responder(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function textoSeguro(valor: unknown) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function obtenerPerfil(supabaseUrl: string, serviceRoleKey: string, perfilId: string, columnas: string) {
  const respuesta = await fetch(
    `${supabaseUrl}/rest/v1/perfiles?id=eq.${encodeURIComponent(perfilId)}&select=${encodeURIComponent(columnas)}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );
  if (!respuesta.ok) return null;
  const perfiles = await respuesta.json();
  return perfiles[0] ?? null;
}

export async function enviarEmailPerfil(req: Request, tipo: TipoCorreo) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const gmailUser = Deno.env.get('GMAIL_USER');
  const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD');
  if (!supabaseUrl || !serviceRoleKey || !gmailUser || !gmailAppPassword) {
    console.error('Faltan secretos de correo en la Edge Function.');
    return responder({ error: 'El servicio de correo no está configurado.' }, 500);
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return responder({ error: 'No autorizado.' }, 401);

  const respuestaUsuario = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, Authorization: authorization },
  });
  if (!respuestaUsuario.ok) return responder({ error: 'Sesión inválida.' }, 401);
  const user = await respuestaUsuario.json();

  const emisor = await obtenerPerfil(supabaseUrl, serviceRoleKey, user.id, 'rol');
  if (!['dueno', 'supervisor'].includes(emisor?.rol)) {
    return responder({ error: 'No tenés permiso para enviar este correo.' }, 403);
  }

  let body: { perfilId?: unknown };
  try {
    body = await req.json();
  } catch {
    return responder({ error: 'El cuerpo debe ser JSON válido.' }, 400);
  }
  if (typeof body.perfilId !== 'string' || !body.perfilId) {
    return responder({ error: 'perfilId es obligatorio.' }, 400);
  }

  const perfil = await obtenerPerfil(
    supabaseUrl,
    serviceRoleKey,
    body.perfilId,
    'email,nombres,apellidos,estado',
  );
  if (!perfil?.email) {
    return responder({ error: 'No se encontró un correo para ese perfil.' }, 404);
  }
  const estadoEsperado = tipo === 'aprobacion' ? 'aprobado' : 'rechazado';
  if (perfil.estado !== estadoEsperado) {
    return responder({ error: 'El estado del perfil no corresponde al correo solicitado.' }, 409);
  }

  const nombre = textoSeguro(`${perfil.nombres} ${perfil.apellidos}`.trim() || 'cliente');
  const esAprobacion = tipo === 'aprobacion';
  const asunto = esAprobacion
    ? 'Tu registro fue aprobado | Big N'
    : 'Actualización de tu registro | Big N';
  
  const colorPrincipal = esAprobacion ? '#5D6C31' : '#C26B28';
  const tituloHeader = esAprobacion ? '¡Tu registro ha sido aprobado!' : 'Estado de tu solicitud de registro';

  // Usamos referencia CID local para que Gmail despliegue el adjunto inline
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f5f0; font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #2d3748;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f4f5f0; padding: 40px 10px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 550px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-top: 6px solid ${colorPrincipal};">
              
              <!-- Logo via CID Inline -->
              <tr>
                <td align="center" style="padding: 32px 20px 10px 20px;">
                  <img src="cid:logo_bign_inline" alt="Big N Logo" width="110" style="display: block; width: 110px; height: auto; border: 0;" />
                </td>
              </tr>

              <!-- Encabezado -->
              <tr>
                <td align="center" style="padding: 10px 30px;">
                  <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: ${colorPrincipal}; text-align: center;">${tituloHeader}</h1>
                </td>
              </tr>

              <!-- Contenido principal -->
              <tr>
                <td style="padding: 20px 30px 30px 30px; font-size: 15px; line-height: 1.6; color: #4a5568;">
                  <p style="margin-top: 0; font-size: 16px;">Hola <strong>${nombre}</strong>,</p>
                  
                  ${esAprobacion ? `
                    <p style="font-size: 15px; margin-bottom: 20px;">Nos alegra informarte que tu solicitud de registro ha sido revisada y <strong>aceptada</strong> por nuestro equipo. Ya podés iniciar sesión en la aplicación y disfrutar de nuestros servicios.</p>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 25px 0;">
                      <tr>
                        <td align="center">
                          <span style="background-color: #5D6C31; color: #ffffff; padding: 12px 28px; font-size: 15px; font-weight: 600; border-radius: 6px; display: inline-block;">Cuenta Activa</span>
                        </td>
                      </tr>
                    </table>
                  ` : `
                    <p style="font-size: 15px; margin-bottom: 20px;">Te informamos que tu solicitud de registro <strong>no ha sido aprobada</strong> en este momento tras la revisión del supervisor.</p>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #fffaf0; border-left: 4px solid #C26B28; border-radius: 4px;">
                      <tr>
                        <td style="padding: 15px; font-size: 14px; color: #744210;">
                          Para más detalles o resolver dudas sobre tu cuenta, te pedimos que te comuniques directamente con el equipo.
                        </td>
                      </tr>
                    </table>
                  `}
                </td>
              </tr>

              <!-- Pie de página -->
              <tr>
                <td align="center" style="background-color: #fafafa; padding: 20px 30px; font-size: 12px; color: #a0aec0; border-top: 1px solid #edf2f7;">
                  <p style="margin: 0; font-size: 12px;">© Big N. Todos los derechos reservados.</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const mensajeTexto = esAprobacion
    ? `Hola ${nombre}, tu registro fue aprobado. Ya podés iniciar sesión.`
    : `Hola ${nombre}, tu registro no fue aprobado. Comunicate con soporte para más información.`;

  const transporte = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });

  try {
    await transporte.sendMail({
      from: `Big N <${gmailUser}>`,
      to: perfil.email,
      subject: asunto,
      html: htmlContent,
      text: mensajeTexto,
      attachments: [
        {
          filename: 'Icono_Big_N_2_1.png',
          path: `${supabaseUrl}/storage/v1/object/public/Logo/Icono_Big_N_2_1.png`,
          cid: 'logo_bign_inline', // Se mantiene igual para vincular con el HTML
        },
      ],
    });
  } catch (error) {
    console.error('Gmail rechazó el correo:', error);
    return responder({ error: 'No se pudo enviar el correo.' }, 502);
  }

  return responder({ ok: true });
}