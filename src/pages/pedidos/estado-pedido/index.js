// Puntos 13, 18 y 19 (lado cliente).
//
// 13: si el mozo rechaza el pedido, el cliente lo ve acá (ya no desaparece:
//     el pedido nunca se borra, ver 03_baja_logica.sql) y puede modificarlo
//     -parcial o totalmente- y volver a enviarlo.
// 18: "El cliente verifica el cambio de estado en su pedido" — el progreso se
//     actualiza solo por realtime a medida que cocina y bar terminan.
// 19: "El cliente confirma la recepción de su pedido" y recién entonces se le
//     habilitan la encuesta y pedir la cuenta.
// 15: los juegos (sólo cliente registrado) se habilitan antes, apenas el mozo
//     confirma el pedido.
import './index.css';
import { ajustarLista } from '../../../components/lista-ajustada/lista-ajustada.js';
import { crearAppHeader } from '../../../components/app-header/app-header.js';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { mostrarToastNormal } from '../../../components/toast-normal/toast-normal.js';
import { ESTADOS_ITEM, ESTADOS_PEDIDO, ROLES } from '../../../config/constantes.js';
import { obtenerPerfilActual } from '../../../services/auth.service.js';
import { vibrarError } from '../../../utils/vibracion.js';
import {
  confirmarRecepcionPedido,
  obtenerMiPedidoEnCurso,
  suscribirseAMiPedido,
} from '../../../services/pedidos.service.js';
import { solicitarCuenta } from '../../../services/cuentas.service.js';
import { precargarCarritoDesdePedido } from '../../../utils/carrito-desde-pedido.js';
import { navegarA } from '../../../router.js';
import { formatearTiempoEstimado } from '../../../utils/tiempo-pedido.js';

const RUTA_CUENTA = '/cuenta/solicitar';

// Punto 15: misma regla que aplica la base al jugar (hu15_jugar): los juegos
// se habilitan cuando el mozo confirma el pedido, no recién al recibirlo.
// Antes el botón aparecía sólo con el pedido recibido, y la única otra
// El acceso permanece disponible en esta pantalla única de seguimiento
// mientras el cliente espera el pedido.
const ESTADOS_CON_JUEGOS = [
  ESTADOS_PEDIDO.EN_PREPARACION,
  ESTADOS_PEDIDO.LISTO,
  ESTADOS_PEDIDO.ENTREGADO,
];

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
  if (pedido.estado === ESTADOS_PEDIDO.RECHAZADO) {
    return 'El mozo rechazó tu pedido. Modificalo y volvé a enviarlo cuando quieras.';
  }
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
  // Rechazado: el sector/"Listo" no dice nada útil -nunca llegó a prepararse-,
  // así que la lista sólo muestra qué había pedido.
  const rechazado = pedido.estado === ESTADOS_PEDIDO.RECHAZADO;
  return (pedido.pedido_items ?? [])
    .map((item) => {
      const listo = item.estado === ESTADOS_ITEM.LISTO || item.estado === ESTADOS_ITEM.ENTREGADO;
      return `
        <li class="estado-pedido__item ${listo ? 'estado-pedido__item--listo' : ''}">
          <span class="estado-pedido__cantidad">${item.cantidad}×</span>
          <span class="estado-pedido__producto">${item.productos?.nombre ?? 'Producto'}</span>
          ${rechazado ? '' : `
          <span class="estado-pedido__sector">
            ${listo ? 'Listo' : ETIQUETAS_SECTOR[item.sector] ?? item.sector}
          </span>`}
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
            <p class="estado-pedido__tiempo">Tiempo estimado del pedido completo: <strong></strong></p>
            <ol class="estado-pedido__pasos"></ol>
            <p class="estado-pedido__mensaje-estado" role="status" aria-live="polite"></p>
          </section>

          <ul class="estado-pedido__items lista-ajustada" hidden></ul>

          <p class="estado-pedido__vacio" hidden></p>

          <footer class="estado-pedido__pie" hidden>

            <button type="button" class="estado-pedido__confirmar" disabled>
              Confirmar recepción
            </button>

            <!-- Punto 13: el mozo rechazó el pedido. Se precarga el carrito
                 con lo que tenía y se lo lleva a la carta a modificarlo. -->
            <button type="button" class="estado-pedido__confirmar estado-pedido__modificar" hidden>
              Modificar y volver a enviar
            </button>

            <!-- Punto 19: encuesta y cuenta se habilitan recién con el pedido
                 recibido. Juegos antes, ver ESTADOS_CON_JUEGOS. -->
            <nav class="estado-pedido__siguientes" aria-label="Qué podés hacer ahora" hidden>
              <button type="button" data-ruta="/juegos">Juegos</button>
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
  const textoTiempo = container.querySelector('.estado-pedido__tiempo strong');
  const pasos = container.querySelector('.estado-pedido__pasos');
  const mensajeEstadoEl = container.querySelector('.estado-pedido__mensaje-estado');
  const items = container.querySelector('.estado-pedido__items');
  const vacio = container.querySelector('.estado-pedido__vacio');
  const pie = container.querySelector('.estado-pedido__pie');
  const botonConfirmar = container.querySelector('.estado-pedido__confirmar:not(.estado-pedido__modificar)');
  const botonModificar = container.querySelector('.estado-pedido__modificar');
  const siguientes = container.querySelector('.estado-pedido__siguientes');
  const botonJuegos = siguientes.querySelector('[data-ruta="/juegos"]');
  const botonesPostRecepcion = siguientes.querySelectorAll('button:not([data-ruta="/juegos"])');

  const ajusteLista = ajustarLista(items);

  const header = crearAppHeader({
    titulo: 'Mi pedido',
    etiquetaVolver: 'Volver a la carta',
    onVolver: () => navegarA('/mesa/carta'),
  });
  container.querySelector('[data-header]').append(header);

  siguientes.querySelectorAll('button').forEach((boton) => {
    // Punto 21: "Pedir la cuenta" no es sólo navegar. Primero se crea la
    // cuenta y se le avisa al mozo, y recién con eso hecho se entra a la
    // pantalla, que así abre con la fila ya existente.
    if (boton.dataset.ruta === RUTA_CUENTA) {
      boton.addEventListener('click', () => void pedirCuenta(boton));
      return;
    }
    boton.addEventListener('click', () => navegarA(boton.dataset.ruta));
  });

  // solicitarCuenta es idempotente: si el cliente vuelve a tocar el botón (o
  // ya había pedido la cuenta antes) no duplica la fila ni reavisa al mozo.
  async function pedirCuenta(boton) {
    boton.disabled = true;
    try {
      await solicitarCuenta();
      navegarA(RUTA_CUENTA);
    } catch (error) {
      mostrarToastError(`No se pudo pedir la cuenta: ${error.message ?? 'error desconocido'}`);
      boton.disabled = false;
    }
  }

  // Los juegos son sólo para el cliente registrado (el anónimo no participa por
  // descuentos, ver la nota del punto 14), y /juegos está restringido a ese rol
  // en config/navegacion.js: si le dejáramos el botón al anónimo, tocarlo lo
  // devolvería al home con un aviso de "no disponible para tu perfil".
  // La encuesta y la cuenta sí son para los dos. Hasta confirmar el rol el
  // botón queda oculto (esClienteRegistrado arranca en false).
  let esClienteRegistrado = false;
  void obtenerPerfilActual()
    .then((perfil) => {
      esClienteRegistrado = perfil?.rol === ROLES.CLIENTE_REGISTRADO;
      if (pedido && container.isConnected) pintar();
    })
    .catch(() => {});

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
    textoTiempo.textContent = formatearTiempoEstimado(pedido.tiempo_estimado_min);

    // Punto 13: rechazado no es un paso más del progreso normal -no llegó a
    // cocina/bar-, así que la barra de pasos no aplica acá.
    const rechazado = pedido.estado === ESTADOS_PEDIDO.RECHAZADO;
    pasos.hidden = rechazado;
    if (!rechazado) pasos.innerHTML = plantillaPasos(pedido);
    mensajeEstadoEl.textContent = mensajeEstado(pedido);

    items.innerHTML = plantillaItems(pedido);
    ajusteLista.actualizar();

    const recibido = pedido.estado === ESTADOS_PEDIDO.ENTREGADO;
    const puedeConfirmar = pedido.estado === ESTADOS_PEDIDO.LISTO && Boolean(pedido.entregado_en);

    botonConfirmar.hidden = recibido || rechazado;
    botonConfirmar.disabled = !puedeConfirmar;
    botonConfirmar.textContent = puedeConfirmar
      ? 'Confirmar recepción'
      : 'Esperando que el mozo lo entregue';

    botonModificar.hidden = !rechazado;

    const juegosHabilitados = esClienteRegistrado && ESTADOS_CON_JUEGOS.includes(pedido.estado);
    botonJuegos.hidden = !juegosHabilitados;
    botonesPostRecepcion.forEach((boton) => { boton.hidden = !recibido; });
    siguientes.hidden = !recibido && !juegosHabilitados;
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

  // Punto 13: precarga el carrito con lo que tenía el pedido rechazado -así
  // no arranca de cero, y puede sumar, sacar o cambiar cantidades- y lo manda
  // a la carta a terminarlo. El pedido rechazado en sí no se toca: sigue
  // existiendo como historial (03_baja_logica.sql); al confirmar de nuevo en
  // la carta se crea un pedido nuevo (crearPedido + avisarNuevoPedido, ya
  // existente), que es el que va a ver el mozo.
  function modificar() {
    precargarCarritoDesdePedido(pedido);
    navegarA('/mesa/carta');
  }

  botonConfirmar.addEventListener('click', () => void confirmar());
  botonModificar.addEventListener('click', modificar);

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
      // Este error se muestra en la pantalla, no con el toast, así que la
      // vibración del requisito excluyente hay que pedirla acá.
      void vibrarError();
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
