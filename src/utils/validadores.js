// Validación de DNI, email, campos vacíos (punto excluyente: sin usar alert()).

export const TIPOS_IMAGEN_PRODUCTO = ['image/jpeg', 'image/png', 'image/webp'];
export const TAMANO_MAXIMO_IMAGEN_PRODUCTO = 5 * 1024 * 1024;

export function esEmailValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

export function esDniValido(valor) {
  return /^\d{7,8}$/.test(String(valor).trim());
}

export function esCuilValido(valor) {
  const cuil = String(valor).replace(/\D/g, '');
  if (!/^\d{11}$/.test(cuil)) return false;

  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((total, peso, indice) => total + Number(cuil[indice]) * peso, 0);
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto === 10 ? 9 : resto;
  return Number(cuil[10]) === verificador;
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
// por ejemplo el tiempo de elaboración de un plato.
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

// Explica por qué un archivo no cumple el contrato del bucket productos.
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
