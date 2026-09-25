// Lado cliente de la lista de espera (punto 9). Se llega acá después de
// escanear el QR de ingreso al local, tanto desde el ingreso anónimo como
// desde "Ingresar al local" para un cliente registrado ya logueado.
import './index.css';
import { navegarA, reemplazarRuta } from '../../../router.js';
import { crearAppHeader } from '../../../components/app-header/app-header.js';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { avisarNuevaEspera } from '../../../services/notificaciones.service.js';
import { ESTADOS_ESPERA, ROLES } from '../../../config/constantes.js';
import { obtenerPerfilActual } from '../../../services/auth.service.js';
import { obtenerMiEstadiaActiva } from '../../../services/estadias.service.js';
import {
  anotarse,
  eliminarDeEspera,
  obtenerMiEspera,
  suscribirseAMiEspera,
} from '../../../services/lista-espera.service.js';
import { vigilarMiEstadiaSiSoyAnonima } from '../../../services/sesion-anonima.service.js';
import { ajustarVista } from '../../../components/lista-ajustada/lista-ajustada.js';
import { crearLectorQr } from '../../../components/lector-qr/lector-qr.js';
import { validarQrMesaAsignada } from '../../../services/mesa-cliente.service.js';

export function render(container) {
  container.innerHTML = `
    <ion-page class="lista-espera-cliente">
      <ion-content>
        <div data-header></div>
        <main class="lista-espera-cliente__contenido">

          <section class="lista-espera-cliente__aviso" role="status" aria-live="polite" hidden>
            <span class="lista-espera-cliente__aviso-icono" aria-hidden="true">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>
            </span>
            <span class="lista-espera-cliente__aviso-cuerpo">
              <ion-spinner class="lista-espera-cliente__aviso-spinner" name="crescent" aria-hidden="true"></ion-spinner>
              <span class="lista-espera-cliente__aviso-texto"></span>
            </span>
          </section>

          <section class="lista-espera-cliente__encuestas">
            <button class="lista-espera-cliente__resultados" type="button">
              <span class="lista-espera-cliente__resultados-icono" aria-hidden="true">
                <svg viewBox="0 0 64 64" focusable="false">
                  <path d="M10 52V30h11v22M27 52V18h11v34M44 52V8h11v44M7 52h50"/>
                </svg>
              </span>
              <span class="lista-espera-cliente__resultados-contenido">
                <strong>Resultados de satisfacción</strong>
                <small>Conocé las opiniones de visitas anteriores.</small>
                <em>Ver gráficos anteriores</em>
              </span>
              <b aria-hidden="true">›</b>
            </button>
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
    // Reemplazar evita el ciclo Lista -> Home -> atrás -> Lista tanto para
    // el cliente registrado como para la sesión anónima.
    onVolver: () => reemplazarRuta('/home'),
  });
  container.querySelector('[data-header]').append(header);

  // El invitado no tiene a dónde volver: su /home no tiene ninguna acción
  // para el rol anónimo, así que el botón lo dejaba en una pantalla vacía.
  // El cliente registrado sí conserva el suyo. El perfil está cacheado en
  // este punto (viene de crearlo al entrar), así que no llega a verse el
  // botón antes de sacarlo.
  void obtenerPerfilActual()
    .then((perfil) => {
      if (perfil?.rol !== ROLES.CLIENTE_ANONIMO) return;
      header.replaceWith(crearAppHeader({
        titulo: 'Lista de espera',
        sinVolver: true,
      }));
    })
    .catch(() => {});

  const aviso = container.querySelector('.lista-espera-cliente__aviso');
  const avisoTexto = container.querySelector('.lista-espera-cliente__aviso-texto');
  // El spinner sólo acompaña a la espera; cuando llega la mesa se apaga.
  const avisoSpinner = container.querySelector('.lista-espera-cliente__aviso-spinner');
  
  const seccionEncuestas = container.querySelector('.lista-espera-cliente__encuestas');
  const botonIngresar = container.querySelector('.lista-espera-cliente__ingresar');
  const botonIngresarMesa = container.querySelector('.lista-espera-cliente__accion-mesa');
  const botonCancelar = container.querySelector('.lista-espera-cliente__cancelar');
  const contenido = container.querySelector('.lista-espera-cliente__contenido');
  const ajusteVista = ajustarVista(contenido, {
    variable: '--le-ajuste',
    minimo: 0.88,
    maximo: 1.16,
  });
  contenido.dataset.estado = 'inicial';

  function establecerEstado(estado) {
    contenido.dataset.estado = estado;
    requestAnimationFrame(() => ajusteVista.actualizar());
  }

  container.querySelector('.lista-espera-cliente__resultados').addEventListener('click', () => {
    navegarA('/encuesta/resultados');
  });

  botonIngresarMesa.addEventListener('click', async () => {
    if (botonIngresarMesa.disabled) return;
    botonIngresarMesa.disabled = true;
    botonIngresarMesa.setAttribute('aria-busy', 'true');

    const lector = crearLectorQr({
      titulo: 'Escanear mesa',
      descripcion: 'Usá el QR de la mesa que te asignó el metre.',
      textoBoton: 'Escanear QR',
      nombreObjeto: 'QR de mesa',
      onLectura: async (contenidoQr) => {
        try {
          await validarQrMesaAsignada(contenidoQr);
          if (botonIngresarMesa.isConnected) navegarA('/mesa/carta');
        } catch (error) {
          mostrarToastError(error.message ?? 'El QR no corresponde a la mesa asignada.');
        }
      },
    });

    try {
      await lector.escanear();
    } finally {
      lector.destruir?.();
      if (botonIngresarMesa.isConnected) {
        botonIngresarMesa.disabled = false;
        botonIngresarMesa.removeAttribute('aria-busy');
      }
    }
  });

  let cancelarSuscripcion = null;
  let entradaActual = null;

  // ---- Estado de espera ----
  function mostrarEsperando() {
    establecerEstado('esperando');
    botonIngresar.hidden = true;
    botonIngresarMesa.hidden = true;
    botonCancelar.hidden = false;
    aviso.hidden = false;
    avisoSpinner.hidden = false;
    aviso.classList.remove('lista-espera-cliente__aviso--asignada');
    avisoTexto.textContent = 'Esperando la confirmación del metre';
  }

  function mostrarInicial() {
    establecerEstado('inicial');
    botonIngresar.hidden = false;
    botonIngresar.disabled = false;
    botonIngresarMesa.hidden = true;
    botonCancelar.hidden = true;
    aviso.hidden = true;
    seccionEncuestas.hidden = false;
  }

  function mostrarAsignada(numeroMesa) {
    establecerEstado('asignada');
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
    ajusteVista.destruir();
  }, { once: true });
}
