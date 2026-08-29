// Variante de una sola foto del selector-fotos-producto: misma fuente de imágenes
// (cámara nativa vía Capacitor o input local en navegador) y mismo contrato de callbacks,
// pero pensada para una única posición en lugar de una grilla de tres.
import './selector-foto-mesa.css';
import { obtenerErrorArchivoImagen } from '../../utils/validadores.js';
import {
  obtenerImagenNativa,
  ORIGEN_IMAGEN,
  puedeUsarCameraNativa,
} from '../../services/imagenes-dispositivo.service.js';

// Abre el selector de archivos del navegador cuando no hay Camera nativa disponible.
// Devuelve una Promise con un File o null si el usuario cancela la selección.
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

// Crea el selector visual de la foto de la mesa.
// Recibe un callback para avisar cambios y una función independiente que obtiene archivos.
// Devuelve el elemento para insertar en el DOM y métodos para controlarlo desde la página.
export function crearSelectorFotoMesa({
  onCambio = () => {},
  obtenerImagen = obtenerImagenPredeterminada,
} = {}) {
  const elemento = document.createElement('section');
  elemento.className = 'selector-foto-mesa';
  elemento.setAttribute('aria-labelledby', 'titulo-foto-mesa');

  // El archivo y su URL de preview son el estado del componente.
  let archivo = null;
  let urlPreview = null;
  let bloqueado = false;
  let obteniendoImagen = false;

  elemento.innerHTML = `
    <div class="selector-foto-mesa__encabezado">
      <h2 id="titulo-foto-mesa">Foto de la mesa</h2>
      <p>Sacá una foto que muestre la mesa completa.</p>
    </div>
    <article class="selector-foto-mesa__posicion">
      <button class="selector-foto-mesa__contenido" type="button" aria-label="Seleccionar foto de la mesa"></button>
      <div class="selector-foto-mesa__acciones"></div>
    </article>
    <ion-note class="selector-foto-mesa__error" color="danger" aria-live="polite"></ion-note>
  `;

  const contenido = elemento.querySelector('.selector-foto-mesa__contenido');
  const acciones = elemento.querySelector('.selector-foto-mesa__acciones');
  const mensajeError = elemento.querySelector('.selector-foto-mesa__error');

  acciones.innerHTML = puedeUsarCameraNativa()
    ? `
      <ion-button type="button" fill="outline" size="small" data-origen="${ORIGEN_IMAGEN.CAMARA}">Cámara</ion-button>
      <ion-button type="button" fill="outline" size="small" data-origen="${ORIGEN_IMAGEN.GALERIA}">Galería</ion-button>
    `
    : '<ion-button type="button" fill="outline" size="small" data-origen="local">Seleccionar archivo</ion-button>';

  // Actualiza solamente la presentación. La obtención del archivo ocurre
  // fuera de esta función para mantener separadas ambas responsabilidades.
  function renderizar() {
    if (urlPreview) {
      contenido.innerHTML = `<img src="${urlPreview}" alt="Vista previa de la foto de la mesa">`;
    } else {
      contenido.innerHTML = `
        <span class="selector-foto-mesa__icono" aria-hidden="true">＋</span>
        <span>Foto de la mesa</span>
      `;
    }

    acciones.querySelectorAll('ion-button').forEach((boton) => {
      boton.disabled = bloqueado || obteniendoImagen;
    });
  }

  // Reemplaza el archivo actual y administra su URL temporal.
  // URL.revokeObjectURL libera la memoria ocupada por el preview anterior.
  function establecerImagen(nuevoArchivo) {
    if (urlPreview) URL.revokeObjectURL(urlPreview);

    archivo = nuevoArchivo;
    urlPreview = URL.createObjectURL(nuevoArchivo);
    renderizar();
    mostrarError('');

    onCambio(archivo);
  }

  // Solicita una imagen a la fuente configurada (cámara, galería o input local).
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

  contenido.addEventListener('click', () => solicitarImagen(
    puedeUsarCameraNativa() ? ORIGEN_IMAGEN.GALERIA : 'local',
  ));

  // Cada botón comunica el origen mediante data-origen.
  acciones.querySelectorAll('ion-button').forEach((boton) => {
    boton.addEventListener('click', () => solicitarImagen(boton.dataset.origen));
  });

  // Muestra el error de la foto y marca visualmente el grupo.
  function mostrarError(mensaje = '') {
    mensajeError.textContent = mensaje;
    elemento.classList.toggle('selector-foto-mesa--invalido', Boolean(mensaje));
  }

  // Bloquea las acciones del selector durante el envío del formulario.
  function establecerBloqueado(valor) {
    bloqueado = Boolean(valor);
    renderizar();
  }

  // Libera la URL temporal cuando la página deja de usar el componente.
  function destruir() {
    if (urlPreview) URL.revokeObjectURL(urlPreview);
  }

  renderizar();

  return { elemento, mostrarError, establecerBloqueado, destruir };
}
