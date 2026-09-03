// Lado cliente de la lista de espera (punto 9). Se llega acá después de
// escanear el QR de ingreso al local, tanto desde el ingreso anónimo como
// desde "Ingresar al local" para un cliente registrado ya logueado.
import './index.css';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { ESTADOS_ESPERA } from '../../../config/constantes.js';
import { obtenerMiEstadiaActiva } from '../../../services/estadias.service.js';
import {
  anotarse,
  eliminarDeEspera,
  obtenerMiEspera,
  suscribirseAMiEspera,
} from '../../../services/lista-espera.service.js';
import { vigilarMiEstadiaSiSoyAnonima } from '../../../services/sesion-anonima.service.js';

export function render(container) {
  container.innerHTML = `
    <ion-page class="lista-espera-cliente">
      <ion-content>
        <main class="lista-espera-cliente__contenido">
          <header class="lista-espera-cliente__marca">
            <div class="lista-espera-cliente__logo">
              <img src="/assets/logo/Icono Big N.svg" alt="" aria-hidden="true">
            </div>
            <h1>Lista de espera</h1>
          </header>

          <section class="lista-espera-cliente__aviso" role="status" aria-live="polite" hidden>
            <ion-spinner class="lista-espera-cliente__aviso-spinner" name="crescent" aria-hidden="true"></ion-spinner>
            <span class="lista-espera-cliente__aviso-texto"></span>
            <ion-button class="lista-espera-cliente__boton-mesa" fill="clear" hidden aria-label="Escanear el QR de la mesa">📷</ion-button>
          </section>

          <p class="lista-espera-cliente__indicacion" hidden>
            Buscá el código QR que está en tu mesa y escanealo con el botón de arriba.
          </p>

          <section class="lista-espera-cliente__encuestas">
            <h2>Encuestas anteriores</h2>
            <!-- Placeholder: el componente real de gráficos es tarea de HU20
                 (todavía no definida). No se toca v_resultados_encuestas acá. -->
            <div class="lista-espera-cliente__placeholder-encuestas">
              Acá van los gráficos de encuestas previas (HU20)
            </div>
          </section>

          <div class="lista-espera-cliente__acciones">
            <ion-button class="lista-espera-cliente__ingresar" expand="block">Ingresar a la lista de espera</ion-button>
            <ion-button class="lista-espera-cliente__cancelar" expand="block" fill="outline" hidden>Cancelar espera</ion-button>
          </div>
        </main>
      </ion-content>
    </ion-page>
  `;

  const aviso = container.querySelector('.lista-espera-cliente__aviso');
  const avisoTexto = container.querySelector('.lista-espera-cliente__aviso-texto');
  // El spinner sólo acompaña a la espera; cuando llega la mesa se apaga.
  const avisoSpinner = container.querySelector('.lista-espera-cliente__aviso-spinner');
  // Sólo se deja lista para conectar el escaneo de la mesa (HU11); no se
  // implementa el escaneo en sí acá.
  const botonMesa = container.querySelector('.lista-espera-cliente__boton-mesa');
  const seccionEncuestas = container.querySelector('.lista-espera-cliente__encuestas');
  const indicacion = container.querySelector('.lista-espera-cliente__indicacion');
  const botonIngresar = container.querySelector('.lista-espera-cliente__ingresar');
  const botonCancelar = container.querySelector('.lista-espera-cliente__cancelar');

  let cancelarSuscripcion = null;
  let entradaActual = null;

  // ---- Estado de espera ----
  function mostrarEsperando() {
    botonIngresar.hidden = true;
    botonCancelar.hidden = false;
    botonMesa.hidden = true;
    aviso.hidden = false;
    avisoSpinner.hidden = false;
    indicacion.hidden = true;
    aviso.classList.remove('lista-espera-cliente__aviso--asignada');
    avisoTexto.textContent = 'Esperando la confirmación del metre';
  }

  function mostrarInicial() {
    botonIngresar.hidden = false;
    botonIngresar.disabled = false;
    botonCancelar.hidden = true;
    botonMesa.hidden = true;
    aviso.hidden = true;
    indicacion.hidden = true;
    seccionEncuestas.hidden = false;
  }

  function mostrarAsignada(numeroMesa) {
    avisoTexto.textContent = `Solicitud aceptada para la mesa ${numeroMesa}`;
    avisoSpinner.hidden = true;
    aviso.classList.add('lista-espera-cliente__aviso--asignada');
    botonIngresar.hidden = true;
    botonCancelar.hidden = true;
    botonMesa.hidden = false;
    indicacion.hidden = false;
    // Las encuestas se ocultan en este punto (el paso siguiente es HU11).
    seccionEncuestas.hidden = true;
  }

  function suscribirse(entrada) {
    entradaActual = entrada;
    cancelarSuscripcion = suscribirseAMiEspera(entrada.id, async (filaActualizada) => {
      if (filaActualizada.estado !== ESTADOS_ESPERA.ASIGNADO) return;

      try {
        const estadia = await obtenerMiEstadiaActiva();
        mostrarAsignada(estadia?.mesa?.numero ?? '');
        // Sin efecto si el rol no es cliente_anonimo (ver sesion-anonima.service.js).
        if (estadia) vigilarMiEstadiaSiSoyAnonima(estadia);
      } catch (error) {
        console.error('No se pudo obtener la mesa asignada.', error);
      }
    });
  }

  // Si el cliente recarga la pantalla mientras espera, reconstruir el estado
  // en vez de dejarlo volver al botón inicial (uq_espera_activa garantiza que
  // esta consulta encuentre, como mucho, una sola fila).
  obtenerMiEspera()
    .then((entrada) => {
      if (!entrada) return;
      mostrarEsperando();
      suscribirse(entrada);
    })
    .catch((error) => console.error('No se pudo verificar si ya estabas en la lista de espera.', error));

  botonIngresar.addEventListener('click', async () => {
    botonIngresar.disabled = true;

    try {
      // La cantidad de comensales no forma parte de esta pantalla según el
      // flujo descripto; se usa el default de la columna (1).
      const entrada = await anotarse({ comensales: 1 });
      mostrarEsperando();
      suscribirse(entrada);
    } catch (error) {
      botonIngresar.disabled = false;
      console.error('No se pudo anotar en la lista de espera.', error);
      mostrarToastError(`No se pudo anotar en la lista de espera: ${error.message ?? 'error desconocido'}`);
    }
  });

  botonCancelar.addEventListener('click', async () => {
    if (!entradaActual) return;

    botonCancelar.disabled = true;

    try {
      await eliminarDeEspera(entradaActual.id);
      cancelarSuscripcion?.();
      cancelarSuscripcion = null;
      entradaActual = null;
      mostrarInicial();
    } catch (error) {
      console.error('No se pudo cancelar la espera.', error);
      mostrarToastError(`No se pudo cancelar la espera: ${error.message ?? 'error desconocido'}`);
    } finally {
      botonCancelar.disabled = false;
    }
  });

  window.addEventListener('hashchange', () => {
    cancelarSuscripcion?.();
  }, { once: true });
}
