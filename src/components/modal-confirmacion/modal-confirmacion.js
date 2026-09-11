import './modal-confirmacion.css';

/**
 * Modal de confirmación con el mismo lenguaje visual que los toast
 * (tarjeta redondeada, borde de color y circulito en la esquina), pero
 * centrado en pantalla y con sus propios botones de acción.
 *
 * @param {object} opciones
 * @param {'exito'|'error'} [opciones.variante] - 'exito': fondo claro/borde
 *   naranja (mismos colores que toast-normal). 'error': fondo bordó/borde
 *   claro (mismos colores que toast-error), para confirmaciones destructivas.
 * @param {string}   opciones.titulo    - Pregunta principal.
 * @param {string}  [opciones.subtitulo] - Dato identificador (ej. nombre).
 * @param {string}   opciones.mensaje   - Texto explicativo.
 * @param {{texto: string, rol: string, destacado?: boolean}[]} opciones.botones
 *   - Botones a mostrar (abajo a la derecha, en el orden dado).
 * @returns {{elemento: HTMLElement, presentar: () => Promise<string>, cerrar: (rol?: string) => void}}
 */
export function crearModalConfirmacion({ variante = 'exito', titulo, subtitulo, mensaje, botones }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-confirmacion';

  const tarjeta = document.createElement('div');
  tarjeta.className = `modal-confirmacion__tarjeta modal-confirmacion__tarjeta--${variante}`;
  tarjeta.setAttribute('role', 'alertdialog');
  tarjeta.setAttribute('aria-modal', 'true');

  const tituloNodo = document.createElement('h2');
  tituloNodo.className = 'modal-confirmacion__titulo';
  tituloNodo.textContent = titulo;
  tarjeta.append(tituloNodo);

  if (subtitulo) {
    const subtituloNodo = document.createElement('p');
    subtituloNodo.className = 'modal-confirmacion__subtitulo';
    subtituloNodo.textContent = subtitulo;
    tarjeta.append(subtituloNodo);
  }

  const mensajeNodo = document.createElement('p');
  mensajeNodo.className = 'modal-confirmacion__mensaje';
  mensajeNodo.textContent = mensaje;
  tarjeta.append(mensajeNodo);

  const botonesNodo = document.createElement('div');
  botonesNodo.className = 'modal-confirmacion__botones';

  let resolverCierre;
  const cierre = new Promise((resolve) => { resolverCierre = resolve; });
  let cerrado = false;

  function cerrarCon(rol) {
    if (cerrado) return;
    cerrado = true;
    overlay.remove();
    resolverCierre(rol);
  }

  botones.forEach(({ texto, rol, destacado }) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = destacado
      ? 'modal-confirmacion__boton modal-confirmacion__boton--destacado'
      : 'modal-confirmacion__boton';
    boton.textContent = texto;
    boton.addEventListener('click', () => cerrarCon(rol));
    botonesNodo.append(boton);
  });

  tarjeta.append(botonesNodo);
  overlay.append(tarjeta);

  return {
    elemento: overlay,
    presentar() {
      document.body.append(overlay);
      requestAnimationFrame(() => overlay.classList.add('modal-confirmacion--visible'));
      return cierre;
    },
    cerrar(rol = 'cancel') {
      cerrarCon(rol);
    },
  };
}
