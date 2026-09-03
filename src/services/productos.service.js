// Alta de plato/bebida, listar carta (puntos 2, 3, 11).
import { getSupabase } from './supabase.client.js';
import { BUCKETS, TABLAS } from '../config/constantes.js';
import { esArchivoImagen } from '../utils/validadores.js';

const CANTIDAD_FOTOS_PRODUCTO = 3;

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

// La carta operativa y una futura carta general pueden compartir esta lectura.
// La validación de mesa se realiza antes de abrir la vista operativa, no se cambia
// la policy pública de productos que también necesitan otros requisitos.
export async function listarCartaConFotos() {
  const { data, error } = await getSupabase().from(TABLAS.PRODUCTOS)
    .select('id, nombre, descripcion, precio, tiempo_elaboracion_min, tipo, producto_fotos(id, url, orden)')
    .eq('activo', true).order('nombre');
  if (error) throw error;
  return data;
}

// Busca coincidencias de nombre sin distinguir mayúsculas, igual que el índice
// único de productos. La base seguirá siendo la protección final ante concurrencia.
export async function existeProductoEnCarta(nombre) {
  const nombreNormalizado = nombre.trim().toLocaleLowerCase('es');
  const { data, error } = await getSupabase()
    .from(TABLAS.PRODUCTOS)
    .select('id, nombre');

  if (error) throw error;
  return data.some((producto) => producto.nombre.trim().toLocaleLowerCase('es') === nombreNormalizado);
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

// Registra cualquier producto completo. Centraliza INSERT, Storage, fotos y verificación
// para que platos y bebidas compartan el mismo flujo sin duplicar persistencia.
async function crearProductoCompleto(datosProducto, imagenes) {
  if (!Array.isArray(imagenes)
    || imagenes.length !== CANTIDAD_FOTOS_PRODUCTO
    || !imagenes.every(esArchivoImagen)) {
    throw new Error('El producto debe contener exactamente tres imágenes válidas.');
  }

  if (await existeProductoEnCarta(datosProducto.nombre)) {
    throw new Error('Ya existe un producto con ese nombre en la carta.');
  }

  const supabase = getSupabase();
  const pathsSubidos = [];
  let productoCreado;

  try {
    // El creador se obtiene de la sesión verificada, no del formulario ni de
    // metadata editable. Esto deja trazabilidad y permite un rollback seguro.
    const { data: usuarioActual, error: errorUsuario } = await supabase.auth.getUser();
    if (errorUsuario) throw errorUsuario;
    if (!usuarioActual.user) {
      throw new Error('Necesitás iniciar sesión para registrar un producto.');
    }

    // await pausa esta función hasta recibir la fila insertada. Su UUID generado
    // por PostgreSQL se usa para organizar y relacionar las tres fotografías.
    productoCreado = await altaProducto({
      ...datosProducto,
      creado_por: usuarioActual.user.id,
    });

    const fotosParaInsertar = [];

    // La subida secuencial permite saber con precisión qué paths deben borrarse
    // si una imagen posterior falla.
    for (let indice = 0; indice < imagenes.length; indice += 1) {
      const archivo = imagenes[indice];
      const extension = obtenerExtensionImagen(archivo);
      // La policy de Storage limita las altas al prefijo productos. El tipo
      // separa platos y bebidas dentro del mismo bucket compartido.
      const path = `productos/${datosProducto.tipo}/${productoCreado.id}/${crypto.randomUUID()}.${extension}`;

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
    if (errorOriginal?.code === '23505') {
      throw new Error('Ya existe un producto con ese nombre en la carta.');
    }
    throw errorOriginal;
  }
}

// Los wrappers mantienen una API expresiva para cada historia de usuario.
export function crearPlatoCompleto(datosPlato, imagenes) {
  return crearProductoCompleto(datosPlato, imagenes);
}

export function crearBebidaCompleta(datosBebida, imagenes) {
  return crearProductoCompleto(datosBebida, imagenes);
}
