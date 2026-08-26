// Edge Function (Deno): envía el mail de aprobación de perfil (puntos 7, 8).
// No corre en el navegador ni en el celular: corre en el servidor de Supabase.

Deno.serve(async (req) => {
  const perfil = await req.json();

  // TODO: armar el mail y enviarlo con el proveedor elegido (Resend, SendGrid, etc.)

  return new Response(JSON.stringify({ ok: true, perfil }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
