import './app-header.css';

/**
 * Crea el header estándar de la aplicación.
 *
 * @param {object} opciones
 * @param {string}   opciones.titulo         - Texto del título central.
 * @param {string}  [opciones.etiquetaVolver] - aria-label del botón atrás (default: 'Volver').
 * @param {Function}[opciones.onVolver]       - Handler del botón atrás. Si se omite usa history.back().
 * @param {object}  [opciones.accion]         - Acción opcional a la derecha.
 * @param {string}   opciones.accion.texto    - Texto visible del botón de acción.
 * @param {string}   opciones.accion.etiqueta - aria-label del botón de acción.
 * @param {Function} opciones.accion.onClick  - Handler del botón de acción.
 * @returns {HTMLElement} Elemento <header> listo para insertar en el DOM.
 */
export function crearAppHeader({ titulo, etiquetaVolver = 'Volver', onVolver, accion } = {}) {
  const header = document.createElement('header');
  header.className = 'app-header';

  /* — Botón atrás (siempre presente) — */
  const volver = document.createElement('button');
  volver.type = 'button';
  volver.className = 'app-header__control app-header__volver';
  volver.setAttribute('aria-label', etiquetaVolver);
  volver.textContent = '‹';
  volver.addEventListener('click', onVolver ?? (() => window.history.back()));

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
