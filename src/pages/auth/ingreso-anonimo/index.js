// Ingreso anónimo: nombre + foto, sin aprobación, y a continuación el QR de
// ingreso al local (punto 9). Se llega acá desde el botón "Ingresar como
// invitado" del login; esta pantalla ya arranca directo en el formulario.
import './index.css';
import { crearLectorQr } from '../../../components/lector-qr/lector-qr.js';
import { crearSelectorFotoMesa } from '../../../components/selector-foto-mesa/selector-foto-mesa.js';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { signInAnonymously } from '../../../services/auth.service.js';
import { crearClienteAnonimo } from '../../../services/perfiles.service.js';
import { validarQrIngreso } from '../../../services/qr.service.js';
import { navegarA } from '../../../router.js';
import { esArchivoImagen, esNombrePersonaValido } from '../../../utils/validadores.js';

function validarFormulario(nombre, foto) {
  const errores = {};
  if (!esNombrePersonaValido(nombre)) errores.nombre = 'Ingresá tu nombre.';
  if (!esArchivoImagen(foto)) errores.foto = 'Sacate una foto para continuar.';
  return errores;
}

export function render(container) {
  container.innerHTML = `
    <ion-page class="ingreso-anonimo">
      <ion-content>
        <main class="ingreso-anonimo__contenido">
          <header class="ingreso-anonimo__encabezado">
            <button class="ingreso-anonimo__volver" type="button" aria-label="Volver">‹</button>
            <h1>Ingreso como invitado</h1>
          </header>

          <!-- Dos pasos: datos y QR. El indicador deja claro cuánto falta. -->
          <ol class="ingreso-anonimo__progreso">
            <li class="ingreso-anonimo__progreso-item ingreso-anonimo__progreso-item--activo" data-progreso="datos">
              <span class="ingreso-anonimo__progreso-numero">1</span>
              Tus datos
            </li>
            <li class="ingreso-anonimo__progreso-item" data-progreso="qr">
              <span class="ingreso-anonimo__progreso-numero">2</span>
              QR de entrada
            </li>
          </ol>

          <section class="ingreso-anonimo__paso" data-paso="datos">
            <p class="ingreso-anonimo__ayuda">Con tu nombre y una foto alcanza para entrar.</p>

            <form class="ingreso-anonimo__formulario" novalidate>
              <div class="ingreso-anonimo__foto"></div>

              <div class="campo-formulario" data-campo="nombre">
                <label for="nombre-anonimo">Tu nombre</label>
                <input
                  class="campo-control"
                  id="nombre-anonimo"
                  name="nombre"
                  type="text"
                  maxlength="80"
                  autocomplete="given-name"
                  placeholder="Ej. Juan"
                  required
                >
                <ion-note color="danger" data-error="nombre" aria-live="polite"></ion-note>
              </div>

              <ion-button class="ingreso-anonimo__submit" type="submit" expand="block">
                <ion-spinner name="crescent" aria-hidden="true"></ion-spinner>
                <span>Ingresar</span>
              </ion-button>
            </form>
          </section>

          <section class="ingreso-anonimo__paso" data-paso="qr" hidden>
            <div class="ingreso-anonimo__lector-qr"></div>
          </section>
        </main>
      </ion-content>
    </ion-page>
  `;

  const pasoDatos = container.querySelector('[data-paso="datos"]');
  const pasoQr = container.querySelector('[data-paso="qr"]');
  const formulario = container.querySelector('.ingreso-anonimo__formulario');
  const botonSubmit = formulario.querySelector('.ingreso-anonimo__submit');
  const textoSubmit = botonSubmit.querySelector('span');
  const itemNombre = formulario.querySelector('[data-campo="nombre"]');
  const notaNombre = formulario.querySelector('[data-error="nombre"]');

  let foto = null;
  let enviando = false;
  let validacionMostrada = false;

  // Después del primer intento, cada cambio vuelve a validar para que el error
  // desaparezca apenas se corrige (mismo criterio que las altas de producto).
  function revalidar() {
    if (!validacionMostrada) return;

    const nombre = formulario.querySelector('#nombre-anonimo').value?.trim() ?? '';
    const errores = validarFormulario(nombre, foto);

    notaNombre.textContent = errores.nombre ?? '';
    itemNombre.classList.toggle('campo-formulario--invalido', Boolean(errores.nombre));
    selectorFoto.mostrarError(errores.foto ?? '');
  }

  const selectorFoto = crearSelectorFotoMesa({
    onCambio(archivo) {
      foto = archivo;
      revalidar();
    },
  });
  // El componente nació para la foto de la mesa y su etiqueta accesible lo
  // dice; acá la foto es de la persona. El botón no se recrea al cambiar de
  // foto (sólo su contenido), así que alcanza con corregirla una vez.
  selectorFoto.elemento
    .querySelector('.selector-foto-mesa__contenido')
    .setAttribute('aria-label', 'Tomar o subir tu foto');

  formulario.querySelector('.ingreso-anonimo__foto').append(selectorFoto.elemento);

  const botonVolver = container.querySelector('.ingreso-anonimo__volver');
  botonVolver.addEventListener('click', () => window.history.back());

  formulario.querySelector('#nombre-anonimo').addEventListener('input', revalidar);

  function establecerProcesando(valor) {
    enviando = valor;
    botonSubmit.disabled = valor;
    botonSubmit.classList.toggle('ingreso-anonimo__submit--procesando', valor);
    textoSubmit.textContent = valor ? 'Ingresando...' : 'Ingresar';
    selectorFoto.establecerBloqueado(valor);
  }

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (enviando) return;

    validacionMostrada = true;
    const nombre = formulario.querySelector('#nombre-anonimo').value?.trim() ?? '';
    const errores = validarFormulario(nombre, foto);
    revalidar();

    if (Object.keys(errores).length > 0) return;

    establecerProcesando(true);

    try {
      // Sesión anónima y perfil, una acción después de la otra.
      await signInAnonymously();
      await crearClienteAnonimo({ nombre, foto });

      // Sin pantalla intermedia: apenas queda creada la sesión y el perfil,
      // se abre directo el lector del QR de ingreso al local. La sesión anónima
      // ya existe, así que volver atrás desde acá no tendría sentido.
      pasoDatos.hidden = true;
      pasoQr.hidden = false;
      botonVolver.hidden = true;

      container.querySelectorAll('[data-progreso]').forEach((item) => {
        item.classList.toggle(
          'ingreso-anonimo__progreso-item--activo',
          item.dataset.progreso === 'qr',
        );
      });

      const lector = crearLectorQr({
        titulo: 'Escaneá el QR de la entrada',
        descripcion: 'Es el código que está en la puerta del local.',
        textoBoton: 'Escanear código',
        nombreObjeto: 'código',
        onLectura: async (contenido) => {
          try {
            const esValido = await validarQrIngreso(contenido);
            if (!esValido) {
              mostrarToastError('Ese código no es el de ingreso al local. Probá de nuevo.');
              return;
            }
            navegarA('/lista-espera');
          } catch (error) {
            mostrarToastError(`No se pudo validar el código: ${error.message ?? 'error desconocido'}`);
          }
        },
      });
      container.querySelector('.ingreso-anonimo__lector-qr').append(lector.elemento);
    } catch (error) {
      console.error('No se pudo completar el ingreso anónimo.', error);
      mostrarToastError(`No se pudo completar el ingreso: ${error.message ?? 'error desconocido'}`);
      establecerProcesando(false);
    }
  });

  window.addEventListener('hashchange', () => selectorFoto.destruir(), { once: true });
}
