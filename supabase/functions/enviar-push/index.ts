// Edge Function (Deno): envía una notificación push a los tokens registrados.

Deno.serve(async (req) => {
  const { perfilId, titulo, mensaje } = await req.json();

  // TODO: buscar el/los push_token del perfil y disparar la notificación (FCM/Expo/etc.)

  return new Response(JSON.stringify({ ok: true, perfilId, titulo, mensaje }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
