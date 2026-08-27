// Alta de plato/bebida, listar carta (puntos 2, 3, 11).
import { getSupabase } from './supabase.client.js';
import { BUCKETS, TABLAS } from '../config/constantes.js';
import { esArchivoImagen } from '../utils/validadores.js';

const CANTIDAD_FOTOS_PLATO = 3;

// Traduce el MIME del File a una extensión admitida por el bucket.
function obtenerExtensionImagen(archivo) {
  if (archivo.type === 'image/png') return 'png';
  if (archivo.type === 'image/webp') return 'webp';
  return 'jpg';
}

export async function altaProducto(producto) {
  const { data, error } = await getSupabase().from(TABLAS.PRODUCTOS).insert(producto).select().single();
  if (error) throw error;
  return data;
}

export async function listarCarta() {
  const { data, error } = await getSupabase().from(TABLAS.PRODUCTOS).select('*');
  if (error) throw error;
  return data;
}

// Consulta un producto por UUID junto con sus fotografías relacionadas.
// Devuelve las fotos ordenadas para verificar el resultado completo de HU02.
export async function obtenerProductoPorId(productoId) {
  const { data, error } = await getSupabase()
    .from(TABLAS.PRODUCTOS)
    // La verificación final recupera sólo las columnas reales de producto_fotos.
    .select(`*, ${TABLAS.PRODUCTO_FOTOS}(id, producto_id, url, orden)`)
    .eq('id', productoId)
    .single();

  if (error) throw error;

  data[TABLAS.PRODUCTO_FOTOS] = [...(data[TABLAS.PRODUCTO_FOTOS] ?? [])]
    .sort((fotoA, fotoB) => fotoA.orden - fotoB.orden);
  return data;
}

// Intenta deshacer recursos creados después de un error.
// Cada limpieza tiene su propio try/catch para conservar siempre el error original.
async function limpiarAltaIncompleta(productoId, pathsSubidos) {
  const supabase = getSupabase();

  if (pathsSubidos.length > 0) {
    try {
      const { error } = await supabase.storage.from(BUCKETS.PRODUCTOS).remove(pathsSubidos);
      if (error) throw error;
    } catch (errorLimpieza) {
      console.error('No se pudieron borrar imágenes de un alta incompleta.', errorLimpieza);
    }
  }

  try {
    const { error } = await supabase
      .from(TABLAS.PRODUCTO_FOTOS)
      .delete()
      .eq('producto_id', productoId);
    if (error) throw error;
  } catch (errorLimpieza) {
    console.error('No se pudieron borrar las relaciones de fotos incompletas.', errorLimpieza);
  }

  try {
    const { error } = await supabase
      .from(TABLAS.PRODUCTOS)
      .delete()
      .eq('id', productoId);
    if (error) throw error;
  } catch (errorLimpieza) {
    console.error('No se pudo borrar el producto del alta incompleta.', errorLimpieza);
  }
}

// Registra un plato completo en Supabase.
// Primero crea el producto, luego sube sus tres imágenes y finalmente inserta
// producto_fotos. Si algo falla, intenta limpiar todo lo creado y propaga el error original.
export async function crearPlatoCompleto(datosPlato, imagenes) {
  if (!Array.isArray(imagenes)
    || imagenes.length !== CANTIDAD_FOTOS_PLATO
    || !imagenes.every(esArchivoImagen)) {
    throw new Error('El plato debe contener exactamente tres imágenes válidas.');
  }

  const supabase = getSupabase();
  const pathsSubidos = [];
  let productoCreado;

  try {
    // await pausa esta función hasta recibir la fila insertada. Su UUID generado
    // por PostgreSQL se usa para organizar y relacionar las tres fotografías.
    productoCreado = await altaProducto(datosPlato);

    const fotosParaInsertar = [];

    // La subida secuencial permite saber con precisión qué paths deben borrarse
    // si una imagen posterior falla.
    for (let indice = 0; indice < imagenes.length; indice += 1) {
      const archivo = imagenes[indice];
      const extension = obtenerExtensionImagen(archivo);
      const path = `platos/${productoCreado.id}/${crypto.randomUUID()}.${extension}`;

      const { data: subida, error: errorSubida } = await supabase.storage
        .from(BUCKETS.PRODUCTOS)
        .upload(path, archivo, {
          contentType: archivo.type,
          upsert: false,
        });

      if (errorSubida) throw errorSubida;
      pathsSubidos.push(subida.path);

      const { data: urlPublica } = supabase.storage
        .from(BUCKETS.PRODUCTOS)
        .getPublicUrl(subida.path);

      fotosParaInsertar.push({
        producto_id: productoCreado.id,
        url: urlPublica.publicUrl,
        orden: indice + 1,
      });
    }

    // Un único INSERT envía exactamente las tres relaciones con orden 1, 2 y 3.
    const { error: errorFotos } = await supabase
      .from(TABLAS.PRODUCTO_FOTOS)
      .insert(fotosParaInsertar);
    if (errorFotos) throw errorFotos;

    return await obtenerProductoPorId(productoCreado.id);
  } catch (errorOriginal) {
    if (productoCreado?.id) {
      await limpiarAltaIncompleta(productoCreado.id, pathsSubidos);
    }
    throw errorOriginal;
  }
}
