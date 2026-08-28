// HU03 reutiliza el selector de imágenes, los validadores y la persistencia común.
import './index.css';
import { crearSelectorFotosProducto } from '../../../components/selector-fotos-producto/selector-fotos-producto.js';
import { SECTORES, TIPOS_PRODUCTO } from '../../../config/constantes.js';
import { crearBebidaCompleta } from '../../../services/productos.service.js';
import {
  esCampoVacio,
  esEnteroPositivo,
  esNumeroPositivo,
  esTextoObligatorioValido,
  hayCantidadExactaDeImagenes,
} from '../../../utils/validadores.js';

const CANTIDAD_FOTOS = 3;

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
  const control = item.querySelector('ion-input, ion-textarea');
  const hayError = Boolean(mensaje);
  nota.textContent = mensaje;
  item.classList.toggle('campo-formulario--invalido', hayError);
  item.classList.toggle('campo-formulario--valido', !hayError && !esCampoVacio(control.value));
  control.setAttribute('aria-invalid', String(hayError));
}

function mostrarResultadoValidacion(formulario, selectorFotos, errores) {
  ['nombre', 'descripcion', 'tiempo', 'precio'].forEach((campo) => {
    mostrarErrorCampo(formulario, campo, errores[campo] ?? '');
  });
  selectorFotos.mostrarError(errores.imagenes ?? '');
  return Object.keys(errores).length === 0;
}

// Renderiza HU03 y conserva localmente las tres posiciones de imágenes.
export function render(container) {
  container.innerHTML = `
    <ion-page class="alta-bebida">
      <ion-header><ion-toolbar color="primary"><ion-title>Alta de bebida</ion-title></ion-toolbar></ion-header>
      <ion-content>
        <main class="alta-bebida__contenido">
          <header class="alta-bebida__introduccion">
            <h1>Nueva bebida</h1>
            <p>Completá los datos y agregá tres fotos para presentar la bebida.</p>
          </header>
          <form class="alta-bebida__formulario" novalidate>
            <div class="campo-formulario" data-campo="nombre">
              <ion-item><ion-input id="nombre-bebida" label="Nombre" label-placement="stacked" type="text" maxlength="80" required></ion-input></ion-item>
              <ion-note color="danger" data-error="nombre" aria-live="polite"></ion-note>
            </div>
            <div class="campo-formulario" data-campo="descripcion">
              <ion-item><ion-textarea id="descripcion-bebida" label="Descripción" label-placement="stacked" maxlength="300" auto-grow="true" required></ion-textarea></ion-item>
              <ion-note color="danger" data-error="descripcion" aria-live="polite"></ion-note>
            </div>
            <div class="alta-bebida__fila-numerica">
              <div class="campo-formulario" data-campo="tiempo">
                <ion-item><ion-input id="tiempo-bebida" label="Tiempo (minutos)" label-placement="stacked" type="number" inputmode="numeric" min="1" step="1" required></ion-input></ion-item>
                <ion-note color="danger" data-error="tiempo" aria-live="polite"></ion-note>
              </div>
              <div class="campo-formulario" data-campo="precio">
                <ion-item><ion-input id="precio-bebida" label="Precio" label-placement="stacked" type="number" inputmode="decimal" min="0.01" step="0.01" required></ion-input></ion-item>
                <ion-note color="danger" data-error="precio" aria-live="polite"></ion-note>
              </div>
            </div>
            <div class="alta-bebida__fotos"></div>
            <div class="alta-bebida__resultado" role="status" aria-live="polite" aria-atomic="true"></div>
            <ion-button class="alta-bebida__submit" type="submit" expand="block">
              <ion-spinner name="crescent" aria-hidden="true"></ion-spinner><span>Registrar bebida</span>
            </ion-button>
          </form>
        </main>
      </ion-content>
    </ion-page>`;

  const formulario = container.querySelector('.alta-bebida__formulario');
  const botonSubmit = formulario.querySelector('.alta-bebida__submit');
  const textoSubmit = botonSubmit.querySelector('span');
  const resultado = formulario.querySelector('.alta-bebida__resultado');
  const imagenes = Array(CANTIDAD_FOTOS).fill(null);
  let enviando = false;
  let validacionMostrada = false;

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
  formulario.querySelector('.alta-bebida__fotos').append(selectorFotos.elemento);

  function establecerProcesando(valor) {
    enviando = valor;
    botonSubmit.disabled = valor;
    botonSubmit.classList.toggle('alta-bebida__submit--procesando', valor);
    textoSubmit.textContent = valor ? 'Registrando...' : 'Registrar bebida';
    selectorFotos.establecerBloqueado(valor);
  }

  formulario.querySelectorAll('ion-input, ion-textarea').forEach((control) => {
    control.addEventListener('ionInput', () => {
      if (!validacionMostrada) return;
      const errores = validarFormulario(obtenerDatosFormulario(formulario), imagenes);
      const campo = control.closest('[data-campo]').dataset.campo;
      mostrarErrorCampo(formulario, campo, errores[campo] ?? '');
      resultado.textContent = '';
      resultado.className = 'alta-bebida__resultado';
    });
  });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (enviando) return;
    validacionMostrada = true;
    const datos = obtenerDatosFormulario(formulario);
    const errores = validarFormulario(datos, imagenes);

    if (!mostrarResultadoValidacion(formulario, selectorFotos, errores)) {
      resultado.textContent = 'Revisá los campos señalados antes de continuar.';
      resultado.className = 'alta-bebida__resultado alta-bebida__resultado--error';
      return;
    }

    establecerProcesando(true);
    resultado.textContent = '';
    resultado.className = 'alta-bebida__resultado';
    try {
      // El service verifica la carta, crea la bebida, sube las fotos y consulta
      // el resultado final. El rol autorizado por RLS es cantinero.
      const bebidaCreada = await crearBebidaCompleta({
        nombre: datos.nombre,
        descripcion: datos.descripcion,
        tiempo_elaboracion_min: Number(datos.tiempo),
        precio: Number(datos.precio),
        tipo: TIPOS_PRODUCTO.BEBIDA,
        sector: SECTORES.BAR,
      }, imagenes);
      resultado.textContent = `Bebida registrada correctamente. ID verificado: ${bebidaCreada.id}`;
      resultado.className = 'alta-bebida__resultado alta-bebida__resultado--exito';
    } catch (error) {
      console.error('No se pudo completar el alta de la bebida.', error);
      resultado.textContent = `No se pudo registrar la bebida: ${error.message ?? 'error desconocido'}`;
      resultado.className = 'alta-bebida__resultado alta-bebida__resultado--error';
    } finally {
      establecerProcesando(false);
    }
  });

  window.addEventListener('hashchange', () => selectorFotos.destruir(), { once: true });
}
