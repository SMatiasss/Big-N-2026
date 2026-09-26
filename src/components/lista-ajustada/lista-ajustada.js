import './lista-ajustada.css';

// Lee un número de una custom property (ej. --la-items: 5).
//
// OJO: sólo sirve para números sueltos. getPropertyValue devuelve una custom
// property como TEXTO sin resolver: con "--la-gap: clamp(10px, 1.8dvh, 16px)"
// devuelve el clamp() tal cual, parseFloat da NaN y se caía al default 0.
// Para los gaps se lee el valor ya resuelto por el navegador (ver abajo).
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
 * @param {object} [opciones]
 * @param {number} [opciones.paddingInferior] - Píxeles extra a reservar al final (ej. para sombras).
 *
 * OJO: la lista no debe tener padding vertical propio. scroll-snap alinea
 * contra el "snapport", que es el PADDING box: con padding, N elementos
 * dejan de llenar esa ventana y asoma el siguiente. Para dejar un hueco
 * (ej. un carrito flotante) va un margin en la lista, no un padding.
 */
export function ajustarLista(lista, { paddingInferior = 0 } = {}) {
  function aplicar() {
    const estilos = getComputedStyle(lista);
    const items = leerNumero(estilos, '--la-items', 0);
    // El gap real es el margin-bottom ya resuelto del primer elemento
    // (.lista-ajustada > * { margin: 0 0 var(--la-gap) }). Así --la-gap puede
    // ser un clamp()/calc() y la cuenta sigue exacta. El primero nunca es el
    // último (sin margin) porque acá siempre hay más de --la-items hijos.
    const primero = lista.firstElementChild;
    const gap = primero ? parseFloat(getComputedStyle(primero).marginBottom) || 0 : 0;
    const alto = lista.clientHeight - paddingInferior;

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
    // Resuelto por el navegador (gap: var(--la-gap)), por el mismo motivo
    // que en ajustarLista: --la-gap puede no ser un número suelto.
    const gap = parseFloat(estilos.rowGap) || 0;
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

// Mide el alto libre bajo el header ignorando el teclado virtual.
//
// En Android el WebView se achica cuando se abre el teclado, así que el alto
// de ion-content baja a la mitad. Antes se intentaba adivinar si un "resize"
// era el teclado mirando si había un campo con foco, pero al pasar de un campo
// a otro (tocando otro input o con "siguiente") hay un instante sin foco: ahí
// se medía con el teclado abierto y el formulario quedaba chiquito hasta el
// próximo toque.
//
// El teclado sólo le quita ALTO a la pantalla, nunca ancho. Entonces, para un
// mismo ancho, el mayor alto visto es el real: el teclado nunca puede achicar
// la medición. Si cambia el ancho (rotar el teléfono) se vuelve a medir de cero.
function crearMedidorAlto(contenido, margen) {
  const ionContent = contenido.closest('ion-content');
  let anchoReferencia = 0;
  let altoReferencia = 0;

  return function altoDisponible() {
    const ancho = ionContent?.clientWidth ?? 0;
    const alto = ionContent?.clientHeight ?? 0;
    if (ancho !== anchoReferencia) {
      anchoReferencia = ancho;
      altoReferencia = 0;
    }
    altoReferencia = Math.max(altoReferencia, alto);

    const header = ionContent?.querySelector('.app-header');
    const altoHeader = header?.getBoundingClientRect().height ?? 0;
    return Math.floor(altoReferencia - altoHeader - margen);
  };
}

/**
 * Publica en --vista-alto-disponible el alto libre bajo el header, sin
 * achicar nada: para pantallas que reparten ese alto con flexbox (ej. el
 * alta de plato/bebida, donde "Descripción" ocupa lo que sobra).
 *
 * El alto no baja al abrir el teclado (ver crearMedidorAlto): el contenido
 * conserva su tamaño y es ion-content el que scrollea hasta el campo, en vez
 * de aplastar el formulario y encimar los campos.
 *
 * @param {HTMLElement} contenido - Hijo directo de <ion-content>.
 */
export function fijarAltoDisponible(contenido, { margen = 0 } = {}) {
  const altoDisponible = crearMedidorAlto(contenido, margen);

  function aplicar() {
    const disponible = altoDisponible();
    if (disponible <= 0) return false;
    contenido.style.setProperty('--vista-alto-disponible', `${disponible}px`);
    return true;
  }

  let frames = 0;
  function intentar() {
    if (!contenido.isConnected || frames > 90) return;
    frames += 1;
    if (!aplicar()) requestAnimationFrame(intentar);
  }
  intentar();

  // El header termina de hidratarse (ion-button) después del primer frame.
  const reintento = setTimeout(aplicar, 300);
  window.addEventListener('resize', aplicar);
  window.addEventListener('orientationchange', aplicar);
  document.fonts?.ready.then(aplicar).catch(() => {});

  return {
    actualizar: aplicar,
    destruir() {
      clearTimeout(reintento);
      window.removeEventListener('resize', aplicar);
      window.removeEventListener('orientationchange', aplicar);
    },
  };
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
  const altoDisponible = crearMedidorAlto(contenido, margen);
  let ultimoDisponible = null;

  // Devuelve false si todavía no se puede medir (ion-content sin hidratar).
  function aplicar() {
    const disponible = altoDisponible();
    if (disponible <= 0) return false;
    ultimoDisponible = disponible;
    contenido.style.setProperty('--vista-alto-disponible', `${disponible}px`);

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

  // Abrir/cerrar el teclado dispara "resize" pero no cambia el alto medido
  // (ver crearMedidorAlto), así que no hay nada que recalcular: el formulario
  // queda del tamaño con el que se entró. Sólo rotar el teléfono lo cambia.
  function alCambiarVentana() {
    if (altoDisponible() !== ultimoDisponible) aplicar();
  }

  // Ni ResizeObserver ni MutationObserver sobre "contenido": el propio ajuste
  // cambia su tamaño, y observarlo a sí mismo entraría en bucle. Alcanza con
  // reaccionar a los eventos que realmente cambian el alto disponible.
  window.addEventListener('resize', alCambiarVentana);
  window.addEventListener('orientationchange', alCambiarVentana);
  // Las fuentes web (@import de Google Fonts) cargan async: si el cálculo se
  // hizo con la tipografía de respaldo, se repite una vez que carga la real.
  document.fonts?.ready.then(aplicar).catch(() => {});

  return {
    actualizar: aplicar,
    destruir() {
      clearTimeout(reintento);
      window.removeEventListener('resize', alCambiarVentana);
      window.removeEventListener('orientationchange', alCambiarVentana);
    },
  };
}

/**
 * Escala una vista compacta para aprovechar el alto disponible sin provocar
 * scroll. A diferencia de ajustarFormulario, también puede crecer cuando el
 * dispositivo ofrece más espacio. El CSS de la vista decide qué dimensiones
 * responden a la variable para preservar ancho, contraste y áreas táctiles.
 */
export function ajustarVista(contenido, {
  variable,
  minimo = 0.86,
  maximo = 1.18,
  margen = 8,
} = {}) {
  const ionContent = contenido.closest('ion-content');
  const limitar = (valor) => Math.min(maximo, Math.max(minimo, valor));

  // A propósito NO usa crearMedidorAlto: estas vistas no scrollean
  // (scroll-y="false"), así que achicarse con el teclado es lo que mantiene
  // visible un campo como el comentario de la encuesta.
  function aplicar() {
    const header = ionContent?.querySelector('.app-header');
    const disponible = (ionContent?.clientHeight ?? 0) - (header?.offsetHeight ?? 0) - margen;
    if (disponible <= 0) return false;

    // Además del factor, se publica el alto real para que las vistas con
    // flex/grid puedan repartir el espacio sobrante entre sus bloques.
    contenido.style.setProperty('--vista-alto-disponible', `${disponible}px`);

    contenido.style.setProperty(variable, '1');
    const natural = contenido.scrollHeight;
    if (!natural) return false;

    let escala = limitar(disponible / natural);
    contenido.style.setProperty(variable, String(escala));

    // Un segundo pase compensa dimensiones que intencionalmente no escalan.
    const medido = contenido.scrollHeight;
    if (medido > 0) {
      escala = limitar(escala * (disponible / medido));
      contenido.style.setProperty(variable, String(escala));
    }
    return true;
  }

  let frames = 0;
  function intentar() {
    if (!contenido.isConnected || frames > 90) return;
    frames += 1;
    if (!aplicar()) requestAnimationFrame(intentar);
  }
  intentar();

  const reintento = setTimeout(aplicar, 300);
  window.addEventListener('resize', aplicar);
  window.addEventListener('orientationchange', aplicar);
  document.fonts?.ready.then(aplicar).catch(() => {});

  return {
    actualizar: aplicar,
    destruir() {
      clearTimeout(reintento);
      window.removeEventListener('resize', aplicar);
      window.removeEventListener('orientationchange', aplicar);
    },
  };
}
