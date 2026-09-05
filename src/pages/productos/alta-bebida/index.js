// Alta de bebida (HU03). Comparte estilos con el alta de plato: los dos
// formularios tienen los mismos campos y viven en alta-producto.css.
import '../alta-producto.css';
import { crearSelectorFotosProducto } from '../../../components/selector-fotos-producto/selector-fotos-producto.js';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { mostrarToastNormal } from '../../../components/toast-normal/toast-normal.js';
import { SECTORES, TIPOS_PRODUCTO } from '../../../config/constantes.js';
import { crearBebidaCompleta } from '../../../services/productos.service.js';
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

function validarFormulario(datos, imagenes) {
  const errores = {};
  if (!esTextoObligatorioValido(datos.nombre)) errores.nombre = 'Ingresá el nombre de la bebida.';
  if (!esTextoObligatorioValido(datos.descripcion)) errores.descripcion = 'Ingresá una descripción de la bebida.';

  if (esCampoVacio(datos.tiempo)) errores.tiempo = 'Ingresá el tiempo de elaboración.';
  else if (!esEnteroPositivo(datos.tiempo)) errores.tiempo = 'El tiempo debe ser un número entero mayor que 0.';

  if (esCampoVacio(datos.precio)) errores.precio = 'Ingresá el precio de la bebida.';
  else if (!esNumeroPositivo(datos.precio)) errores.precio = 'El precio debe ser un número mayor que 0.';

  if (!hayCantidadExactaDeImagenes(imagenes, CANTIDAD_FOTOS)) {
    errores.imagenes = 'Seleccioná las tres imágenes de la bebida.';
  }
  return errores;
}

function obtenerDatosFormulario(formulario) {
  return {
    nombre: formulario.querySelector('#nombre-bebida').value?.trim() ?? '',
    descripcion: formulario.querySelector('#descripcion-bebida').value?.trim() ?? '',
    tiempo: formulario.querySelector('#tiempo-bebida').value ?? '',
    precio: formulario.querySelector('#precio-bebida').value ?? '',
  };
}

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

function mostrarResultadoValidacion(formulario, selectorFotos, errores) {
  CAMPOS.forEach((campo) => {
    mostrarErrorCampo(formulario, campo, errores[campo] ?? '');
  });
  selectorFotos.mostrarError(errores.imagenes ?? '');
  return Object.keys(errores).length === 0;
}

export function render(container) {
  container.innerHTML = `
    <ion-page class="alta-producto alta-bebida">
      <ion-content>
        <main class="alta-producto__contenido">
          <header class="alta-producto__introduccion">
            <button class="alta-producto__volver" type="button" aria-label="Volver">‹</button>
            <h1>Agregar una bebida</h1>
          </header>

          <form class="alta-producto__formulario" novalidate>
            <div class="alta-producto__fotos"></div>

            <div class="campo-formulario" data-campo="nombre">
              <label for="nombre-bebida">Nombre de la bebida</label>
              <input
                class="campo-control"
                id="nombre-bebida"
                name="nombre"
                type="text"
                maxlength="80"
                placeholder="Ej. Margarita Rosaria"
                required
              >
              <ion-note color="danger" data-error="nombre" aria-live="polite"></ion-note>
            </div>

            <div class="campo-formulario" data-campo="descripcion">
              <label for="descripcion-bebida">Descripción</label>
              <textarea
                class="campo-control"
                id="descripcion-bebida"
                name="descripcion"
                maxlength="300"
                placeholder="Ej. Tequila, jugo de limón y sal"
                required
              ></textarea>
              <ion-note color="danger" data-error="descripcion" aria-live="polite"></ion-note>
            </div>

            <div class="campo-formulario" data-campo="precio">
              <label for="precio-bebida">Precio</label>
              <input
                class="campo-control"
                id="precio-bebida"
                name="precio"
                type="number"
                inputmode="decimal"
                min="0.01"
                step="0.01"
                placeholder="$ 950"
                required
              >
              <ion-note color="danger" data-error="precio" aria-live="polite"></ion-note>
            </div>

            <div class="campo-formulario" data-campo="tiempo">
              <label for="tiempo-bebida">Tiempo prep. (min)</label>
              <input
                class="campo-control"
                id="tiempo-bebida"
                name="tiempo"
                type="number"
                inputmode="numeric"
                min="1"
                step="1"
                placeholder="5 min"
                required
              >
              <ion-note color="danger" data-error="tiempo" aria-live="polite"></ion-note>
            </div>

            <ion-button class="alta-producto__submit" type="submit" expand="block">
              <ion-spinner name="crescent" aria-hidden="true"></ion-spinner>
              <span>Guardar Bebida</span>
            </ion-button>
          </form>
        </main>
      </ion-content>
    </ion-page>
  `;

  const formulario = container.querySelector('.alta-producto__formulario');
  const botonSubmit = formulario.querySelector('.alta-producto__submit');
  const textoSubmit = botonSubmit.querySelector('span');
  const imagenes = Array(CANTIDAD_FOTOS).fill(null);
  let enviando = false;
  let validacionMostrada = false;

  container.querySelector('.alta-producto__volver').addEventListener('click', () => {
    window.history.back();
  });

  const selectorFotos = crearSelectorFotosProducto({
    descripcionProducto: 'de la bebida',
    onCambio(indice, archivo) {
      imagenes[indice] = archivo;
      if (validacionMostrada) {
        const errores = validarFormulario(obtenerDatosFormulario(formulario), imagenes);
        selectorFotos.mostrarError(errores.imagenes ?? '');
      }
    },
  });
  formulario.querySelector('.alta-producto__fotos').append(selectorFotos.elemento);

  function establecerProcesando(valor) {
    enviando = valor;
    botonSubmit.disabled = valor;
    botonSubmit.classList.toggle('alta-producto__submit--procesando', valor);
    textoSubmit.textContent = valor ? 'Guardando...' : 'Guardar Bebida';
    selectorFotos.establecerBloqueado(valor);
  }

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
      // El service verifica la carta, crea la bebida, sube las fotos y consulta
      // el resultado final. El rol autorizado por RLS es cantinero.
      await crearBebidaCompleta({
        nombre: datos.nombre,
        descripcion: datos.descripcion,
        tiempo_elaboracion_min: Number(datos.tiempo),
        precio: Number(datos.precio),
        tipo: TIPOS_PRODUCTO.BEBIDA,
        sector: SECTORES.BAR,
      }, imagenes);

      mostrarToastNormal('Bebida guardada correctamente.');
      setTimeout(() => navegarA('/productos'), 2000);
    } catch (error) {
      console.error('No se pudo completar el alta de la bebida.', error);
      mostrarToastError(`No se pudo guardar la bebida: ${error.message ?? 'error desconocido'}`);
      establecerProcesando(false);
    }
  });

  window.addEventListener('hashchange', () => selectorFotos.destruir(), { once: true });
}
