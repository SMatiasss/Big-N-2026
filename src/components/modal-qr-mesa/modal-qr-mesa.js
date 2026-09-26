import './modal-qr-mesa.css';

/**
 * Modal que muestra el QR de una mesa, listo para escanear en pantalla o
 * para compartir/guardar como imagen (botón "Compartir": en el celular abre
 * el selector nativo de Android; en un navegador de escritorio descarga el
 * PNG). Mismo lenguaje visual que modal-confirmacion (tarjeta centrada sobre
 * un fondo oscuro), pero con su propio contenido.
 *
 * @param {object} opciones
 * @param {number} opciones.numero      - Número de la mesa, para el título.
 * @param {string} opciones.dataUrlQr   - Data URL (image/png) ya generado.
 * @param {() => Promise<void>} opciones.onCompartir - Handler del botón compartir.
 * @returns {{elemento: HTMLElement, presentar: () => void, cerrar: () => void}}
 */
export function crearModalQrMesa({ numero, dataUrlQr, onCompartir }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-qr-mesa';

  const tarjeta = document.createElement('div');
  tarjeta.className = 'modal-qr-mesa__tarjeta';
  tarjeta.setAttribute('role', 'dialog');
  tarjeta.setAttribute('aria-modal', 'true');
  tarjeta.setAttribute('aria-label', `QR de la mesa ${numero}`);

  tarjeta.innerHTML = `
    <button type="button" class="modal-qr-mesa__cerrar" aria-label="Cerrar">✕</button>
    <h2 class="modal-qr-mesa__titulo">QR de la mesa ${numero}</h2>
    <p class="modal-qr-mesa__ayuda">Es el mismo código impreso en la mesa: se puede escanear desde acá o compartirlo.</p>
    <img class="modal-qr-mesa__imagen" src="${dataUrlQr}" alt="Código QR de la mesa ${numero}">
    <button type="button" class="modal-qr-mesa__compartir">Compartir</button>
  `;

  overlay.append(tarjeta);

  const botonCerrar = tarjeta.querySelector('.modal-qr-mesa__cerrar');
  const botonCompartir = tarjeta.querySelector('.modal-qr-mesa__compartir');

  function cerrar() {
    overlay.remove();
  }

  botonCerrar.addEventListener('click', cerrar);
  // El fondo también cierra; la tarjeta corta la propagación para no
  // cerrarse al tocar/seleccionar el QR o el botón.
  overlay.addEventListener('click', cerrar);
  tarjeta.addEventListener('click', (evento) => evento.stopPropagation());

  botonCompartir.addEventListener('click', async () => {
    botonCompartir.disabled = true;
    const textoOriginal = botonCompartir.textContent;
    botonCompartir.textContent = 'Compartiendo…';
    try {
      await onCompartir();
    } finally {
      botonCompartir.disabled = false;
      botonCompartir.textContent = textoOriginal;
    }
  });

  return {
    elemento: overlay,
    presentar() {
      document.body.append(overlay);
      requestAnimationFrame(() => overlay.classList.add('modal-qr-mesa--visible'));
    },
    cerrar,
  };
}
