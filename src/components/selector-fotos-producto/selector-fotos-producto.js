// Los estilos pertenecen al componente y se cargan cuando éste se importa.
import './selector-fotos-producto.css';
import { obtenerErrorArchivoImagen } from '../../utils/validadores.js';
import {
  obtenerImagenNativa,
  ORIGEN_IMAGEN,
  puedeUsarCameraNativa,
} from '../../services/imagenes-dispositivo.service.js';

const CANTIDAD_FOTOS = 3;

// Esta función representa la fuente de imágenes de la etapa actual.
// Devuelve una Promise con un File o null si el usuario cancela la selección.
// En el futuro puede reemplazarse por otra función que use Camera/Gallery.
export function seleccionarImagenLocal() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    // El input sólo sirve para abrir el selector del navegador y no necesita
    // aparecer en la pantalla. Se elimina al finalizar para no dejar elementos ocultos.
    input.addEventListener('change', () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    }, { once: true });

    // Algunos navegadores no disparan "change" al cancelar. El evento cancel
    // permite cerrar igualmente la operación cuando está disponible.
    input.addEventListener('cancel', () => {
      resolve(null);
      input.remove();
    }, { once: true });

    input.click();
  });
}

// Unifica las fuentes nativas y web bajo el mismo contrato: Promise<File|null>.
// El componente indica el origen; la página nunca necesita conocerlo.
async function obtenerImagenPredeterminada({ origen }) {
  if (!puedeUsarCameraNativa()) return seleccionarImagenLocal();
  return obtenerImagenNativa(origen);
}

// Crea el selector visual de tres fotos.
// Recibe un callback para avisar cambios y una función independiente que obtiene archivos.
// Devuelve el elemento para insertar en el DOM y métodos para controlarlo desde la página.
export function crearSelectorFotosProducto({
  onCambio = () => {},
  obtenerImagen = obtenerImagenPredeterminada,
  descripcionProducto = 'del producto',
} = {}) {
  const elemento = document.createElement('section');
  elemento.className = 'selector-fotos-producto';
  elemento.setAttribute('aria-labelledby', 'titulo-fotos-producto');

  // Cada índice corresponde siempre a una de las tres posiciones visibles.
  // Los archivos pertenecen al estado del componente y las URLs sólo sirven para previews.
  const archivos = Array(CANTIDAD_FOTOS).fill(null);
  const urlsPreview = Array(CANTIDAD_FOTOS).fill(null);
  let bloqueado = false;
  let obteniendoImagen = false;

  elemento.innerHTML = `
    <div class="selector-fotos-producto__encabezado">
      <h2 id="titulo-fotos-producto">Fotos ${descripcionProducto}</h2>
      <p>Seleccioná exactamente tres imágenes.</p>
    </div>
    <div class="selector-fotos-producto__grilla"></div>
    <ion-note class="selector-fotos-producto__error" color="danger" aria-live="polite"></ion-note>
  `;

  const grilla = elemento.querySelector('.selector-fotos-producto__grilla');
  const mensajeError = elemento.querySelector('.selector-fotos-producto__error');

  // Actualiza solamente la presentación de una posición. La obtención del archivo
  // ocurre fuera de esta función para mantener separadas ambas responsabilidades.
  function renderizarPosicion(indice) {
    const posicion = grilla.querySelector(`[data-posicion="${indice}"]`);
    const contenido = posicion.querySelector('.selector-fotos-producto__contenido');
    const botones = posicion.querySelectorAll('ion-button');
    const numeroVisible = indice + 1;

    if (urlsPreview[indice]) {
      contenido.innerHTML = `<img src="${urlsPreview[indice]}" alt="Vista previa de la foto ${numeroVisible} ${descripcionProducto}">`;
    } else {
      contenido.innerHTML = `
        <span class="selector-fotos-producto__icono" aria-hidden="true">＋</span>
        <span>Foto ${numeroVisible}</span>
      `;
    }

    botones.forEach((boton) => {
      boton.disabled = bloqueado || obteniendoImagen;
    });
  }

  // Reemplaza el archivo de una posición y administra su URL temporal.
  // URL.revokeObjectURL libera la memoria ocupada por el preview anterior.
  function establecerImagen(indice, archivo) {
    if (urlsPreview[indice]) URL.revokeObjectURL(urlsPreview[indice]);

    archivos[indice] = archivo;
    urlsPreview[indice] = URL.createObjectURL(archivo);
    renderizarPosicion(indice);
    mostrarError('');

    // El callback comunica el cambio sin obligar a la página a conocer
    // cómo fue obtenido ni cómo se visualiza el archivo.
    onCambio(indice, archivo, [...archivos]);
  }

  // Solicita una imagen a la fuente configurada. Hoy es un input local;
  // más adelante podrá ser Camera/Gallery manteniendo este mismo contrato.
  async function solicitarImagen(indice, origen) {
    if (bloqueado || obteniendoImagen) return;

    try {
      obteniendoImagen = true;
      renderizarTodasLasPosiciones();

      const archivo = await obtenerImagen({
        indice,
        origen,
        archivoActual: archivos[indice],
      });
      if (archivo === null || archivo === undefined) return;

      const errorArchivo = obtenerErrorArchivoImagen(archivo);
      if (errorArchivo) {
        mostrarError(errorArchivo);
        return;
      }

      establecerImagen(indice, archivo);
    } catch (error) {
      console.error('No se pudo obtener la imagen seleccionada.', error);
      mostrarError('No se pudo seleccionar la imagen. Intentá nuevamente.');
    } finally {
      obteniendoImagen = false;
      renderizarTodasLasPosiciones();
    }
  }

  // Redibuja las tres posiciones cuando cambia un estado compartido,
  // por ejemplo mientras se espera una respuesta de Camera.
  function renderizarTodasLasPosiciones() {
    for (let indice = 0; indice < CANTIDAD_FOTOS; indice += 1) {
      renderizarPosicion(indice);
    }
  }

  // Creamos siempre tres tarjetas. addEventListener registra el callback que
  // se ejecutará cuando el usuario pulse la tarjeta o su botón.
  for (let indice = 0; indice < CANTIDAD_FOTOS; indice += 1) {
    const posicion = document.createElement('article');
    posicion.className = 'selector-fotos-producto__posicion';
    posicion.dataset.posicion = indice;
    const acciones = puedeUsarCameraNativa()
      ? `
        <ion-button type="button" fill="outline" size="small" data-origen="${ORIGEN_IMAGEN.CAMARA}">Cámara</ion-button>
        <ion-button type="button" fill="outline" size="small" data-origen="${ORIGEN_IMAGEN.GALERIA}">Galería</ion-button>
      `
      : '<ion-button type="button" fill="outline" size="small" data-origen="local">Seleccionar archivo</ion-button>';

    posicion.innerHTML = `
      <button class="selector-fotos-producto__contenido" type="button" aria-label="Seleccionar foto ${indice + 1}"></button>
      <div class="selector-fotos-producto__acciones">${acciones}</div>
    `;

    posicion.querySelector('.selector-fotos-producto__contenido')
      .addEventListener('click', () => solicitarImagen(
        indice,
        puedeUsarCameraNativa() ? ORIGEN_IMAGEN.GALERIA : 'local',
      ));

    // Cada botón comunica el origen mediante data-origen. El callback conserva
    // el índice para reemplazar únicamente la foto elegida.
    posicion.querySelectorAll('ion-button').forEach((boton) => {
      boton.addEventListener('click', () => solicitarImagen(indice, boton.dataset.origen));
    });

    grilla.append(posicion);
    renderizarPosicion(indice);
  }

  // Muestra el error general de las fotos y marca visualmente el grupo.
  function mostrarError(mensaje = '') {
    mensajeError.textContent = mensaje;
    elemento.classList.toggle('selector-fotos-producto--invalido', Boolean(mensaje));
  }

  // Bloquea las acciones del selector durante el envío del formulario.
  function establecerBloqueado(valor) {
    bloqueado = Boolean(valor);
    renderizarTodasLasPosiciones();
  }

  // Libera todas las URLs temporales cuando la página deja de usar el componente.
  function destruir() {
    urlsPreview.forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
  }

  return { elemento, mostrarError, establecerBloqueado, destruir };
}
