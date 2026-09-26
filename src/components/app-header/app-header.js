import './app-header.css';
import { ejecutarComoVolver } from '../../router.js';

/**
 * Crea el header estándar de la aplicación.
 *
 * @param {object} opciones
 * @param {string}   opciones.titulo         - Texto del título central.
 * @param {string}  [opciones.etiquetaVolver] - aria-label del botón atrás (default: 'Volver').
 * @param {Function}[opciones.onVolver]       - Handler del botón atrás. Si se omite usa history.back().
 * @param {boolean} [opciones.sinVolver]      - Oculta el botón atrás (pantallas sin "atrás" posible).
 * @param {object}  [opciones.accion]         - Acción opcional a la derecha.
 * @param {string}   opciones.accion.texto    - Texto visible del botón de acción.
 * @param {string}   opciones.accion.etiqueta - aria-label del botón de acción.
 * @param {Function} opciones.accion.onClick  - Handler del botón de acción.
 * @returns {HTMLElement} Elemento <header> listo para insertar en el DOM.
 */
export function crearAppHeader({ titulo, etiquetaVolver = 'Volver', onVolver, accion, sinVolver = false } = {}) {
  const header = document.createElement('header');
  header.className = 'app-header';

  /* — Botón atrás —
     Con sinVolver se deja un espaciador del mismo ancho en vez de sacar el
     elemento: la grilla del header tiene tres columnas fijas (control,
     título, control) y quitar la primera correría el título a la columna
     estrecha, que es justo lo que pasaba antes al ocultarlo sólo por CSS. */
  let volver;

  if (sinVolver) {
    volver = document.createElement('span');
    volver.className = 'app-header__espaciador';
    volver.setAttribute('aria-hidden', 'true');
  } else {
    volver = document.createElement('button');
    volver.type = 'button';
    volver.className = 'app-header__control app-header__volver';
    volver.setAttribute('aria-label', etiquetaVolver);
    volver.textContent = '‹';
    // Volver no apila: la navegación que haga el handler retrocede o
    // reemplaza (ver ejecutarComoVolver en router.js).
    volver.addEventListener('click', () => ejecutarComoVolver(onVolver ?? (() => window.history.back())));
  }

  /* — Título central — */
  const encabezado = document.createElement('h1');
  encabezado.className = 'app-header__titulo';
  encabezado.textContent = titulo ?? '';

  // Entre los dos botones queda poco ancho: los títulos largos bajan de
  // tamaño para seguir entrando (ver app-header.css).
  const largo = (titulo ?? '').length;
  if (largo > 20) {
    header.classList.add('app-header--titulo-muy-largo');
  } else if (largo > 11) {
    header.classList.add('app-header--titulo-largo');
  }

  /* — Acción derecha (opcional) — */
  let controlAccion;
  if (accion) {
    controlAccion = document.createElement('button');
    controlAccion.type = 'button';
    controlAccion.className = 'app-header__control app-header__accion';
    controlAccion.setAttribute('aria-label', accion.etiqueta);
    controlAccion.textContent = accion.texto;
    controlAccion.addEventListener('click', accion.onClick);
  } else {
    controlAccion = document.createElement('span');
    controlAccion.className = 'app-header__espaciador';
    controlAccion.setAttribute('aria-hidden', 'true');
  }

  header.append(volver, encabezado, controlAccion);
  return header;
}
