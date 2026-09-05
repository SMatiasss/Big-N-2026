import { getSupabase, getSupabaseAislado } from './supabase.client.js';
import { obtenerMotivoBloqueo, puedeResolverClientes } from '../utils/acceso-perfil.js';

// Alta propia: el usuario que se registra queda logueado como él mismo, que es
// lo que necesita el alta de cliente (su Edge Function de aviso exige que
// quien llama sea el cliente pendiente recién creado).
export async function signUp(email, password) {
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
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
  await verificarAccesoSesion();
  return data;
}

// Se consulta el perfil real, nunca user_metadata editable por el usuario.
export async function obtenerPerfilActual() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Necesitás iniciar sesión.');
  const resultado = await supabase.from('perfiles')
    .select('id, rol, estado, activo').eq('id', data.user.id).maybeSingle();
  if (resultado.error) throw resultado.error;
  return resultado.data;
}

export async function verificarAccesoSesion() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) return null;
  const perfil = await obtenerPerfilActual();
  const motivo = obtenerMotivoBloqueo(perfil);
  if (motivo) {
    // Cerrar la sesión local evita restaurar un cliente pendiente al recargar.
    // Esto no reemplaza las policies: un JWT requiere protección del lado servidor.
    const cierre = await supabase.auth.signOut({ scope: 'local' });
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

export async function signInAnonymously() {
  const { data, error } = await getSupabase().auth.signInAnonymously();
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}

// Consulta las mismas funciones que usan las policies para decidir las acciones
// visibles. Las reglas de "quién puede dar de alta qué" viven en
// config/permisos.js; acá sólo se traen el rol y la jefatura del perfil actual.
export async function obtenerPermisos() {
  const supabase = getSupabase();
  const [resultadoRol, resultadoJefe] = await Promise.all([
    supabase.rpc('mi_rol'),
    supabase.rpc('es_jefe'),
  ]);

  if (resultadoRol.error) throw resultadoRol.error;
  if (resultadoJefe.error) throw resultadoJefe.error;

  return {
    rol: resultadoRol.data,
    esJefe: resultadoJefe.data === true,
  };
}
