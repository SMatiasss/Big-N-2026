import './pestanas-filtro.css';

/**
 * Barra de pestañas para filtrar un listado (ej. Platos/Bebidas, Todos/Pendientes).
 *
 * @param {object} opciones
 * @param {string}   opciones.etiqueta        - aria-label del <nav>.
 * @param {{valor: string, texto: string}[]} opciones.opciones - Pestañas a mostrar.
 * @param {string}   opciones.seleccionInicial - Valor de la pestaña activa al crearla.
 * @param {Function} opciones.onCambio         - Recibe el valor de la pestaña elegida.
 * @param {Function} [opciones.permitirCambio] - Se evalúa antes de tocar el DOM; si
 *   devuelve false, el clic no hace nada (ni siquiera cambia la pestaña marcada como activa).
 * @returns {{elemento: HTMLElement, establecerBloqueado: Function}}
 */
export function crearPestanas({ etiqueta, opciones, seleccionInicial, onCambio, permitirCambio }) {
  const nav = document.createElement('nav');
  nav.className = 'pestanas-filtro';
  nav.setAttribute('aria-label', etiqueta);

  const botones = opciones.map(({ valor, texto }) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'pestanas-filtro__boton';
    boton.dataset.valor = valor;
    boton.setAttribute('aria-pressed', String(valor === seleccionInicial));
    boton.textContent = texto;
    boton.addEventListener('click', () => {
      if (boton.getAttribute('aria-pressed') === 'true') return;
      if (permitirCambio && !permitirCambio()) return;
      botones.forEach((item) => item.setAttribute('aria-pressed', String(item === boton)));
      onCambio(valor);
    });
    return boton;
  });

  nav.append(...botones);

  return {
    elemento: nav,
    establecerBloqueado(valor) {
      botones.forEach((boton) => { boton.disabled = valor; });
    },
  };
}
