// Selector visual de foto de la mesa adaptado al diseño de Alta Mesa:
// contenedor rectangular con borde punteado, ícono de cámara y texto "Tomar o subir foto".
import './selector-foto-mesa.css';
import { obtenerErrorArchivoImagen } from '../../utils/validadores.js';
import {
  obtenerImagenNativa,
  ORIGEN_IMAGEN,
  puedeUsarCameraNativa,
} from '../../services/imagenes-dispositivo.service.js';

// Abre el selector de archivos del navegador cuando no hay Camera nativa disponible.
function seleccionarImagenLocal() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.addEventListener('change', () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    }, { once: true });

    input.addEventListener('cancel', () => {
      resolve(null);
      input.remove();
    }, { once: true });

    input.click();
  });
}

// Unifica las fuentes nativas y web bajo el mismo contrato: Promise<File|null>.
async function obtenerImagenPredeterminada({ origen }) {
  if (!puedeUsarCameraNativa()) return seleccionarImagenLocal();
  return obtenerImagenNativa(origen);
}

export function crearSelectorFotoMesa({
  onCambio = () => {},
  obtenerImagen = obtenerImagenPredeterminada,
} = {}) {
  const elemento = document.createElement('section');
  elemento.className = 'selector-foto-mesa';

  let archivo = null;
  let urlPreview = null;
  let bloqueado = false;
  let obteniendoImagen = false;

  elemento.innerHTML = `
    <article class="selector-foto-mesa__posicion">
      <button class="selector-foto-mesa__contenido" type="button" aria-label="Tomar o subir foto de la mesa"></button>
      <div class="selector-foto-mesa__acciones" hidden></div>
    </article>
    <ion-note class="selector-foto-mesa__error" color="danger" aria-live="polite"></ion-note>
  `;

  const contenido = elemento.querySelector('.selector-foto-mesa__contenido');
  const acciones = elemento.querySelector('.selector-foto-mesa__acciones');
  const mensajeError = elemento.querySelector('.selector-foto-mesa__error');

  if (puedeUsarCameraNativa()) {
    acciones.hidden = false;
    acciones.innerHTML = `
      <button type="button" class="selector-foto-mesa__boton-fuente" data-origen="${ORIGEN_IMAGEN.CAMARA}">Cámara</button>
      <button type="button" class="selector-foto-mesa__boton-fuente" data-origen="${ORIGEN_IMAGEN.GALERIA}">Galería</button>
    `;
  }

  function renderizar() {
    if (urlPreview) {
      contenido.innerHTML = `
        <div class="selector-foto-mesa__preview-wrap">
          <img src="${urlPreview}" alt="Vista previa de la mesa">
          <span class="selector-foto-mesa__cambiar-badge">Cambiar foto</span>
        </div>
      `;
    } else {
      contenido.innerHTML = `
        <div class="selector-foto-mesa__placeholder">
          <svg class="selector-foto-mesa__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
          </svg>
          <span class="selector-foto-mesa__texto">Tomar o subir foto</span>
        </div>
      `;
    }

    acciones.querySelectorAll('button').forEach((boton) => {
      boton.disabled = bloqueado || obteniendoImagen;
    });
  }

  function establecerImagen(nuevoArchivo) {
    if (urlPreview) URL.revokeObjectURL(urlPreview);

    archivo = nuevoArchivo;
    urlPreview = URL.createObjectURL(nuevoArchivo);
    renderizar();
    mostrarError('');

    onCambio(archivo);
  }

  async function solicitarImagen(origen) {
    if (bloqueado || obteniendoImagen) return;

    try {
      obteniendoImagen = true;
      renderizar();

      const archivoObtenido = await obtenerImagen({ origen, archivoActual: archivo });
      if (archivoObtenido === null || archivoObtenido === undefined) return;

      const errorArchivo = obtenerErrorArchivoImagen(archivoObtenido);
      if (errorArchivo) {
        mostrarError(errorArchivo);
        return;
      }

      establecerImagen(archivoObtenido);
    } catch (error) {
      console.error('No se pudo obtener la foto de la mesa.', error);
      mostrarError('No se pudo tomar la foto. Intentá nuevamente.');
    } finally {
      obteniendoImagen = false;
      renderizar();
    }
  }

  contenido.addEventListener('click', () => {
    solicitarImagen(puedeUsarCameraNativa() ? ORIGEN_IMAGEN.CAMARA : 'local');
  });

  acciones.querySelectorAll('button').forEach((boton) => {
    boton.addEventListener('click', (e) => {
      e.stopPropagation();
      solicitarImagen(boton.dataset.origen);
    });
  });

  function mostrarError(mensaje = '') {
    mensajeError.textContent = mensaje;
    elemento.classList.toggle('selector-foto-mesa--invalido', Boolean(mensaje));
  }

  function establecerBloqueado(valor) {
    bloqueado = Boolean(valor);
    renderizar();
  }

  function destruir() {
    if (urlPreview) URL.revokeObjectURL(urlPreview);
  }

  renderizar();

  return { elemento, mostrarError, establecerBloqueado, destruir };
}
