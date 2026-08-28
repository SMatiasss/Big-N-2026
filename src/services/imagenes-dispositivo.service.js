// Capacitor permite distinguir si la aplicación corre dentro de Android/iOS
// y comprobar si el plugin nativo Camera quedó registrado correctamente.
import { Capacitor } from '@capacitor/core';
import {
  Camera,
  CameraErrorCode,
  EncodingType,
  MediaTypeSelection,
} from '@capacitor/camera';

export const ORIGEN_IMAGEN = {
  CAMARA: 'camara',
  GALERIA: 'galeria',
};

const CODIGOS_CANCELACION = new Set([
  CameraErrorCode.TakePhotoCancelled,
  CameraErrorCode.ChooseMediaCancelled,
]);

const LADO_MAXIMO_IMAGEN = 1280;
const CALIDAD_JPEG = 0.7;

// Informa si se puede usar la implementación nativa de Camera.
// Devuelve false en un navegador o si faltó sincronizar el plugin.
export function puedeUsarCameraNativa() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Camera');
}

// Convierte una cadena base64 en Blob. Se usa sólo como respaldo cuando
// Camera no entrega una ruta accesible para obtener el archivo completo.
function base64ABlob(base64, tipo) {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);

  for (let indice = 0; indice < binario.length; indice += 1) {
    bytes[indice] = binario.charCodeAt(indice);
  }

  return new Blob([bytes], { type: tipo });
}

// Normaliza el formato informado por Camera para producir un MIME admitido.
// Android puede devolver "jpg", que representa el mismo formato que "jpeg".
function obtenerTipoMime(resultado, blob) {
  if (blob?.type?.startsWith('image/')) {
    return blob.type === 'image/jpg' ? 'image/jpeg' : blob.type;
  }

  const formato = resultado.metadata?.format?.toLowerCase();
  if (formato === 'png') return 'image/png';
  if (formato === 'webp') return 'image/webp';
  return 'image/jpeg';
}

// Android puede devolver un archivo grande aunque Camera reciba opciones de calidad.
// Esta segunda compresión limita las dimensiones y genera un JPEG liviano antes de validarlo.
async function comprimirImagenNativa(blob) {
  const imagen = await createImageBitmap(blob);
  const escala = Math.min(
    1,
    LADO_MAXIMO_IMAGEN / imagen.width,
    LADO_MAXIMO_IMAGEN / imagen.height,
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(imagen.width * escala));
  canvas.height = Math.max(1, Math.round(imagen.height * escala));

  const contexto = canvas.getContext('2d');
  if (!contexto) {
    imagen.close();
    throw new Error('No se pudo preparar la imagen tomada con el dispositivo.');
  }

  contexto.fillStyle = '#ffffff';
  contexto.fillRect(0, 0, canvas.width, canvas.height);
  contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
  imagen.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (imagenComprimida) => {
        if (imagenComprimida) {
          resolve(imagenComprimida);
        } else {
          reject(new Error('No se pudo comprimir la imagen tomada con el dispositivo.'));
        }
      },
      'image/jpeg',
      CALIDAD_JPEG,
    );
  });
}

// Convierte el MediaResult real de Camera 8.2 en el File que usan las altas de productos.
// Intenta webPath, luego la URI convertida para WebView y finalmente thumbnail.
// Devuelve un File compatible con previews, validadores y Supabase Storage.
async function resultadoCameraAFile(resultado) {
  if (!resultado) return null;

  const rutaLegible = resultado.webPath
    ?? (resultado.uri ? Capacitor.convertFileSrc(resultado.uri) : null);
  let blob;

  if (rutaLegible) {
    const respuesta = await fetch(rutaLegible);
    if (!respuesta.ok) {
      throw new Error('No se pudo leer la imagen obtenida del dispositivo.');
    }
    blob = await respuesta.blob();
  } else if (resultado.thumbnail) {
    const tipoTemporal = obtenerTipoMime(resultado);
    blob = base64ABlob(resultado.thumbnail, tipoTemporal);
  } else {
    throw new Error('Camera no devolvió una ruta o contenido de imagen utilizable.');
  }

  const blobComprimido = await comprimirImagenNativa(blob);
  const nombre = `producto-${crypto.randomUUID()}.jpg`;

  // File hereda de Blob y además agrega nombre y fecha. Esa forma es la que
  // ya espera el selector y la que luego puede subir Supabase Storage.
  return new File([blobComprimido], nombre, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

// Obtiene una foto desde cámara o galería en una plataforma nativa.
// Recibe el origen elegido por el componente y devuelve File o null al cancelar.
export async function obtenerImagenNativa(origen) {
  if (!puedeUsarCameraNativa()) {
    throw new Error('Camera no está disponible en esta plataforma.');
  }

  try {
    let resultado;

    if (origen === ORIGEN_IMAGEN.CAMARA) {
      resultado = await Camera.takePhoto({
        quality: 70,
        targetWidth: LADO_MAXIMO_IMAGEN,
        targetHeight: LADO_MAXIMO_IMAGEN,
        correctOrientation: true,
        encodingType: EncodingType.JPEG,
        saveToGallery: false,
        includeMetadata: true,
      });
    } else if (origen === ORIGEN_IMAGEN.GALERIA) {
      const seleccion = await Camera.chooseFromGallery({
        mediaType: MediaTypeSelection.Photo,
        allowMultipleSelection: false,
        quality: 70,
        targetWidth: LADO_MAXIMO_IMAGEN,
        targetHeight: LADO_MAXIMO_IMAGEN,
        correctOrientation: true,
        includeMetadata: true,
      });
      resultado = seleccion.results?.[0] ?? null;
    } else {
      throw new Error('El origen de imagen solicitado no es válido.');
    }

    return await resultadoCameraAFile(resultado);
  } catch (error) {
    // Cancelar no es un fallo funcional: se devuelve null y se conserva
    // la imagen que ya estaba en esa posición.
    if (CODIGOS_CANCELACION.has(error?.code)
      || /cancel/i.test(error?.message ?? '')) {
      return null;
    }
    throw error;
  }
}
