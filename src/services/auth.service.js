import { getSupabase } from './supabase.client.js';

export async function signUp(email, password) {
  const { data, error } = await getSupabase().auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
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

// Consulta las mismas funciones que usan las policies para decidir las acciones visibles.
export async function obtenerPermisosProductos() {
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
