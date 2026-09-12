// Puntos 18 y 19 (lado cliente).
//
// 18: "El cliente verifica el cambio de estado en su pedido" — el progreso se
//     actualiza solo por realtime a medida que cocina y bar terminan.
// 19: "El cliente confirma la recepción de su pedido" y recién entonces se le
//     habilitan los juegos, la encuesta y pedir la cuenta.
import './index.css';
import { ajustarLista } from '../../../components/lista-ajustada/lista-ajustada.js';
import { crearAppHeader } from '../../../components/app-header/app-header.js';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { mostrarToastNormal } from '../../../components/toast-normal/toast-normal.js';
import { ESTADOS_ITEM, ESTADOS_PEDIDO } from '../../../config/constantes.js';
import {
  confirmarRecepcionPedido,
  obtenerMiPedidoEnCurso,
  suscribirseAMiPedido,
} from '../../../services/pedidos.service.js';
import { navegarA } from '../../../router.js';

const ETIQUETAS_SECTOR = {
  cocina: 'Cocina',
  bar: 'Bar',
};

// Los cuatro pasos que recorre el pedido, en orden. El número que devuelve
// pasoActual() es el paso en el que está parado ahora mismo.
const PASOS = ['Enviado', 'En preparación', 'Listo', 'Recibido'];

function pasoActual(pedido) {
  if (pedido.estado === ESTADOS_PEDIDO.ENTREGADO) return 4;
  if (pedido.estado === ESTADOS_PEDIDO.LISTO) return 3;
  if (pedido.estado === ESTADOS_PEDIDO.EN_PREPARACION) return 2;
  return 1;
}

// El texto grande que explica, en criollo, qué está pasando.
function mensajeEstado(pedido) {
  if (pedido.estado === ESTADOS_PEDIDO.ENTREGADO) {
    return 'Recibiste tu pedido. ¡Buen provecho!';
  }
  if (pedido.estado === ESTADOS_PEDIDO.LISTO) {
    return pedido.entregado_en
      ? 'El mozo te entregó el pedido. Confirmá que lo recibiste.'
      : 'Tu pedido está completo. El mozo ya te lo lleva a la mesa.';
  }
  if (pedido.estado === ESTADOS_PEDIDO.EN_PREPARACION) {
    return 'Tu pedido se está preparando.';
  }
  return 'Tu pedido está esperando la confirmación del mozo.';
}

function plantillaPasos(pedido) {
  const actual = pasoActual(pedido);

  return PASOS
    .map((texto, indice) => {
      const numero = indice + 1;
      let clase = 'estado-pedido__paso';
      if (numero < actual) clase += ' estado-pedido__paso--completo';
      if (numero === actual) clase += ' estado-pedido__paso--actual';

      return `
        <li class="${clase}">
          <span class="estado-pedido__punto" aria-hidden="true"></span>
          <span class="estado-pedido__paso-texto">${texto}</span>
        </li>
      `;
    })
    .join('');
}

function plantillaItems(pedido) {
  return (pedido.pedido_items ?? [])
    .map((item) => {
      const listo = item.estado === ESTADOS_ITEM.LISTO || item.estado === ESTADOS_ITEM.ENTREGADO;
      return `
        <li class="estado-pedido__item ${listo ? 'estado-pedido__item--listo' : ''}">
          <span class="estado-pedido__cantidad">${item.cantidad}×</span>
          <span class="estado-pedido__producto">${item.productos?.nombre ?? 'Producto'}</span>
          <span class="estado-pedido__sector">
            ${listo ? 'Listo' : ETIQUETAS_SECTOR[item.sector] ?? item.sector}
          </span>
        </li>
      `;
    })
    .join('');
}

export function render(container) {
  container.innerHTML = `
    <ion-page class="estado-pedido">
      <ion-content class="pantalla-lista" scroll-y="false">

        <div data-header></div>

        <main class="estado-pedido__contenido pantalla-lista__cuerpo">

          <div class="estado-pedido__estado-carga">
            <ion-spinner name="crescent" aria-hidden="true"></ion-spinner>
            <span>Buscando tu pedido...</span>
          </div>

          <section class="estado-pedido__resumen" hidden>
            <p class="estado-pedido__mesa"></p>
            <ol class="estado-pedido__pasos"></ol>
            <p class="estado-pedido__mensaje-estado" role="status" aria-live="polite"></p>
          </section>

          <ul class="estado-pedido__items lista-ajustada" hidden></ul>

          <p class="estado-pedido__vacio" hidden></p>

          <footer class="estado-pedido__pie" hidden>

            <button type="button" class="estado-pedido__confirmar" disabled>
              Confirmar recepción
            </button>

            <!-- Punto 19: se habilitan recién con el pedido recibido. -->
            <nav class="estado-pedido__siguientes" aria-label="Qué podés hacer ahora" hidden>
              <button type="button" data-ruta="/juegos/1">Juegos</button>
              <button type="button" data-ruta="/encuesta">Encuesta</button>
              <button type="button" data-ruta="/cuenta/solicitar">Pedir la cuenta</button>
            </nav>

          </footer>

        </main>

      </ion-content>
    </ion-page>
  `;

  const estadoCarga = container.querySelector('.estado-pedido__estado-carga');
  const resumen = container.querySelector('.estado-pedido__resumen');
  const textoMesa = container.querySelector('.estado-pedido__mesa');
  const pasos = container.querySelector('.estado-pedido__pasos');
  const mensajeEstadoEl = container.querySelector('.estado-pedido__mensaje-estado');
  const items = container.querySelector('.estado-pedido__items');
  const vacio = container.querySelector('.estado-pedido__vacio');
  const pie = container.querySelector('.estado-pedido__pie');
  const botonConfirmar = container.querySelector('.estado-pedido__confirmar');
  const siguientes = container.querySelector('.estado-pedido__siguientes');

  const ajusteLista = ajustarLista(items);

  const header = crearAppHeader({
    titulo: 'Mi pedido',
    etiquetaVolver: 'Volver a la carta',
    onVolver: () => navegarA('/mesa/carta'),
  });
  container.querySelector('[data-header]').append(header);

  siguientes.querySelectorAll('button').forEach((boton) => {
    boton.addEventListener('click', () => navegarA(boton.dataset.ruta));
  });

  let pedido = null;
  let desuscribir = null;
  let pedidoSuscripto = null;
  let avisoEntregaMostrado = false;

  function pintarSinPedido() {
    estadoCarga.hidden = true;
    resumen.hidden = true;
    items.hidden = true;
    pie.hidden = true;
    vacio.hidden = false;
    vacio.textContent = 'Todavía no tenés ningún pedido en curso. Armá el tuyo desde la carta.';
  }

  function pintar() {
    if (!pedido) {
      pintarSinPedido();
      return;
    }

    estadoCarga.hidden = true;
    vacio.hidden = true;
    resumen.hidden = false;
    items.hidden = false;
    pie.hidden = false;

    const mesa = pedido.estadias?.mesas?.numero;
    textoMesa.textContent = mesa ? `Mesa ${mesa}` : 'Tu pedido';

    pasos.innerHTML = plantillaPasos(pedido);
    mensajeEstadoEl.textContent = mensajeEstado(pedido);

    items.innerHTML = plantillaItems(pedido);
    ajusteLista.actualizar();

    const recibido = pedido.estado === ESTADOS_PEDIDO.ENTREGADO;
    const puedeConfirmar = pedido.estado === ESTADOS_PEDIDO.LISTO && Boolean(pedido.entregado_en);

    botonConfirmar.hidden = recibido;
    botonConfirmar.disabled = !puedeConfirmar;
    botonConfirmar.textContent = puedeConfirmar
      ? 'Confirmar recepción'
      : 'Esperando que el mozo lo entregue';

    siguientes.hidden = !recibido;
  }

  async function confirmar() {
    botonConfirmar.disabled = true;
    try {
      await confirmarRecepcionPedido(pedido.id);
      mostrarToastNormal('Confirmaste la recepción. Ya podés jugar, responder la encuesta o pedir la cuenta.');
      await cargar();
    } catch (error) {
      mostrarToastError(`No se pudo confirmar la recepción: ${error.message ?? 'error desconocido'}`);
      botonConfirmar.disabled = false;
    }
  }

  botonConfirmar.addEventListener('click', () => void confirmar());

  async function cargar() {
    try {
      pedido = await obtenerMiPedidoEnCurso();
      if (!container.isConnected) return;

      pintar();

      // La suscripción se arma recién cuando hay un pedido al que seguirle los
      // cambios; antes de eso no hay id sobre el que filtrar. Si durante la
      // misma estadía el cliente hace otro pedido, se rearma sobre el nuevo.
      if (pedido && pedidoSuscripto !== pedido.id) {
        desuscribir?.();
        pedidoSuscripto = pedido.id;
        avisoEntregaMostrado = false;
        desuscribir = suscribirseAMiPedido(pedido.id, () => void cargar());
      }

      // Punto 19: el aviso de que el mozo ya lo entregó, una sola vez.
      if (pedido?.entregado_en && pedido.estado === ESTADOS_PEDIDO.LISTO && !avisoEntregaMostrado) {
        avisoEntregaMostrado = true;
        mostrarToastNormal('El mozo entregó tu pedido. Confirmá que lo recibiste.');
      }
    } catch (error) {
      if (!container.isConnected) return;
      estadoCarga.hidden = true;
      resumen.hidden = true;
      items.hidden = true;
      pie.hidden = true;
      vacio.hidden = false;
      vacio.textContent = `No se pudo cargar tu pedido: ${error.message ?? 'error desconocido'}`;
    }
  }

  void cargar();

  // Respaldo del realtime: si el socket se cae, igual se refresca solo.
  const intervalo = setInterval(() => {
    if (!document.hidden && container.isConnected) void cargar();
  }, 15000);

  window.addEventListener('hashchange', () => {
    clearInterval(intervalo);
    desuscribir?.();
    ajusteLista.destruir();
  }, { once: true });
}
