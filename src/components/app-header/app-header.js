import './app-header.css';

export function crearAppHeader({ titulo, etiquetaVolver = 'Volver', onVolver, accion } = {}) {
  const header = document.createElement('header');
  header.className = 'app-header';

  const volver = document.createElement('button');
  volver.type = 'button';
  volver.className = 'app-header__control app-header__volver';
  volver.setAttribute('aria-label', etiquetaVolver);
  volver.textContent = '‹';
  if (onVolver) volver.addEventListener('click', onVolver);
  else volver.hidden = true;

  const encabezado = document.createElement('h1');
  encabezado.className = 'app-header__titulo';
  encabezado.textContent = titulo ?? '';

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
