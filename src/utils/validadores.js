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
