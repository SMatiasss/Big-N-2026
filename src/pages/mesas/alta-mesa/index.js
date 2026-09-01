// Alta de mesa (punto 4). Misma estructura y estilo que productos/alta-plato,
// pero con los campos y la foto única que requiere una mesa.
import './index.css';
import { crearSelectorFotoMesa } from '../../../components/selector-foto-mesa/selector-foto-mesa.js';
import { mostrarToast } from '../../../components/toast-error/toast-error.js';
import { TIPOS_MESA } from '../../../config/constantes.js';
import { crearMesaCompleta } from '../../../services/mesas.service.js';
import { navegarA } from '../../../router.js';
import {
  esArchivoImagen,
  esCampoVacio,
  esEnteroPositivo,
} from '../../../utils/validadores.js';

// Valida los datos ingresados antes de aceptar el formulario.
// Recibe un objeto con los campos y el archivo de la foto.
// Devuelve un objeto cuyas propiedades contienen los errores encontrados.
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
    errores.foto = 'Sacá una foto de la mesa.';
  }

  return errores;
}

// Lee los valores actuales de los componentes Ionic y elimina espacios
// innecesarios en los campos de texto.
function obtenerDatosFormulario(formulario) {
  return {
    numero: formulario.querySelector('#numero-mesa').value ?? '',
    cantidad: formulario.querySelector('#cantidad-mesa').value ?? '',
    tipo: formulario.querySelector('#tipo-mesa').value ?? '',
  };
}

// Actualiza el mensaje y el aspecto visual de un campo.
function mostrarErrorCampo(formulario, campo, mensaje = '') {
  const item = formulario.querySelector(`[data-campo="${campo}"]`);
  const nota = formulario.querySelector(`[data-error="${campo}"]`);
  const control = item.querySelector('ion-input, ion-select');
  const hayError = Boolean(mensaje);

  nota.textContent = mensaje;
  item.classList.toggle('campo-formulario--invalido', hayError);
  item.classList.toggle('campo-formulario--valido', !hayError && !esCampoVacio(control.value));
  control.setAttribute('aria-invalid', String(hayError));
}

// Presenta todos los errores junto a sus controles y devuelve true
// cuando el formulario completo es válido.
function mostrarResultadoValidacion(formulario, selectorFoto, errores) {
  ['numero', 'cantidad', 'tipo'].forEach((campo) => {
    mostrarErrorCampo(formulario, campo, errores[campo] ?? '');
  });

  selectorFoto.mostrarError(errores.foto ?? '');
  return Object.keys(errores).length === 0;
}

// Renderiza la interfaz de alta de mesa dentro del contenedor que entrega el router.
export function render(container) {
  container.innerHTML = `
    <ion-page class="ion-page alta-mesa">
      <ion-header>
        <ion-toolbar color="primary">
          <ion-title>Alta de mesa</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-content>
        <main class="alta-mesa__contenido">
          <header class="alta-mesa__introduccion">
            <h1>Nueva mesa</h1>
            <p>Completá los datos y sacá una foto para identificar la mesa.</p>
          </header>

          <form class="alta-mesa__formulario" novalidate>
            <div class="alta-mesa__fila-numerica">
              <div class="campo-formulario" data-campo="numero">
                <ion-item>
                  <ion-input id="numero-mesa" label="Número" label-placement="stacked" type="number" inputmode="numeric" min="1" step="1" required></ion-input>
                </ion-item>
                <ion-note color="danger" data-error="numero" aria-live="polite"></ion-note>
              </div>

              <div class="campo-formulario" data-campo="cantidad">
                <ion-item>
                  <ion-input id="cantidad-mesa" label="Cantidad de comensales" label-placement="stacked" type="number" inputmode="numeric" min="1" step="1" required></ion-input>
                </ion-item>
                <ion-note color="danger" data-error="cantidad" aria-live="polite"></ion-note>
              </div>
            </div>

            <div class="campo-formulario" data-campo="tipo">
              <ion-item>
                <ion-select id="tipo-mesa" label="Tipo" label-placement="stacked" placeholder="Seleccioná un tipo" interface="popover" required>
                  <ion-select-option value="${TIPOS_MESA.ESTANDAR}">Estándar</ion-select-option>
                  <ion-select-option value="${TIPOS_MESA.VIP}">VIP</ion-select-option>
                  <ion-select-option value="${TIPOS_MESA.MOVILIDAD_REDUCIDA}">Movilidad reducida</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-note color="danger" data-error="tipo" aria-live="polite"></ion-note>
            </div>

            <div class="alta-mesa__foto"></div>

            <div class="alta-mesa__resultado" role="status" aria-live="polite" aria-atomic="true"></div>

            <ion-button class="alta-mesa__submit" type="submit" expand="block">
              <ion-spinner name="crescent" aria-hidden="true"></ion-spinner>
              <span>Registrar mesa</span>
            </ion-button>
          </form>
        </main>
      </ion-content>
    </ion-page>
  `;

  const formulario = container.querySelector('.alta-mesa__formulario');
  const botonSubmit = formulario.querySelector('.alta-mesa__submit');
  const textoSubmit = botonSubmit.querySelector('span');
  const resultado = formulario.querySelector('.alta-mesa__resultado');

  // Estado temporal de la foto de la mesa mientras se completa el formulario.
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

  // Habilita o bloquea toda acción de envío y selección de foto.
  function establecerProcesando(valor) {
    enviando = valor;
    botonSubmit.disabled = valor;
    botonSubmit.classList.toggle('alta-mesa__submit--procesando', valor);
    textoSubmit.textContent = valor ? 'Registrando...' : 'Registrar mesa';
    selectorFoto.establecerBloqueado(valor);
  }

  // Después del primer submit, cada cambio vuelve a validar su campo para
  // que el error desaparezca apenas el usuario lo corrija.
  formulario.querySelectorAll('ion-input, ion-select').forEach((control) => {
    const evento = control.tagName === 'ION-SELECT' ? 'ionChange' : 'ionInput';
    control.addEventListener(evento, () => {
      if (!validacionMostrada) return;

      const datos = obtenerDatosFormulario(formulario);
      const errores = validarFormulario(datos, foto);
      const campo = control.closest('[data-campo]').dataset.campo;
      mostrarErrorCampo(formulario, campo, errores[campo] ?? '');
      resultado.textContent = '';
      resultado.className = 'alta-mesa__resultado';
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
      resultado.textContent = 'Revisá los campos señalados antes de continuar.';
      resultado.className = 'alta-mesa__resultado alta-mesa__resultado--error';
      return;
    }

    establecerProcesando(true);
    resultado.textContent = '';
    resultado.className = 'alta-mesa__resultado';

    try {
      // El service encapsula el INSERT, la subida a Storage y el guardado
      // de la URL pública en foto_url; el QR lo genera la base automáticamente.
      const mesaCreada = await crearMesaCompleta({
        numero: Number(datos.numero),
        cantidad_comensales: Number(datos.cantidad),
        tipo: datos.tipo,
      }, foto);

      // El qr_token es sólo un dato interno de verificación; no es algo que
      // el cliente final deba ver. Se vuelve al listado (que se re-renderiza
      // entero y por lo tanto se actualiza) recién cuando el usuario toca OK.
      mostrarToast({
        mensaje: 'Mesa registrada correctamente.',
        tipo: 'exito',
        onCerrar: () => navegarA('/mesas'),
      });
    } catch (error) {
      console.error('No se pudo completar el alta de la mesa.', error);
      mostrarToast({
        mensaje: `No se pudo registrar la mesa: ${error.message ?? 'error desconocido'}`,
        tipo: 'error',
      });
    } finally {
      establecerProcesando(false);
    }
  });

  // El router actual no ofrece un ciclo de destrucción. Escuchamos un solo cambio
  // de ruta para liberar el preview cuando el usuario abandona esta pantalla.
  window.addEventListener('hashchange', () => selectorFoto.destruir(), { once: true });
}
