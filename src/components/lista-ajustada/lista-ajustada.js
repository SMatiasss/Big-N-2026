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

// ¿El foco está en un campo del formulario? Si lo está, un "resize" es casi
// seguro el teclado virtual tapando media pantalla, no un cambio real del alto
// disponible: recalcular ahí aplastaría el formulario mientras se escribe.
function hayCampoEnfoco(contenido) {
  const activo = document.activeElement;
  if (!activo || !contenido.contains(activo)) return false;
  return /^(INPUT|TEXTAREA|SELECT|ION-SELECT|ION-INPUT|ION-TEXTAREA)$/.test(activo.tagName);
}

/**
 * Achica un formulario lo justo y necesario para que entre sin scroll,
 * MIDIENDO el alto real disponible en vez de estimarlo con vh: eso último
 * nunca coincide con el dispositivo real (barra de gestos, status bar, o
 * simplemente una fuente web que todavía no cargó cuando se calculó a
 * mano), así que por más que se ajuste el número a mano siempre puede
 * faltar o sobrar.
 *
 * Publica un factor (1 = tamaño completo, <1 = achicado) en la variable
 * CSS indicada, para que el propio CSS de la pantalla escale con
 * `calc(valor-base * var(--xx-ajuste, 1))` cada alto/fuente/margen que
 * pueda achicarse.
 *
 * @param {HTMLElement} contenido - El contenedor scrolleable de la pantalla
 *   (ej. .alta-empleado__contenido), hijo directo de <ion-content>.
 * @param {object} opciones
 * @param {string} opciones.variable - Nombre de la variable CSS a publicar.
 * @param {number} [opciones.minimo] - Piso de achique (0-1) para no volver
 *   ilegible el contenido; por debajo de eso se permite scroll.
 * @param {number} [opciones.margen] - Píxeles de colchón que se dejan libres
 *   abajo, para no depender de que el alto medido sea exacto al píxel.
 */
export function ajustarFormulario(contenido, { variable, minimo = 0.72, margen = 6 }) {
  const ionContent = contenido.closest('ion-content');

  function altoDisponible() {
    const header = ionContent?.querySelector('.app-header');
    return (ionContent?.clientHeight ?? 0) - (header?.offsetHeight ?? 0) - margen;
  }

  // Devuelve false si todavía no se puede medir (ion-content sin hidratar).
  function aplicar() {
    const disponible = altoDisponible();
    if (disponible <= 0) return false;

    // Se mide siempre partiendo de la escala completa: si no se resetea acá,
    // un ajuste previo (ej. de antes de rotar la pantalla) falsea la medición.
    let escala = 1;
    contenido.style.setProperty(variable, '1');

    // Se achica de a pasos, midiendo de nuevo en cada uno. Una sola división
    // (disponible / necesario) NO alcanza: buena parte del formulario no
    // escala con la variable — los recuadros cuadrados se miden contra el
    // ancho, los bordes y las notas de error tienen altos fijos —, así que
    // achicar al 80% no baja el total al 80% y el resultado quedaba siempre
    // unos píxeles largo. Iterando se converge al factor que de verdad entra.
    for (let paso = 0; paso < 12; paso += 1) {
      const necesario = contenido.scrollHeight;
      if (necesario <= disponible) break;

      const siguiente = Math.max(minimo, escala * (disponible / necesario));
      if (siguiente >= escala) break; // ya está en el piso: no se achica más

      escala = siguiente;
      contenido.style.setProperty(variable, String(escala));
    }

    return true;
  }

  // ion-content es un custom element: apenas se inserta el HTML todavía puede
  // no tener alto. Se reintenta por frame hasta que sea medible.
  let frames = 0;
  function intentar() {
    if (!contenido.isConnected || frames > 90) return;
    frames += 1;
    if (!aplicar()) requestAnimationFrame(intentar);
  }
  intentar();

  // Un segundo pase diferido: ion-select / ion-button terminan de hidratarse
  // después del primer frame y pueden cambiar el alto de lo ya medido.
  const reintento = setTimeout(aplicar, 300);

  function alCambiarVentana() {
    if (hayCampoEnfoco(contenido)) return;
    aplicar();
  }

  // Ni ResizeObserver ni MutationObserver sobre "contenido": el propio ajuste
  // cambia su tamaño, y observarlo a sí mismo entraría en bucle. Alcanza con
  // reaccionar a los eventos que realmente cambian el alto disponible.
  window.addEventListener('resize', alCambiarVentana);
  window.addEventListener('orientationchange', alCambiarVentana);
  // Al salir de un campo se cierra el teclado y vuelve el alto real: recién
  // ahí tiene sentido recalcular lo que se ignoró durante la escritura.
  contenido.addEventListener('focusout', alCambiarVentana);
  // Las fuentes web (@import de Google Fonts) cargan async: si el cálculo se
  // hizo con la tipografía de respaldo, se repite una vez que carga la real.
  document.fonts?.ready.then(aplicar).catch(() => {});

  return {
    actualizar: aplicar,
    destruir() {
      clearTimeout(reintento);
      window.removeEventListener('resize', alCambiarVentana);
      window.removeEventListener('orientationchange', alCambiarVentana);
      contenido.removeEventListener('focusout', alCambiarVentana);
    },
  };
}
