// Pendiente de proveedor/credenciales y worker autorizado. Una fila en la BD
// NO demuestra entrega al dispositivo. Nunca aceptar destinatarios del navegador
// ni devolver éxito hasta implementar el envío y sus comprobaciones server-side.
Deno.serve(() => new Response(JSON.stringify({
  ok: false, enviado: false, error: 'PUSH_NO_CONFIGURADO',
}), { status: 503, headers: { 'Content-Type': 'application/json' } }));
