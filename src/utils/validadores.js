// Validación de DNI, email, campos vacíos (punto excluyente: sin usar alert()).

export const TIPOS_IMAGEN_PRODUCTO = ['image/jpeg', 'image/png', 'image/webp'];
export const TAMANO_MAXIMO_IMAGEN_PRODUCTO = 5 * 1024 * 1024;

export function esEmailValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

export function esDniValido(valor) {
  return /^\d{7,8}$/.test(String(valor).trim());
}

// Prefijos de CUIL de personas: 20 y 27 (según el sexo registrado), 23 y 24
// (asignados cuando el cálculo con 20/27 no da un verificador posible, o por
// duplicados). 30, 33 y 34 son de empresas (CUIT), no de empleados.
const PREFIJOS_CUIL_PERSONA = ['20', '23', '24', '27'];

/**
 * Qué tiene de malo un CUIL, o null si es válido. Un solo mensaje por causa,
 * así el formulario puede decir por qué lo rechaza en vez de "11 dígitos"
 * para todo.
 *
 * @param {string} valor - El CUIL, con o sin guiones.
 * @param {string} [dni] - Si viene un DNI válido, el CUIL tiene que contenerlo
 *   (prefijo + DNI de 8 dígitos + verificador).
 * @returns {string|null}
 */
export function errorCuil(valor, dni) {
  const cuil = String(valor ?? '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(cuil)) return 'CUIL de 11 dígitos.';

  if (!PREFIJOS_CUIL_PERSONA.includes(cuil.slice(0, 2))) return 'Prefijo de CUIL inválido.';

  if (dni !== undefined && esDniValido(dni) && cuil.slice(2, 10) !== String(dni).trim().padStart(8, '0')) {
    return 'No coincide con el DNI.';
  }

  // Módulo 11. Un resto de 10 no es un CUIL posible: en ese caso a la persona
  // se le asigna el prefijo 23, y con él la cuenta ya da 9 o 4. Por eso se
  // rechaza en vez de aceptarlo como 9, que dejaba pasar CUIL inexistentes.
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((total, peso, indice) => total + Number(cuil[indice]) * peso, 0);
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto;
  if (resto === 10 || Number(cuil[10]) !== verificador) return 'Último dígito inválido.';

  return null;
}

export function esCuilValido(valor) {
  return errorCuil(valor) === null;
}

export function esNombrePersonaValido(valor) {
  return /^[a-záéíóúüñ]+(?:[ '-][a-záéíóúüñ]+)*$/i.test(String(valor).trim());
}

export function esCampoVacio(valor) {
  return valor === undefined || valor === null || String(valor).trim() === '';
}

// Comprueba textos obligatorios sin aceptar cadenas formadas solamente por espacios.
// Recibe cualquier valor y devuelve true cuando contiene texto utilizable.
export function esTextoObligatorioValido(valor) {
  return !esCampoVacio(valor);
}

// Valida cantidades que deben expresarse como números enteros mayores que cero,
// por ejemplo el tiempo de elaboración de un plato, el número de mesa
// o la cantidad de comensales.
export function esEnteroPositivo(valor) {
  if (esCampoVacio(valor)) return false;

  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0;
}

// Valida valores numéricos positivos y permite decimales, como el precio.
// Number.isFinite evita aceptar valores especiales como Infinity.
export function esNumeroPositivo(valor) {
  if (esCampoVacio(valor)) return false;

  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0;
}

// Explica por qué un archivo no cumple el contrato del bucket de imágenes.
// Devuelve una cadena vacía cuando el archivo es válido.
export function obtenerErrorArchivoImagen(archivo) {
  if (!(archivo instanceof File) || archivo.size === 0) {
    return 'Seleccioná un archivo de imagen válido.';
  }

  if (!TIPOS_IMAGEN_PRODUCTO.includes(archivo.type)) {
    return 'La imagen debe estar en formato JPEG, PNG o WebP.';
  }

  if (archivo.size > TAMANO_MAXIMO_IMAGEN_PRODUCTO) {
    return 'La imagen no puede superar los 5 MB.';
  }

  return '';
}

// Un File representa una imagen elegida u obtenida desde el dispositivo.
// Se valida con las mismas reglas configuradas en Supabase Storage.
export function esArchivoImagen(archivo) {
  return obtenerErrorArchivoImagen(archivo) === '';
}

// Comprueba que el array tenga la cantidad pedida y que todas sus posiciones
// contengan archivos de imagen válidos.
export function hayCantidadExactaDeImagenes(imagenes, cantidad) {
  return Array.isArray(imagenes)
    && imagenes.length === cantidad
    && imagenes.every(esArchivoImagen);
}
