import './lista-ajustada.css';

// Lee un número de una custom property (ej. --la-items: 5).
function leerNumero(estilos, propiedad, porDefecto) {
  const valor = parseFloat(estilos.getPropertyValue(propiedad));
  return Number.isFinite(valor) ? valor : porDefecto;
}

// Recalcula ante cambios de tamaño (rotar el teléfono, teclado) y de contenido
// (llega/se va un elemento por realtime o al cambiar de pestaña).
function observar(elemento, aplicar) {
  const porTamanio = new ResizeObserver(aplicar);
  porTamanio.observe(elemento);

  const porContenido = new MutationObserver(aplicar);
  porContenido.observe(elemento, { childList: true });

  return {
    actualizar: aplicar,
    destruir() {
      porTamanio.disconnect();
      porContenido.disconnect();
    },
  };
}

/**
 * Da a los elementos de un listado un alto uniforme calculado para que entren
 * --la-items completos en el alto visible, de modo que el scroll (con snap)
 * nunca deje uno cortado.
 *
 * Si hay menos elementos que los que entran, NO se toca el alto: cada uno
 * conserva el suyo natural en vez de estirarse para llenar la pantalla.
 *
 * @param {HTMLElement} lista - El contenedor con la clase .lista-ajustada.
 */
export function ajustarLista(lista) {
  function aplicar() {
    const estilos = getComputedStyle(lista);
    const items = leerNumero(estilos, '--la-items', 0);
    const gap = leerNumero(estilos, '--la-gap', 0);
    const alto = lista.clientHeight;

    // Con pocos elementos no hace falta encajarlos: sin scroll no hay nada
    // que se pueda cortar, y forzarles un alto sólo los estiraría.
    if (!items || !alto || lista.childElementCount <= items) {
      lista.style.removeProperty('--la-alto');
      return;
    }

    lista.style.setProperty('--la-alto', `${(alto - (items - 1) * gap) / items}px`);
  }

  aplicar();
  return observar(lista, aplicar);
}

/**
 * Igual que ajustarLista pero para una grilla de celdas cuadradas (mesas):
 * busca el lado que hace entrar un número entero de filas en el alto visible,
 * sin pasarse del que permite el ancho. Las celdas quedan cuadradas y la
 * última fila se llena sólo con los elementos que haya.
 *
 * @param {HTMLElement} grilla - El contenedor con la clase .grilla-ajustada.
 * @param {object} [opciones]
 * @param {number} [opciones.columnas] - Columnas deseadas (default: 3).
 */
export function ajustarGrilla(grilla, { columnas = 3 } = {}) {
  function aplicar() {
    const estilos = getComputedStyle(grilla);
    const gap = leerNumero(estilos, '--la-gap', 0);
    const alto = grilla.clientHeight;
    const ancho = grilla.clientWidth;
    if (!alto || !ancho) return;

    // Lado máximo que permite el ancho con las columnas pedidas.
    const ladoPorAncho = (ancho - (columnas - 1) * gap) / columnas;

    // Cuántas filas de ese lado entran completas, y el lado exacto para que
    // esas filas llenen el alto justo (así ninguna queda cortada abajo).
    const filas = Math.max(1, Math.floor((alto + gap) / (ladoPorAncho + gap)));
    const lado = Math.min(ladoPorAncho, (alto - (filas - 1) * gap) / filas);

    grilla.style.setProperty('--la-columnas', String(columnas));
    grilla.style.setProperty('--la-lado', `${lado}px`);
  }

  aplicar();
  return observar(grilla, aplicar);
}
