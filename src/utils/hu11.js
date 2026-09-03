// El QR de mesa conserva el formato documentado por el equipo: mesa:<UUID>.
export function normalizarQrMesa(contenido) {
  const token = String(contenido ?? '').trim().replace(/^mesa:/, '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    throw new Error('El código no corresponde a un QR de mesa válido.');
  }
  return token.toLowerCase();
}

export function validarMensaje(texto) {
  const cuerpo = typeof texto === 'string' ? texto.trim() : '';
  if (!cuerpo) throw new Error('Escribí un mensaje antes de enviar.');
  if ([...cuerpo].length > 1000) throw new Error('El mensaje puede tener hasta 1000 caracteres.');
  return cuerpo;
}

export function ordenarFotosProducto(fotos = []) {
  // Nunca se inventan fotos. Cada posición representa orden 1, 2 o 3 de la BD.
  return [1, 2, 3].map(orden => fotos.find(foto => foto.orden === orden)?.url ?? null);
}

// Una ventana de 100 sin solapamiento puede ocultar mensajes recibidos offline.
// En ese caso se vuelve a la última página y se habilita paginar hacia atrás.
export function haySaltoEnHistorial(actuales, recientes) {
  return actuales.length > 0 && recientes.length === 100 &&
    !recientes.some(nuevo => actuales.some(anterior => anterior.id === nuevo.id));
}
