// Generar/leer QR.
// La lectura la hace @capacitor-mlkit/barcode-scanning directo desde la
// cámara (ver components/lector-qr): acá sólo queda la generación, con la
// librería "qrcode" (agregada a package.json), para mostrar/exportar el QR
// ya impreso en la mesa (ver components/modal-qr-mesa).
// Validación del QR de ingreso al local (punto 9) contra configuracion.qr_ingreso_token,
// que es de lectura pública para cualquier autenticado (policy config_lectura).
import QRCode from 'qrcode';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { getSupabase } from './supabase.client.js';
import { TABLAS } from '../config/constantes.js';

const CLAVE_QR_INGRESO = 'qr_ingreso_token';

// Data URL (image/png) del QR de "valor". Tamaño fijo en píxeles CSS; se
// duplica por devicePixelRatio para que se vea nítido en pantallas de alta
// densidad y también sirva como imagen para compartir/imprimir.
export async function generarQR(valor, { lado = 320 } = {}) {
  const escala = Math.max(1, Math.round(window.devicePixelRatio || 1));
  return QRCode.toDataURL(String(valor), {
    width: lado * escala,
    margin: 1,
    color: { dark: '#283618', light: '#fefae0' },
  });
}

function puedeCompartirArchivosNativo() {
  return Capacitor.isNativePlatform()
    && Capacitor.isPluginAvailable('Share')
    && Capacitor.isPluginAvailable('Filesystem');
}

// Comparte el PNG del QR con el selector nativo (Android "compartir a...").
// En una notebook/navegador de escritorio no hay share sheet: se descarga el
// PNG directo, que es la alternativa equivalente para el dueño en la web.
//
// El archivo se escribe primero en el caché de la app: Share.share() sólo
// acepta URLs file:// (o content://), nunca un data URL, así que no alcanza
// con pasarle directamente lo que generó generarQR().
export async function compartirImagen(dataUrl, { nombreArchivo, titulo, texto }) {
  if (!puedeCompartirArchivosNativo()) {
    const enlace = document.createElement('a');
    enlace.href = dataUrl;
    enlace.download = nombreArchivo;
    enlace.click();
    return;
  }

  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const { uri } = await Filesystem.writeFile({
    path: nombreArchivo,
    data: base64,
    directory: Directory.Cache,
  });
  await Share.share({ title: titulo, text: texto, files: [uri] });
}

export async function obtenerTokenIngreso() {
  const { data, error } = await getSupabase()
    .from(TABLAS.CONFIGURACION)
    .select('valor')
    .eq('clave', CLAVE_QR_INGRESO)
    .single();
  if (error) throw error;
  return data.valor;
}

// El contenido leído del lector puede venir como el token pelado o con un
// prefijo tipo "ingreso:" (mismo patrón documentado para el QR de mesa,
// "'mesa:' || qr_token", en 01_schema.sql) — se admiten ambos formatos
// porque todavía no está definido cómo se va a imprimir el QR físico.
export async function validarQrIngreso(contenido) {
  const tokenEsperado = await obtenerTokenIngreso();
  const token = String(contenido).trim().replace(/^ingreso:/, '');
  return token === tokenEsperado;
}
