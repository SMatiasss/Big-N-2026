import nodemailer from 'npm:nodemailer@9.0.6';
import { LOGO_CORREO_BASE64 } from './logo-correo.ts';

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
  
  // Paleta de la app (src/styles/variables.css, "formulario oliva"). El TP no
  // admite fondos blancos ni "claritos", ni negros ni "oscuritos", ni modo
  // oscuro: el correo usa los mismos verdes de la app. Contrastes verificados:
  // crema sobre la tarjeta 7,4:1; texto suave 4,5:1; crema sobre el verde del
  // fondo 5,4:1; crema sobre terracota 3,8:1 (sólo en texto grande, 19px bold).
  const COLOR = {
    fondo: '#606c38',        // fondo de pantalla de la app
    tarjeta: '#4a572c',      // tarjetas y campos
    borde: '#6e6939',
    dorado: '#dda15e',       // acento principal
    terracota: '#bc6c25',    // acento fuerte
    crema: '#fefae0',        // texto principal
    suave: '#c8c8a0',        // texto secundario
    // El rechazo usa la paleta del modal/toast de error (#ac6653 con borde
    // crema): en verde se confundía con el de aprobación. Crema sobre la
    // tarjeta roja 5,6:1, sobre el fondo 3,9:1 (igual que el modal).
    ...(esAprobacion ? {} : {
      fondo: '#ac6653',
      tarjeta: '#8e4f3f',
      borde: '#c98a78',
      suave: '#f1d9cf',
    }),
  };

  // La franja de arriba distingue un correo del otro. Los títulos van siempre
  // en crema: la terracota sobre la tarjeta no llega al contraste (2:1).
  const colorAcento = esAprobacion ? COLOR.dorado : COLOR.crema;
  const tituloHeader = esAprobacion ? '¡Tu registro ha sido aprobado!' : 'Estado de tu solicitud de registro';

  const fuenteTitulos = "'Outfit', 'Trebuchet MS', Arial, sans-serif";
  const fuenteTexto = "'Geist', 'Segoe UI', Roboto, Arial, sans-serif";

  // Usamos referencia CID local para que Gmail despliegue el adjunto inline.
  // Los colores van también como atributo bgcolor: algunos clientes de correo
  // ignoran background-color en tablas.
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <!-- El TP no admite modo oscuro: se le pide al cliente de correo que no
           invierta los colores. -->
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600&family=Outfit:wght@700&display=swap" rel="stylesheet">
      <style>:root { color-scheme: light; supported-color-schemes: light; }</style>
    </head>
    <body bgcolor="${COLOR.fondo}" style="margin: 0; padding: 0; background-color: ${COLOR.fondo}; font-family: ${fuenteTexto}; color: ${COLOR.crema};">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="${COLOR.fondo}" style="table-layout: fixed; background-color: ${COLOR.fondo}; padding: 36px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="${COLOR.tarjeta}" style="max-width: 550px; background-color: ${COLOR.tarjeta}; border: 1px solid ${COLOR.borde}; border-top: 6px solid ${colorAcento}; border-radius: 16px; overflow: hidden;">

              <!-- Logo en un círculo crema, como en el inicio de la app: el
                   gorro es verde oliva y sobre la tarjeta no se vería. -->
              <tr>
                <td align="center" style="padding: 32px 20px 12px 20px;">
                  <!-- Logo_correo.png ya trae el círculo crema con el logo
                       recortado como en inicio (scale 1.672): los clientes de
                       correo no aplican transform ni overflow, así que el
                       recorte va en la imagen. Está a 464px para verse nítido. -->
                  <img src="cid:logo_bign_inline" alt="Big N" width="232" height="232" style="display: block; width: 232px; height: 232px; border: 0;" />
                </td>
              </tr>

              <!-- Encabezado -->
              <tr>
                <td align="center" style="padding: 10px 30px;">
                  <h1 style="margin: 0; font-family: ${fuenteTitulos}; font-size: 24px; font-weight: 700; line-height: 1.25; color: ${COLOR.crema}; text-align: center;">${tituloHeader}</h1>
                </td>
              </tr>

              <!-- Contenido principal -->
              <tr>
                <td style="padding: 20px 30px 30px 30px; font-size: 15px; line-height: 1.6; color: ${COLOR.crema};">
                  <p style="margin-top: 0; font-size: 16px; color: ${COLOR.crema};">Hola <strong>${nombre}</strong>,</p>

                  ${esAprobacion ? `
                    <p style="font-size: 15px; margin-bottom: 20px; color: ${COLOR.crema};">Nos alegra informarte que tu solicitud de registro ha sido revisada y <strong>aceptada</strong> por nuestro equipo. Ya podés iniciar sesión en la aplicación y disfrutar de nuestros servicios.</p>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 25px 0;">
                      <tr>
                        <td align="center">
                          <span style="background-color: ${COLOR.terracota}; color: ${COLOR.crema}; padding: 12px 30px; font-family: ${fuenteTitulos}; font-size: 19px; font-weight: 700; border-radius: 10px; display: inline-block;">Cuenta activa</span>
                        </td>
                      </tr>
                    </table>
                  ` : `
                    <p style="font-size: 15px; margin-bottom: 20px; color: ${COLOR.crema};">Te informamos que tu solicitud de registro <strong>no ha sido aprobada</strong> en este momento tras la revisión del supervisor.</p>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="${COLOR.fondo}" style="margin: 20px 0; background-color: ${COLOR.fondo}; border-left: 4px solid ${colorAcento}; border-radius: 6px;">
                      <tr>
                        <td style="padding: 15px; font-size: 14px; line-height: 1.5; color: ${COLOR.crema};">
                          Para más detalles o resolver dudas sobre tu cuenta, te pedimos que te comuniques directamente con el equipo.
                        </td>
                      </tr>
                    </table>
                  `}
                </td>
              </tr>

              <!-- Pie de página -->
              <tr>
                <td align="center" bgcolor="${COLOR.tarjeta}" style="background-color: ${COLOR.tarjeta}; padding: 18px 30px; border-top: 1px solid ${COLOR.borde};">
                  <p style="margin: 0; font-size: 12px; color: ${COLOR.suave};">© Big N. Todos los derechos reservados.</p>
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
          filename: 'Logo_correo.png',
          content: LOGO_CORREO_BASE64,
          encoding: 'base64',
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