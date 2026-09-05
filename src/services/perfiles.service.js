// Alta de empleado/cliente, aprobar/rechazar perfiles (puntos 1, 5-8, 9).
import { getSupabase } from './supabase.client.js';
import { BUCKETS, ESTADOS_PERFIL, ROLES, ROLES_EMPLEADO, TABLAS } from '../config/constantes.js';
import { esArchivoImagen } from '../utils/validadores.js';
export async function altaPerfil(perfil) {
  const { data, error } = await getSupabase().from(TABLAS.PERFILES).insert(perfil).select().single();
  if (error) throw error;
  return data;
}

// Traduce el MIME del File a una extensión admitida por el bucket.
function obtenerExtensionImagen(archivo) {
  if (archivo.type === 'image/png') return 'png';
  if (archivo.type === 'image/webp') return 'webp';
  return 'jpg';
}

export async function subirFotoPerfil(foto) {
  if (!foto) return null;
  const supabase = getSupabase();
  const extension = obtenerExtensionImagen(foto);
  const path = `perfiles/${crypto.randomUUID()}.${extension}`;
  const { data: subida, error: errorSubida } = await supabase.storage
    .from(BUCKETS.PERFILES)
    .upload(path, foto, { contentType: foto.type, upsert: false });
  if (errorSubida) throw errorSubida;
  const { data: urlPublica } = supabase.storage.from(BUCKETS.PERFILES).getPublicUrl(subida.path);
  return urlPublica.publicUrl;
}

// Crea el perfil del cliente anónimo (punto 9): sube primero la foto y recién
// después inserta la fila, mismo orden y mismo motivo que crearMesaCompleta en
// mesas.service.js — perfiles también bloquea el DELETE físico (trigger
// trg_no_delete_perfiles), así que insertar antes dejaría una fila huérfana
// e imborrable si la subida de la foto fallara.
//
// El PDF (punto 9) sólo pide un campo "nombre" para el cliente anónimo, pero
// perfiles.apellidos es NOT NULL en el schema (sin excepción para este rol,
// a diferencia de dni que sí la tiene). Se resuelve guardando el mismo valor
// en nombres y apellidos; la UI que lista clientes en espera sólo muestra
// nombres, así que no se ve duplicado en pantalla.
export async function crearClienteAnonimo({ nombre, foto }) {
  if (!esArchivoImagen(foto)) {
    throw new Error('Necesitás una foto válida para ingresar.');
  }

  const supabase = getSupabase();
  // getSession() en vez de getUser(): esto corre inmediatamente después de
  // signInAnonymously(), y getUser() revalida por red contra el servidor de
  // Auth — más propenso a un "Auth session missing!" espurio que leer la
  // sesión recién creada desde el almacenamiento local.
  const { data: { session }, error: errorSesion } = await supabase.auth.getSession();
  if (errorSesion) throw errorSesion;
  if (!session) throw new Error('No hay una sesión anónima activa.');
  const user = session.user;

  const extension = obtenerExtensionImagen(foto);
  const path = `perfiles/${crypto.randomUUID()}.${extension}`;

  const { data: subida, error: errorSubida } = await supabase.storage
    .from(BUCKETS.PERFILES)
    .upload(path, foto, { contentType: foto.type, upsert: false });
  if (errorSubida) throw errorSubida;

  const { data: urlPublica } = supabase.storage.from(BUCKETS.PERFILES).getPublicUrl(subida.path);

  try {
    return await altaPerfil({
      id: user.id,
      nombres: nombre,
      apellidos: nombre,
      rol: ROLES.CLIENTE_ANONIMO,
      foto_url: urlPublica.publicUrl,
    });
  } catch (errorAlta) {
    try {
      const { error } = await supabase.storage.from(BUCKETS.PERFILES).remove([subida.path]);
      if (error) throw error;
    } catch (errorLimpieza) {
      console.error('No se pudo borrar la foto de un alta de cliente anónimo fallida.', errorLimpieza);
    }
    throw errorAlta;
  }
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
    .in('rol', ROLES_EMPLEADO)
    .order('apellidos', { ascending: true });
  if (error) throw error;
  return data;
}