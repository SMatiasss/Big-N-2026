// Generar/leer QR: wrapper fino sobre una lib externa (agregarla a package.json cuando se elija cuál).

export function generarQR(valor) {
  throw new Error('generarQR: falta instalar y conectar la librería de generación de QR');
}

export function leerQR(imagenOStream) {
  throw new Error('leerQR: falta instalar y conectar la librería de lectura de QR');
}
