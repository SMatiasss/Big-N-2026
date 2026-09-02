// Alta de mesa, disponibilidad, QR (punto 4).
import { getSupabase } from './supabase.client.js';
import { BUCKETS, ESTADOS_MESA, TABLAS } from '../config/constantes.js';
import { esArchivoImagen } from '../utils/validadores.js';

export async function altaMesa(mesa) {
  //.select() devuelve la tabla generada (util ya que mesas crea su QR automaticamente en sql)
  //.single() devuelve la data como un objeto, normalmente lo haría como un array.
  //(si viene mas de 1 objeto, lo trata como error)
  const { data, error } = await getSupabase().from(TABLAS.MESAS).insert(mesa).select().single();
  if (error) throw error;
  return data;
}

// Traduce el MIME del File a una extensión admitida por el bucket.
function obtenerExtensionImagen(archivo) {
  if (archivo.type === 'image/png') return 'png';
  if (archivo.type === 'image/webp') return 'webp';
  return 'jpg';
}

// Registra una mesa completa: sube primero la foto a Storage y recién después
// inserta la fila con foto_url ya resuelto.
// El orden es así (y no al revés) porque la tabla mesas bloquea el DELETE físico
// (trigger trg_no_delete_mesas, punto 2 de 03_baja_logica.sql): si insertáramos
// la mesa antes y la subida de la foto fallara, quedaría una fila huérfana que
// nadie puede borrar y que traba el número para siempre (unique constraint).
// Subiendo primero, un fallo de Storage no deja ningún rastro en la tabla.
export async function crearMesaCompleta(datosMesa, foto) {
  if (!esArchivoImagen(foto)) {
    throw new Error('La mesa debe tener una foto válida.');
  }

  const supabase = getSupabase();
  const extension = obtenerExtensionImagen(foto);
  const path = `mesas/${crypto.randomUUID()}.${extension}`;

  const { data: subida, error: errorSubida } = await supabase.storage
    .from(BUCKETS.MESAS)
    .upload(path, foto, {
      contentType: foto.type,
      upsert: false,
    });
  if (errorSubida) throw errorSubida;

  const { data: urlPublica } = supabase.storage.from(BUCKETS.MESAS).getPublicUrl(subida.path);

  try {
    return await altaMesa({ ...datosMesa, foto_url: urlPublica.publicUrl });
  } catch (errorAlta) {
    // La mesa no llegó a crearse (por ejemplo, número duplicado): la foto
    // subida a Storage sí se puede borrar sin problema, a diferencia de la fila.
    try {
      const { error } = await supabase.storage.from(BUCKETS.MESAS).remove([subida.path]);
      if (error) throw error;
    } catch (errorLimpieza) {
      console.error('No se pudo borrar la foto de un alta de mesa fallida.', errorLimpieza);
    }
    throw errorAlta;
  }
}

export async function listarMesas() {
  // numero es unique en el schema, así que Postgres ya tiene el índice
  // que hace este order by gratis; no hace falta uno aparte.
  const { data, error } = await getSupabase().from(TABLAS.MESAS).select('*').order('numero');
  if (error) throw error;
  return data;
}

// Mesas que el metre puede ofrecer para asignar (punto 10): libres y activas
// (una mesa dada de baja lógicamente no debe aparecer para asignación nueva).
export async function listarMesasLibres() {
  const { data, error } = await getSupabase()
    .from(TABLAS.MESAS)
    .select('*')
    .eq('estado', ESTADOS_MESA.LIBRE)
    .eq('activa', true)
    .order('numero');
  if (error) throw error;
  return data;
}

export async function actualizarDisponibilidad(mesaId, disponible) {
  const { data, error } = await getSupabase()
    .from(TABLAS.MESAS)
    .update({ disponible })
    .eq('id', mesaId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
