// Edge Function (Deno): envía el mail de aprobación de perfil (puntos 7, 8).
// No corre en el navegador ni en el celular: corre en el servidor de Supabase.

import { enviarEmailPerfil } from '../_shared/email-perfil.ts';

// Recibe { perfilId }; la función obtiene el email desde la base de datos.
Deno.serve((req) => enviarEmailPerfil(req, 'aprobacion'));
