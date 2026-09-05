// Alta de mesa adaptada al diseño temático de la aplicación:
// diseño idéntico al mockup (fondo #606c38, campos #4a572c, etiquetas #dda15e, segmented controls y toasts).
import './index.css';
import { crearSelectorFotoMesa } from '../../../components/selector-foto-mesa/selector-foto-mesa.js';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { mostrarToastNormal } from '../../../components/toast-normal/toast-normal.js';
import { TIPOS_MESA } from '../../../config/constantes.js';
import { crearMesaCompleta } from '../../../services/mesas.service.js';
import { navegarA } from '../../../router.js';
import {
  esArchivoImagen,
  esCampoVacio,
  esEnteroPositivo,
} from '../../../utils/validadores.js';

// Valida los datos ingresados antes de aceptar el formulario.
function validarFormulario(datos, foto) {
  const errores = {};

  if (esCampoVacio(datos.numero)) {
    errores.numero = 'Ingresá el número de mesa.';
  } else if (!esEnteroPositivo(datos.numero)) {
    errores.numero = 'El número debe ser un entero mayor que 0.';
  }

  if (esCampoVacio(datos.cantidad)) {
    errores.cantidad = 'Ingresá la cantidad de comensales.';
  } else if (!esEnteroPositivo(datos.cantidad)) {
    errores.cantidad = 'La cantidad debe ser un entero mayor que 0.';
  }

  if (esCampoVacio(datos.tipo) || !Object.values(TIPOS_MESA).includes(datos.tipo)) {
    errores.tipo = 'Seleccioná el tipo de mesa.';
  }

  if (!esArchivoImagen(foto)) {
    errores.foto = 'Tomá o subí una foto de la mesa.';
  }

  return errores;
}

// Lee los valores actuales de los controles.
function obtenerDatosFormulario(formulario) {
  return {
    numero: formulario.querySelector('#numero-mesa')?.value?.trim() ?? '',
    cantidad: formulario.querySelector('#cantidad-mesa')?.value?.trim() ?? '',
    tipo: formulario.querySelector('#tipo-mesa')?.value ?? TIPOS_MESA.ESTANDAR,
    estado: formulario.querySelector('#estado-mesa')?.value ?? 'libre',
  };
}

// Actualiza el aspecto visual y mensaje de error de un campo.
function mostrarErrorCampo(formulario, campo, mensaje = '') {
  const item = formulario.querySelector(`[data-campo="${campo}"]`);
  if (!item) return;

  const nota = item.querySelector(`[data-error="${campo}"]`);
  const control = item.querySelector('input');
  const hayError = Boolean(mensaje);

  if (nota) nota.textContent = mensaje;
  item.classList.toggle('campo-formulario--invalido', hayError);
  if (control) control.setAttribute('aria-invalid', String(hayError));
}

// Presenta los errores y devuelve true si no hay fallos.
function mostrarResultadoValidacion(formulario, selectorFoto, errores) {
  ['numero', 'cantidad', 'tipo'].forEach((campo) => {
    mostrarErrorCampo(formulario, campo, errores[campo] ?? '');
  });

  selectorFoto.mostrarError(errores.foto ?? '');
  return Object.keys(errores).length === 0;
}

export function render(container) {
  container.innerHTML = `
    <ion-page class="alta-mesa">
      <ion-content>
        <main class="alta-mesa__contenido">
          <header class="alta-mesa__header">
            <button class="alta-mesa__volver" type="button" aria-label="Volver">‹</button>
            <h1 class="alta-mesa__titulo">Agregar una mesa</h1>
          </header>

          <form class="alta-mesa__formulario" novalidate>
            <!-- NÚMERO Y ASIENTOS -->
            <div class="alta-mesa__fila-numerica">
              <div class="campo-formulario" data-campo="numero">
                <label class="campo-label" for="numero-mesa">NÚMERO</label>
                <input
                  id="numero-mesa"
                  name="numero"
                  class="campo-control"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  step="1"
                  placeholder="14"
                  required
                >
                <span class="campo-error" data-error="numero" role="alert"></span>
              </div>

              <div class="campo-formulario" data-campo="cantidad">
                <label class="campo-label" for="cantidad-mesa">ASIENTOS</label>
                <div class="campo-control-asientos">
                  <input
                    id="cantidad-mesa"
                    name="cantidad"
                    class="campo-control campo-control--asientos"
                    type="number"
                    inputmode="numeric"
                    min="1"
                    step="1"
                    placeholder="4"
                    value="4"
                    required
                  >
                  <span class="campo-control-asientos__sufijo">personas</span>
                  <div class="campo-control-asientos__stepper">
                    <button type="button" class="asientos-step-btn asientos-step-btn--up" aria-label="Aumentar asientos">▲</button>
                    <button type="button" class="asientos-step-btn asientos-step-btn--down" aria-label="Disminuir asientos">▼</button>
                  </div>
                </div>
                <span class="campo-error" data-error="cantidad" role="alert"></span>
              </div>
            </div>

            <!-- TIPO DE MESA -->
            <div class="campo-formulario" data-campo="tipo">
              <label class="campo-label">TIPO DE MESA</label>
              <div class="selector-segmentos selector-segmentos--tipo" role="radiogroup" aria-label="Tipo de mesa">
                <button
                  type="button"
                  class="selector-segmentos__opcion selector-segmentos__opcion--activa"
                  data-valor="${TIPOS_MESA.ESTANDAR}"
                >
                  Estándar
                </button>
                <button
                  type="button"
                  class="selector-segmentos__opcion"
                  data-valor="${TIPOS_MESA.VIP}"
                >
                  VIP
                </button>
                <button
                  type="button"
                  class="selector-segmentos__opcion"
                  data-valor="${TIPOS_MESA.MOVILIDAD_REDUCIDA}"
                >
                  Adaptada
                </button>
              </div>
              <input type="hidden" id="tipo-mesa" name="tipo" value="${TIPOS_MESA.ESTANDAR}">
              <span class="campo-error" data-error="tipo" role="alert"></span>
            </div>

            <!-- DISPONIBILIDAD INICIAL -->
            <div class="campo-formulario" data-campo="estado">
              <label class="campo-label">DISPONIBILIDAD INICIAL</label>
              <div class="selector-segmentos selector-segmentos--estado" role="radiogroup" aria-label="Disponibilidad inicial">
                <button
                  type="button"
                  class="selector-segmentos__opcion selector-segmentos__opcion--activa"
                  data-valor="libre"
                >
                  Vacía (Libre)
                </button>
                <button
                  type="button"
                  class="selector-segmentos__opcion"
                  data-valor="ocupada"
                >
                  Ocupada
                </button>
              </div>
              <input type="hidden" id="estado-mesa" name="estado" value="libre">
            </div>

            <!-- FOTO DE UBICACIÓN -->
            <div class="campo-formulario" data-campo="foto">
              <label class="campo-label">FOTO DE UBICACIÓN</label>
              <div class="alta-mesa__foto"></div>
            </div>

            <!-- BOTÓN GUARDAR -->
            <button class="alta-mesa__submit" type="submit">
              <ion-spinner name="crescent" aria-hidden="true"></ion-spinner>
              <span>Guardar Mesa</span>
            </button>
          </form>
        </main>
      </ion-content>
    </ion-page>
  `;

  const formulario = container.querySelector('.alta-mesa__formulario');
  const botonSubmit = formulario.querySelector('.alta-mesa__submit');
  const textoSubmit = botonSubmit.querySelector('span');

  // Volver
  container.querySelector('.alta-mesa__volver').addEventListener('click', () => {
    window.history.back();
  });

  // Selector de segmentos (TIPO DE MESA)
  const inputTipo = formulario.querySelector('#tipo-mesa');
  const botonesTipo = formulario.querySelectorAll('.selector-segmentos--tipo .selector-segmentos__opcion');
  botonesTipo.forEach((boton) => {
    boton.addEventListener('click', () => {
      botonesTipo.forEach((b) => b.classList.remove('selector-segmentos__opcion--activa'));
      boton.classList.add('selector-segmentos__opcion--activa');
      inputTipo.value = boton.dataset.valor;
      mostrarErrorCampo(formulario, 'tipo', '');
    });
  });

  // Selector de segmentos (DISPONIBILIDAD INICIAL)
  const inputEstado = formulario.querySelector('#estado-mesa');
  const botonesEstado = formulario.querySelectorAll('.selector-segmentos--estado .selector-segmentos__opcion');
  botonesEstado.forEach((boton) => {
    boton.addEventListener('click', () => {
      botonesEstado.forEach((b) => b.classList.remove('selector-segmentos__opcion--activa'));
      boton.classList.add('selector-segmentos__opcion--activa');
      inputEstado.value = boton.dataset.valor;
    });
  });

  // Botones de incremento/decremento de asientos
  const inputCantidad = formulario.querySelector('#cantidad-mesa');
  formulario.querySelector('.asientos-step-btn--up')?.addEventListener('click', (e) => {
    e.preventDefault();
    const val = parseInt(inputCantidad.value, 10) || 0;
    inputCantidad.value = val + 1;
    inputCantidad.dispatchEvent(new Event('input', { bubbles: true }));
  });
  formulario.querySelector('.asientos-step-btn--down')?.addEventListener('click', (e) => {
    e.preventDefault();
    const val = parseInt(inputCantidad.value, 10) || 1;
    inputCantidad.value = Math.max(1, val - 1);
    inputCantidad.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // Selector de foto
  let foto = null;
  let enviando = false;
  let validacionMostrada = false;

  const selectorFoto = crearSelectorFotoMesa({
    onCambio(archivo) {
      foto = archivo;
      if (validacionMostrada) {
        const errores = validarFormulario(obtenerDatosFormulario(formulario), foto);
        selectorFoto.mostrarError(errores.foto ?? '');
      }
    },
  });

  formulario.querySelector('.alta-mesa__foto').append(selectorFoto.elemento);

  // Bloqueo durante envío
  function establecerProcesando(valor) {
    enviando = valor;
    botonSubmit.disabled = valor;
    botonSubmit.classList.toggle('alta-mesa__submit--procesando', valor);
    textoSubmit.textContent = valor ? 'Guardando...' : 'Guardar Mesa';
    selectorFoto.establecerBloqueado(valor);
  }

  // Validación dinámica
  formulario.querySelectorAll('input:not([type="hidden"])').forEach((control) => {
    control.addEventListener('input', () => {
      if (!validacionMostrada) return;
      const datos = obtenerDatosFormulario(formulario);
      const errores = validarFormulario(datos, foto);
      const campo = control.closest('[data-campo]')?.dataset.campo;
      if (campo) mostrarErrorCampo(formulario, campo, errores[campo] ?? '');
    });
  });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (enviando) return;

    validacionMostrada = true;
    const datos = obtenerDatosFormulario(formulario);
    const errores = validarFormulario(datos, foto);
    const esValido = mostrarResultadoValidacion(formulario, selectorFoto, errores);

    if (!esValido) {
      mostrarToastError('Revisá los campos señalados antes de continuar.');
      return;
    }

    establecerProcesando(true);

    try {
      await crearMesaCompleta({
        numero: Number(datos.numero),
        cantidad_comensales: Number(datos.cantidad),
        tipo: datos.tipo,
        estado: datos.estado,
      }, foto);

      mostrarToastNormal('Mesa registrada correctamente.');
      setTimeout(() => navegarA('/mesas'), 2000);
    } catch (error) {
      console.error('No se pudo completar el alta de la mesa.', error);
      mostrarToastError(`No se pudo registrar la mesa: ${error.message ?? 'error desconocido'}`);
    } finally {
      establecerProcesando(false);
    }
  });

  window.addEventListener('hashchange', () => selectorFoto.destruir(), { once: true });
}
