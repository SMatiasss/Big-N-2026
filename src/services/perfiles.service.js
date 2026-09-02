// Alta de empleado/cliente, aprobar/rechazar perfiles (puntos 1, 5-8).
import { getSupabase } from './supabase.client.js';
import { TABLAS, ESTADOS_PERFIL, ROLES_EMPLEADO } from '../config/constantes.js';

export async function altaPerfil(perfil) {
  const { data, error } = await getSupabase().from(TABLAS.PERFILES).insert(perfil).select().single();
  if (error) throw error;
  return data;
}

export async function listarPendientes() {
  const { data, error } = await getSupabase()
    .from(TABLAS.PERFILES)
    .select('*')
    .eq('estado', ESTADOS_PERFIL.PENDIENTE);
  if (error) throw error;
  return data;
}

export async function aprobarPerfil(perfilId) {
  const { data, error } = await getSupabase()
    .from(TABLAS.PERFILES)
    .update({ estado: ESTADOS_PERFIL.APROBADO })
    .eq('id', perfilId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function rechazarPerfil(perfilId) {
  const { data, error } = await getSupabase()
    .from(TABLAS.PERFILES)
    .update({ estado: ESTADOS_PERFIL.RECHAZADO })
    .eq('id', perfilId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listarEmpleados() {
  const { data, error } = await getSupabase()
    .from(TABLAS.PERFILES)
    .select('id, nombres, apellidos, rol, estado')
    .neq('rol', 'cliente_registrado')
    .neq('rol', 'cliente_anonimo')
    .order('apellidos', { ascending: true });
  if (error) throw error;
  return data;
}