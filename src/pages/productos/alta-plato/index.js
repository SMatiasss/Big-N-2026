// Alta de plato (HU02). Los estilos son compartidos con el alta de bebida:
// los dos formularios tienen los mismos campos, así que viven en alta-producto.css.
import '../alta-producto.css';
import { crearSelectorFotosProducto } from '../../../components/selector-fotos-producto/selector-fotos-producto.js';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { mostrarToastNormal } from '../../../components/toast-normal/toast-normal.js';
import { SECTORES, TIPOS_PRODUCTO } from '../../../config/constantes.js';
import { crearPlatoCompleto } from '../../../services/productos.service.js';
import { navegarA } from '../../../router.js';
import {
  esCampoVacio,
  esEnteroPositivo,
  esNumeroPositivo,
  esTextoObligatorioValido,
  hayCantidadExactaDeImagenes,
} from '../../../utils/validadores.js';

const CANTIDAD_FOTOS = 3;
const CAMPOS = ['nombre', 'descripcion', 'precio', 'tiempo'];

// Valida los datos ingresados antes de aceptar el formulario.
// Recibe un objeto con los campos y el array de tres imágenes.
// Devuelve un objeto cuyas propiedades contienen los errores encontrados.
function validarFormulario(datos, imagenes) {
  const errores = {};

  if (!esTextoObligatorioValido(datos.nombre)) {
    errores.nombre = 'Ingresá el nombre del plato.';
  }

  if (!esTextoObligatorioValido(datos.descripcion)) {
    errores.descripcion = 'Ingresá una descripción del plato.';
  }

  if (esCampoVacio(datos.tiempo)) {
    errores.tiempo = 'Ingresá el tiempo de elaboración.';
  } else if (!esEnteroPositivo(datos.tiempo)) {
    errores.tiempo = 'El tiempo debe ser un número entero mayor que 0.';
  }

  if (esCampoVacio(datos.precio)) {
    errores.precio = 'Ingresá el precio del plato.';
  } else if (!esNumeroPositivo(datos.precio)) {
    errores.precio = 'El precio debe ser un número mayor que 0.';
  }

  if (!hayCantidadExactaDeImagenes(imagenes, CANTIDAD_FOTOS)) {
    errores.imagenes = 'Seleccioná las tres imágenes del plato.';
  }

  return errores;
}

function obtenerDatosFormulario(formulario) {
  return {
    nombre: formulario.querySelector('#nombre-plato').value?.trim() ?? '',
    descripcion: formulario.querySelector('#descripcion-plato').value?.trim() ?? '',
    tiempo: formulario.querySelector('#tiempo-plato').value ?? '',
    precio: formulario.querySelector('#precio-plato').value ?? '',
  };
}

// Actualiza el mensaje y el aspecto visual de un campo.
function mostrarErrorCampo(formulario, campo, mensaje = '') {
  const item = formulario.querySelector(`[data-campo="${campo}"]`);
  const nota = formulario.querySelector(`[data-error="${campo}"]`);
  const control = item.querySelector('input, textarea');
  const hayError = Boolean(mensaje);

  nota.textContent = mensaje;
  item.classList.toggle('campo-formulario--invalido', hayError);
  item.classList.toggle('campo-formulario--valido', !hayError && !esCampoVacio(control.value));
  control.setAttribute('aria-invalid', String(hayError));
}

// Presenta todos los errores junto a sus controles y devuelve true
// cuando el formulario completo es válido.
function mostrarResultadoValidacion(formulario, selectorFotos, errores) {
  CAMPOS.forEach((campo) => {
    mostrarErrorCampo(formulario, campo, errores[campo] ?? '');
  });

  selectorFotos.mostrarError(errores.imagenes ?? '');
  return Object.keys(errores).length === 0;
}

export function render(container) {
  container.innerHTML = `
    <ion-page class="alta-producto alta-plato">
      <ion-content>
        <main class="alta-producto__contenido">
          <header class="alta-producto__introduccion">
            <button class="alta-producto__volver" type="button" aria-label="Volver">‹</button>
            <h1>Agregar un plato</h1>
          </header>

          <form class="alta-producto__formulario" novalidate>
            <div class="alta-producto__fotos"></div>

            <div class="campo-formulario" data-campo="nombre">
              <label for="nombre-plato">Nombre del plato</label>
              <input
                class="campo-control"
                id="nombre-plato"
                name="nombre"
                type="text"
                maxlength="80"
                placeholder="Ej. Tacos al Pastor"
                required
              >
              <ion-note color="danger" data-error="nombre" aria-live="polite"></ion-note>
            </div>

            <div class="campo-formulario" data-campo="descripcion">
              <label for="descripcion-plato">Descripción corta</label>
              <textarea
                class="campo-control"
                id="descripcion-plato"
                name="descripcion"
                maxlength="300"
                placeholder="Ej. Tacos de cerdo marinado con piña"
                required
              ></textarea>
              <ion-note color="danger" data-error="descripcion" aria-live="polite"></ion-note>
            </div>

            <div class="campo-formulario" data-campo="precio">
              <label for="precio-plato">Precio</label>
              <input
                class="campo-control"
                id="precio-plato"
                name="precio"
                type="number"
                inputmode="decimal"
                min="0.01"
                step="0.01"
                placeholder="$ 1.200"
                required
              >
              <ion-note color="danger" data-error="precio" aria-live="polite"></ion-note>
            </div>

            <div class="campo-formulario" data-campo="tiempo">
              <label for="tiempo-plato">Tiempo prep. (min)</label>
              <input
                class="campo-control"
                id="tiempo-plato"
                name="tiempo"
                type="number"
                inputmode="numeric"
                min="1"
                step="1"
                placeholder="15 min"
                required
              >
              <ion-note color="danger" data-error="tiempo" aria-live="polite"></ion-note>
            </div>

            <ion-button class="alta-producto__submit" type="submit" expand="block">
              <ion-spinner name="crescent" aria-hidden="true"></ion-spinner>
              <span>Guardar Plato</span>
            </ion-button>
          </form>
        </main>
      </ion-content>
    </ion-page>
  `;

  const formulario = container.querySelector('.alta-producto__formulario');
  const botonSubmit = formulario.querySelector('.alta-producto__submit');
  const textoSubmit = botonSubmit.querySelector('span');

  // Este array es el estado de las imágenes de la página. Sus tres posiciones
  // se mantienen fijas aunque una foto sea reemplazada.
  const imagenes = Array(CANTIDAD_FOTOS).fill(null);
  let enviando = false;
  let validacionMostrada = false;

  container.querySelector('.alta-producto__volver').addEventListener('click', () => {
    window.history.back();
  });

  // La página recibe archivos mediante onCambio, sin conocer si provienen de
  // un input local o de Camera/Gallery.
  const selectorFotos = crearSelectorFotosProducto({
    descripcionProducto: 'del plato',
    onCambio(indice, archivo) {
      imagenes[indice] = archivo;

      if (validacionMostrada) {
        const errores = validarFormulario(obtenerDatosFormulario(formulario), imagenes);
        selectorFotos.mostrarError(errores.imagenes ?? '');
      }
    },
  });

  formulario.querySelector('.alta-producto__fotos').append(selectorFotos.elemento);

  // Habilita o bloquea toda acción de envío y selección de fotos.
  function establecerProcesando(valor) {
    enviando = valor;
    botonSubmit.disabled = valor;
    botonSubmit.classList.toggle('alta-producto__submit--procesando', valor);
    textoSubmit.textContent = valor ? 'Guardando...' : 'Guardar Plato';
    selectorFotos.establecerBloqueado(valor);
  }

  // Después del primer submit, cada cambio vuelve a validar su campo para
  // que el error desaparezca apenas el usuario lo corrija.
  formulario.querySelectorAll('input, textarea').forEach((control) => {
    control.addEventListener('input', () => {
      if (!validacionMostrada) return;

      const errores = validarFormulario(obtenerDatosFormulario(formulario), imagenes);
      const campo = control.closest('[data-campo]').dataset.campo;
      mostrarErrorCampo(formulario, campo, errores[campo] ?? '');
    });
  });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (enviando) return;

    validacionMostrada = true;
    const datos = obtenerDatosFormulario(formulario);
    const errores = validarFormulario(datos, imagenes);

    if (!mostrarResultadoValidacion(formulario, selectorFotos, errores)) {
      mostrarToastError('Revisá los campos señalados antes de continuar.');
      return;
    }

    establecerProcesando(true);

    try {
      // La página sólo arma los datos válidos. El service encapsula el INSERT,
      // Storage, producto_fotos, limpieza y consulta final de verificación.
      await crearPlatoCompleto({
        nombre: datos.nombre,
        descripcion: datos.descripcion,
        tiempo_elaboracion_min: Number(datos.tiempo),
        precio: Number(datos.precio),
        tipo: TIPOS_PRODUCTO.PLATO,
        // Todo plato se elabora en cocina; el rol que autoriza el alta es "cocinero".
        sector: SECTORES.COCINA,
      }, imagenes);

      mostrarToastNormal('Plato guardado correctamente.');
      setTimeout(() => navegarA('/productos'), 2000);
    } catch (error) {
      console.error('No se pudo completar el alta del plato.', error);
      mostrarToastError(`No se pudo guardar el plato: ${error.message ?? 'error desconocido'}`);
      establecerProcesando(false);
    }
  });

  // El router actual no ofrece un ciclo de destrucción. Escuchamos un solo cambio
  // de ruta para liberar los previews cuando el usuario abandona esta pantalla.
  window.addEventListener('hashchange', () => selectorFotos.destruir(), { once: true });
}
