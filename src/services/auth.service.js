import { getSupabase, getSupabaseAislado } from './supabase.client.js';
import { obtenerMotivoBloqueo, puedeResolverClientes, puedeVerClientesActivos } from '../utils/acceso-perfil.js';
import { ROLES } from '../config/constantes.js';

// El perfil interviene en casi todas las navegaciones. Mantener una copia
// corta evita repetir getUser + SELECT en cada cambio de pantalla, mientras
// RLS continúa validando todas las operaciones en Supabase.
const DURACION_CACHE_PERFIL_MS = 30_000;
let perfilCache = null;
let perfilCacheUsuarioId = null;
let perfilCacheHasta = 0;
let consultaPerfilEnCurso = null;
let consultaPerfilUsuarioId = null;
let generacionCachePerfil = 0;

export function invalidarPerfilActual() {
  generacionCachePerfil += 1;
  perfilCache = null;
  perfilCacheUsuarioId = null;
  perfilCacheHasta = 0;
  consultaPerfilEnCurso = null;
  consultaPerfilUsuarioId = null;
}

// Alta propia: el usuario que se registra queda logueado como él mismo, que es
// lo que necesita el alta de cliente (su Edge Function de aviso exige que
// quien llama sea el cliente pendiente recién creado).
export async function signUp(email, password) {
  invalidarPerfilActual();
  const { data, error } = await getSupabase().auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

// Alta administrativa: crea el usuario en Auth sin tocar la sesión de quien lo
// está dando de alta. Lo usa el alta de empleado, donde el dueño/supervisor
// tiene que seguir siendo el usuario activo para que el INSERT del perfil pase
// la policy perfiles_alta por la rama es_jefe().
export async function registrarUsuarioSinIniciarSesion(email, password) {
  const aislado = getSupabaseAislado();
  const { data, error } = await aislado.auth.signUp({ email, password });
  // La sesión del usuario nuevo sólo vive en memoria de este cliente; se
  // descarta enseguida para no dejarla colgada entre altas.
  await aislado.auth.signOut({ scope: 'local' }).catch(() => {});
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  invalidarPerfilActual();
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
  await verificarAccesoSesion();
  return data;
}

// Se consulta el perfil real, nunca user_metadata editable por el usuario.
export async function obtenerPerfilActual({ forzar = false, session: sessionRecibida } = {}) {
  const supabase = getSupabase();
  let session = sessionRecibida;
  if (!session) {
    const resultadoSesion = await supabase.auth.getSession();
    if (resultadoSesion.error) throw resultadoSesion.error;
    session = resultadoSesion.data.session;
  }
  const usuarioId = session?.user?.id;
  if (!usuarioId) {
    invalidarPerfilActual();
    throw new Error('Necesitás iniciar sesión.');
  }

  if (!forzar && perfilCacheUsuarioId === usuarioId && perfilCacheHasta > Date.now()) {
    return perfilCache;
  }
  if (!forzar && consultaPerfilUsuarioId === usuarioId && consultaPerfilEnCurso) {
    return consultaPerfilEnCurso;
  }

  consultaPerfilUsuarioId = usuarioId;
  const generacionConsulta = generacionCachePerfil;
  const consulta = (async () => {
    const resultado = await supabase.from('perfiles')
      .select('id, nombres, apellidos, email, rol, estado, activo').eq('id', usuarioId).maybeSingle();
    if (resultado.error) throw resultado.error;
    // Si hubo logout o cambio de usuario mientras la red respondía, el dato
    // puede completar esta llamada pero no debe volver a poblar la caché.
    if (generacionConsulta === generacionCachePerfil) {
      perfilCache = resultado.data;
      perfilCacheUsuarioId = usuarioId;
      perfilCacheHasta = Date.now() + DURACION_CACHE_PERFIL_MS;
    }
    return resultado.data;
  })();
  consultaPerfilEnCurso = consulta;

  try {
    return await consulta;
  } finally {
    if (consultaPerfilEnCurso === consulta) {
      consultaPerfilEnCurso = null;
      consultaPerfilUsuarioId = null;
    }
  }
}

export async function verificarAccesoSesion() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    invalidarPerfilActual();
    return null;
  }
  const perfil = await obtenerPerfilActual({ session: data.session });
  const motivo = obtenerMotivoBloqueo(perfil);
  if (motivo) {
    // Cerrar la sesión local evita restaurar un cliente pendiente al recargar.
    // Esto no reemplaza las policies: un JWT requiere protección del lado servidor.
    const cierre = await supabase.auth.signOut({ scope: 'local' });
    invalidarPerfilActual();
    if (cierre.error) throw new Error(`${motivo} No se pudo cerrar la sesión; intentá nuevamente.`);
    throw new Error(motivo);
  }
  return data.session;
}

export async function exigirAdministradorClientes() {
  const perfil = await obtenerPerfilActual();
  if (!puedeResolverClientes(perfil)) {
    throw new Error('Sólo dueño o supervisor aprobados y activos pueden administrar clientes.');
  }
  return perfil;
}

// Más permisivo que exigirAdministradorClientes: sólo para LEER la pestaña de
// clientes ya aprobados (dueño/supervisor/metre), no para resolver pendientes.
export async function exigirPermisoClientesActivos() {
  const perfil = await obtenerPerfilActual();
  if (!puedeVerClientesActivos(perfil)) {
    throw new Error('No tenés permiso para ver esta lista de clientes.');
  }
  return perfil;
}

export async function signInAnonymously() {
  invalidarPerfilActual();
  const { data, error } = await getSupabase().auth.signInAnonymously();
  if (error) throw error;
  return data;
}

export async function signOut() {
  try {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
  } finally {
    invalidarPerfilActual();
  }
}

// Las acciones visibles se derivan del perfil ya validado y almacenado en la
// caché corta. No hace falta repetir los RPC mi_rol/es_jefe: la autorización
// efectiva de cada operación continúa protegida por las policies de RLS.
export async function obtenerPermisos() {
  const perfil = await obtenerPerfilActual();

  return {
    rol: perfil.rol,
    esJefe: perfil.rol === ROLES.DUENO || perfil.rol === ROLES.SUPERVISOR,
  };
}
