// Generar/leer QR: wrapper fino sobre una lib externa (agregarla a package.json cuando se elija cuál).
// Validación del QR de ingreso al local (punto 9) contra configuracion.qr_ingreso_token,
// que es de lectura pública para cualquier autenticado (policy config_lectura).
import { getSupabase } from './supabase.client.js';
import { TABLAS } from '../config/constantes.js';

const CLAVE_QR_INGRESO = 'qr_ingreso_token';

export function generarQR(valor) {
  throw new Error('generarQR: falta instalar y conectar la librería de generación de QR');
}

export function leerQR(imagenOStream) {
  throw new Error('leerQR: falta instalar y conectar la librería de lectura de QR');
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
