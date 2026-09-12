// Lado cliente de la lista de espera (punto 9). Se llega acá después de
// escanear el QR de ingreso al local, tanto desde el ingreso anónimo como
// desde "Ingresar al local" para un cliente registrado ya logueado.
import './index.css';
import { navegarA } from '../../../router.js';
import { crearAppHeader } from '../../../components/app-header/app-header.js';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { avisarNuevaEspera } from '../../../services/notificaciones.service.js';
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
        <div data-header></div>
        <main class="lista-espera-cliente__contenido">

          <section class="lista-espera-cliente__aviso" role="status" aria-live="polite" hidden>
            <ion-spinner class="lista-espera-cliente__aviso-spinner" name="crescent" aria-hidden="true"></ion-spinner>
            <span class="lista-espera-cliente__aviso-texto"></span>
          </section>

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
            <button class="lista-espera-cliente__accion-mesa" type="button" hidden>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3z"/>
              </svg>
              <strong>Ingresar a la mesa</strong>
            </button>
            <ion-button class="lista-espera-cliente__cancelar" expand="block" fill="outline" hidden>Cancelar espera</ion-button>
          </div>
        </main>
      </ion-content>
    </ion-page>
  `;

  const header = crearAppHeader({
    titulo: 'Lista de espera',
    onVolver: () => navegarA('/home'),
  });
  container.querySelector('[data-header]').append(header);

  const aviso = container.querySelector('.lista-espera-cliente__aviso');
  const avisoTexto = container.querySelector('.lista-espera-cliente__aviso-texto');
  // El spinner sólo acompaña a la espera; cuando llega la mesa se apaga.
  const avisoSpinner = container.querySelector('.lista-espera-cliente__aviso-spinner');
  
  const seccionEncuestas = container.querySelector('.lista-espera-cliente__encuestas');
  const botonIngresar = container.querySelector('.lista-espera-cliente__ingresar');
  const botonIngresarMesa = container.querySelector('.lista-espera-cliente__accion-mesa');
  const botonCancelar = container.querySelector('.lista-espera-cliente__cancelar');

  botonIngresarMesa.addEventListener('click', () => {
    navegarA('/mesa/escanear');
  });

  let cancelarSuscripcion = null;
  let entradaActual = null;

  // ---- Estado de espera ----
  function mostrarEsperando() {
    botonIngresar.hidden = true;
    botonIngresarMesa.hidden = true;
    botonCancelar.hidden = false;
    aviso.hidden = false;
    avisoSpinner.hidden = false;
    aviso.classList.remove('lista-espera-cliente__aviso--asignada');
    avisoTexto.textContent = 'Esperando la confirmación del metre';
  }

  function mostrarInicial() {
    botonIngresar.hidden = false;
    botonIngresar.disabled = false;
    botonIngresarMesa.hidden = true;
    botonCancelar.hidden = true;
    aviso.hidden = true;
    seccionEncuestas.hidden = false;
  }

  function mostrarAsignada(numeroMesa) {
    aviso.hidden = false;
    botonIngresar.disabled = true;
    avisoTexto.textContent = `¡Solicitud aceptada para la mesa ${numeroMesa}!`;
    avisoSpinner.hidden = true;
    aviso.classList.add('lista-espera-cliente__aviso--asignada');
    botonIngresar.hidden = true;
    botonCancelar.hidden = true;
    botonIngresarMesa.hidden = false;
    // Las encuestas se ocultan en este punto (el paso siguiente es HU11).
    seccionEncuestas.hidden = true;
  }

  function suscribirse(entrada) {
    entradaActual = entrada;
    cancelarSuscripcion = suscribirseAMiEspera(entrada.id, async (filaActualizada) => {
      if (filaActualizada.estado !== ESTADOS_ESPERA.ASIGNADO) return;

      try {
        const estadia = await obtenerMiEstadiaActiva();
        if (!aviso.isConnected || !estadia) return;
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
  botonIngresar.disabled = true;
  obtenerMiEstadiaActiva().then(async (estadia) => {
      if (!aviso.isConnected) return null;
      if (estadia) {
        mostrarAsignada(estadia.mesa.numero);
        vigilarMiEstadiaSiSoyAnonima(estadia);
        return null;
      }
      const entrada = await obtenerMiEspera();
      if (aviso.isConnected && !entrada) mostrarInicial();
      return entrada;
    })
    .then((entrada) => {
      if (!entrada || !aviso.isConnected) return;
      mostrarEsperando();
      suscribirse(entrada);
    })
    .catch(() => {
      if (aviso.isConnected) {
        aviso.hidden = false;
        avisoTexto.textContent = 'No pudimos recuperar tu espera o mesa. Volvé a ingresar a esta pantalla.';
      }
    });

  botonIngresar.addEventListener('click', async () => {
    botonIngresar.disabled = true;

    try {
      // La cantidad de comensales no forma parte de esta pantalla según el
      // flujo descripto; se usa el default de la columna (1).
      const entrada = await anotarse({ comensales: 1 });
      mostrarEsperando();
      suscribirse(entrada);

      // HU09: el aviso es best-effort. Si el push falla, el cliente ya quedó
      // anotado igual (el metre lo va a ver por Realtime al abrir el panel).
      try {
        await avisarNuevaEspera();
      } catch (errorPush) {
        console.error('No se pudo enviar el aviso push al metre.', errorPush);
      }
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
