// Edge Function (Deno): envía el mail de rechazo de perfil (puntos 7, 8).

import { enviarEmailPerfil } from '../_shared/email-perfil.ts';

// Recibe { perfilId }; la función obtiene el email desde la base de datos.
Deno.serve((req) => enviarEmailPerfil(req, 'rechazo'));
