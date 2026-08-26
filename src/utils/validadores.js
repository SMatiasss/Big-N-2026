// Validación de DNI, email, campos vacíos (punto excluyente: sin usar alert()).

export function esEmailValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

export function esDniValido(valor) {
  return /^\d{7,8}$/.test(String(valor).trim());
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

// Un File representa un archivo elegido desde el dispositivo.
// Además de comprobar su tipo, verificamos que realmente tenga contenido.
export function esArchivoImagen(archivo) {
  return archivo instanceof File && archivo.type.startsWith('image/') && archivo.size > 0;
}

// Comprueba que el array tenga la cantidad pedida y que todas sus posiciones
// contengan archivos de imagen válidos.
export function hayCantidadExactaDeImagenes(imagenes, cantidad) {
  return Array.isArray(imagenes)
    && imagenes.length === cantidad
    && imagenes.every(esArchivoImagen);
}
