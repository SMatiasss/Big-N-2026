// Justo después de navegar (login reciente, alta de otro usuario, etc.) el
// token de sesión puede estar refrescándose y una RPC cae con un 401
// transitorio. Reintentar una vez alcanza: para cuando se repite la llamada,
// Supabase ya terminó el refresh en segundo plano.
export async function reintentarUnaVez(funcion) {
  try {
    return await funcion();
  } catch {
    return await funcion();
  }
}
