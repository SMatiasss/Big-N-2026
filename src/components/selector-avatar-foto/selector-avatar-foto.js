import './selector-avatar-foto.css';
import { obtenerErrorArchivoImagen } from '../../utils/validadores.js';
import { obtenerImagenNativa, ORIGEN_IMAGEN, puedeUsarCameraNativa } from '../../services/imagenes-dispositivo.service.js';

// Captura un único avatar exclusivamente desde la cámara del dispositivo.
export function crearSelectorAvatarFoto({ onCambio = () => {} } = {}) {
  const elemento = document.createElement('section');
  elemento.className = 'selector-avatar-foto';
  elemento.innerHTML = `
    <h2>Foto personal</h2>
    <p>Tomá una foto desde la cámara del dispositivo.</p>
    <div class="selector-avatar-foto__preview" aria-live="polite">Sin foto</div>
    <ion-button type="button" expand="block">Tomar foto</ion-button>
    <ion-note color="danger" aria-live="polite"></ion-note>
  `;

  const preview = elemento.querySelector('.selector-avatar-foto__preview');
  const boton = elemento.querySelector('ion-button');
  const error = elemento.querySelector('ion-note');
  let bloqueado = false;
  let urlPreview;

  function mostrarError(mensaje = '') {
    error.textContent = mensaje;
    elemento.classList.toggle('selector-avatar-foto--invalido', Boolean(mensaje));
  }

  async function tomarFoto() {
    if (bloqueado) return;
    if (!puedeUsarCameraNativa()) {
      mostrarError('La foto personal debe tomarse desde la aplicación instalada en un dispositivo.');
      return;
    }

    boton.disabled = true;
    try {
      const archivo = await obtenerImagenNativa(ORIGEN_IMAGEN.CAMARA);
      if (!archivo) return;
      const errorArchivo = obtenerErrorArchivoImagen(archivo);
      if (errorArchivo) {
        mostrarError(errorArchivo);
        return;
      }
      if (urlPreview) URL.revokeObjectURL(urlPreview);
      urlPreview = URL.createObjectURL(archivo);
      preview.innerHTML = `<img src="${urlPreview}" alt="Vista previa de la foto personal">`;
      mostrarError('');
      onCambio(archivo);
    } catch (errorCamera) {
      console.error('No se pudo tomar la foto personal.', errorCamera);
      mostrarError('No se pudo tomar la foto. Revisá el permiso de cámara e intentá nuevamente.');
    } finally {
      boton.disabled = bloqueado;
    }
  }

  boton.addEventListener('click', tomarFoto);
  return {
    elemento,
    mostrarError,
    establecerBloqueado(valor) {
      bloqueado = Boolean(valor);
      boton.disabled = bloqueado;
    },
    destruir() {
      if (urlPreview) URL.revokeObjectURL(urlPreview);
    },
  };
}
