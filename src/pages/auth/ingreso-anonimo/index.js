// Ingreso anónimo: nombre + foto, sin aprobación, y a continuación el QR de
// ingreso al local (punto 9). Se llega acá desde el botón "Ingresar como
// invitado" del login; esta pantalla ya arranca directo en el formulario.
import './index.css';
import { crearLectorQr } from '../../../components/lector-qr/lector-qr.js';
import { crearSelectorFotoMesa } from '../../../components/selector-foto-mesa/selector-foto-mesa.js';
import { mostrarToast } from '../../../components/toast-error/toast-error.js';
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
    <ion-page class="ion-page ingreso-anonimo">
      <ion-header>
        <ion-toolbar color="primary">
          <ion-title>Ingreso como invitado</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-content>
        <main class="ingreso-anonimo__contenido">
          <section class="ingreso-anonimo__paso" data-paso="datos">
            <header class="ingreso-anonimo__introduccion">
              <h1>Contanos quién sos</h1>
              <p>Con tu nombre y una foto alcanza para entrar como invitado.</p>
            </header>

            <form class="ingreso-anonimo__formulario" novalidate>
              <div class="campo-formulario" data-campo="nombre">
                <ion-item>
                  <ion-input id="nombre-anonimo" label="Nombre" label-placement="stacked" maxlength="80" required></ion-input>
                </ion-item>
                <ion-note color="danger" data-error="nombre" aria-live="polite"></ion-note>
              </div>

              <div class="ingreso-anonimo__foto"></div>

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

  const selectorFoto = crearSelectorFotoMesa({
    tituloEncabezado: 'Tu foto',
    descripcionEncabezado: 'Sacate una foto para identificarte.',
    etiquetaAria: 'Seleccionar foto personal',
    textoPlaceholder: 'Foto personal',
    iconoPlaceholder: '🙂',
    onCambio(archivo) {
      foto = archivo;
    },
  });
  formulario.querySelector('.ingreso-anonimo__foto').append(selectorFoto.elemento);

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

    const nombre = formulario.querySelector('#nombre-anonimo').value?.trim() ?? '';
    const errores = validarFormulario(nombre, foto);

    notaNombre.textContent = errores.nombre ?? '';
    itemNombre.classList.toggle('campo-formulario--invalido', Boolean(errores.nombre));
    selectorFoto.mostrarError(errores.foto ?? '');

    if (Object.keys(errores).length > 0) return;

    establecerProcesando(true);

    try {
      // Sesión anónima y perfil, una acción después de la otra.
      await signInAnonymously();
      await crearClienteAnonimo({ nombre, foto });

      // Sin pantalla intermedia: apenas queda creada la sesión y el perfil,
      // se abre directo el lector del QR de ingreso al local.
      pasoDatos.hidden = true;
      pasoQr.hidden = false;

      const lector = crearLectorQr({
        titulo: 'Escaneá el QR de la entrada',
        descripcion: 'Es el código que está en la puerta del local.',
        textoBoton: 'Escanear código',
        nombreObjeto: 'código',
        onLectura: async (contenido) => {
          try {
            const esValido = await validarQrIngreso(contenido);
            if (!esValido) {
              mostrarToast({
                mensaje: 'Ese código no es el de ingreso al local. Probá de nuevo.',
                tipo: 'error',
              });
              return;
            }
            navegarA('/lista-espera');
          } catch (error) {
            mostrarToast({
              mensaje: `No se pudo validar el código: ${error.message ?? 'error desconocido'}`,
              tipo: 'error',
            });
          }
        },
      });
      container.querySelector('.ingreso-anonimo__lector-qr').append(lector.elemento);
    } catch (error) {
      console.error('No se pudo completar el ingreso anónimo.', error);
      mostrarToast({
        mensaje: `No se pudo completar el ingreso: ${error.message ?? 'error desconocido'}`,
        tipo: 'error',
      });
      establecerProcesando(false);
    }
  });

  window.addEventListener('hashchange', () => selectorFoto.destruir(), { once: true });
}
