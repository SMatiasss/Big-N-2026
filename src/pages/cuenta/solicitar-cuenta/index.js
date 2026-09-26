// Punto 21 (lado cliente): pedir la cuenta, escanear el QR de propina y pagar.
//
// Una sola pantalla con tres estados internos, sin cambiar de ruta entre ellos
// (mismo patrón que la lista de espera del punto 9):
//   1. detalle de lo consumido + "escaneá el QR de propina"
//   2. nivel elegido + TOTAL grande + botón Pagar
//   3. "esperando la confirmación del mozo", sin cancelar: ya está pagado.
//
// El bloque de arriba (el detalle) no cambia nunca; el de abajo es el que va
// mutando, así la pantalla nunca queda con un hueco vacío esperando al usuario.
//
// La confirmación del mozo y el cierre de la mesa son del punto 22: acá sólo
// queda la suscripción lista para que ese cambio llegue por Realtime.
import './index.css';
import { crearAppHeader } from '../../../components/app-header/app-header.js';
import { crearLectorQr } from '../../../components/lector-qr/lector-qr.js';
// Sólo la cáscara ".pantalla-lista" (header fijo + cuerpo flex): la lista de
// consumos tiene su propio alto fijo de 3 ítems, ver index.css.
import '../../../components/lista-ajustada/lista-ajustada.css';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { mostrarToastNormal } from '../../../components/toast-normal/toast-normal.js';
import { ESTADOS_CUENTA } from '../../../config/constantes.js';
import {
  aplicarPropina,
  obtenerResumenCuenta,
  pagarCuenta,
  solicitarCuenta,
  suscribirseAMiCuenta,
  validarQrPropina,
} from '../../../services/cuentas.service.js';
import { formatearMoneda } from '../../../utils/formato.js';
import { navegarA, reemplazarRuta } from '../../../router.js';

function plantillaItems(items) {
  if (!items.length) {
    return '<li class="cuenta__item cuenta__item--vacio">No hay consumos registrados en esta mesa.</li>';
  }
  return items
    .map((item) => `
      <li class="cuenta__item">
        <span class="cuenta__item-cantidad">${item.cantidad}×</span>
        <span class="cuenta__item-datos">
          <span class="cuenta__item-nombre">${item.nombre}</span>
          <span class="cuenta__item-unitario">${formatearMoneda(item.precioUnitario)} c/u</span>
        </span>
        <strong class="cuenta__item-importe">${formatearMoneda(item.importe)}</strong>
      </li>
    `)
    .join('');
}

export function render(container) {
  container.innerHTML = `
    <ion-page class="cuenta">
      <ion-content class="pantalla-lista" scroll-y="false">

        <div data-header></div>

        <main class="cuenta__contenido pantalla-lista__cuerpo">

          <div class="cuenta__cargando">
            <ion-spinner name="crescent" aria-hidden="true"></ion-spinner>
            <span>Preparando tu cuenta…</span>
          </div>

          <section class="cuenta__detalle" hidden>
            <h2 class="cuenta__titulo-detalle">Tu consumo</h2>
            <ul class="cuenta__items"></ul>
            <dl class="cuenta__totales">
              <div class="cuenta__linea">
                <dt>Subtotal</dt>
                <dd data-subtotal></dd>
              </div>
              <div class="cuenta__linea cuenta__linea--descuento" data-linea-descuento hidden>
                <dt>Descuento por juegos (<span data-descuento-pct></span>%)</dt>
                <dd data-descuento></dd>
              </div>
              <div class="cuenta__linea" data-linea-propina hidden>
                <dt>Propina (<span data-propina-pct></span>%)</dt>
                <dd data-propina></dd>
              </div>
            </dl>
          </section>

          <footer class="cuenta__pie" hidden>

            <!-- Estado 1 -->
            <section class="cuenta__paso" data-paso="propina" hidden></section>

            <!-- Estado 2 -->
            <section class="cuenta__paso cuenta__paso--total" data-paso="total" hidden>
              <p class="cuenta__nivel" data-nivel></p>
              <p class="cuenta__total-etiqueta">Total a abonar</p>
              <strong class="cuenta__total" data-total></strong>
              <button type="button" class="cuenta__pagar">Pagar</button>
            </section>

            <!-- Estado 3 -->
            <section class="cuenta__paso cuenta__paso--esperando" data-paso="esperando" role="status" aria-live="polite" hidden>
              <ion-spinner class="cuenta__esperando-spinner" name="crescent" aria-hidden="true"></ion-spinner>
              <span class="cuenta__esperando-texto"></span>
            </section>

          </footer>

          <p class="cuenta__vacio" hidden></p>

        </main>

      </ion-content>
    </ion-page>
  `;

  const cargando = container.querySelector('.cuenta__cargando');
  const detalle = container.querySelector('.cuenta__detalle');
  const listaItems = container.querySelector('.cuenta__items');
  const pie = container.querySelector('.cuenta__pie');
  const vacio = container.querySelector('.cuenta__vacio');
  const pasos = {
    propina: container.querySelector('[data-paso="propina"]'),
    total: container.querySelector('[data-paso="total"]'),
    esperando: container.querySelector('[data-paso="esperando"]'),
  };
  const esperandoSpinner = container.querySelector('.cuenta__esperando-spinner');
  const esperandoTexto = container.querySelector('.cuenta__esperando-texto');
  const botonPagar = container.querySelector('.cuenta__pagar');

  container.querySelector('[data-header]').append(crearAppHeader({
    titulo: 'Tu cuenta',
    etiquetaVolver: 'Volver a mi pedido',
    onVolver: () => navegarA('/pedidos/estado'),
  }));

  let estadia = null;
  let cuenta = null;
  let desuscribir = null;
  // Punto 22: evita repetir el toast/redirección si pintarPaso() se vuelve a
  // llamar mientras ya está confirmada (p.ej. otro UPDATE de la suscripción).
  let avisoConfirmacionMostrado = false;

  const lector = crearLectorQr({
    titulo: 'Para conocer el total, escaneá el QR de propina',
    descripcion: 'Está en tu mesa. Al leerlo vas a ver cuánto tenés que abonar.',
    textoBoton: 'Escanear QR de propina',
    nombreObjeto: 'QR de propina',
    onLectura: (contenido) => procesarQrPropina(contenido),
  });
  pasos.propina.append(lector.elemento);

  function mostrarVacio(mensaje) {
    cargando.hidden = true;
    detalle.hidden = true;
    pie.hidden = true;
    vacio.hidden = false;
    vacio.textContent = mensaje;
  }

  function pintarDetalle(items) {
    listaItems.innerHTML = plantillaItems(items);
    listaItems.scrollTop = 0;
  }

  // Los importes salen de la cuenta guardada, no de una cuenta recalculada acá:
  // `total` es una columna generada por la base y `descuento_pct` lo dejó el
  // trigger de los juegos (punto 15). Lo único que se deriva en pantalla son
  // los dos importes intermedios, para poder mostrarlos como líneas aparte.
  function pintarTotales() {
    const subtotal = Number(cuenta.subtotal);
    const descuentoPct = Number(cuenta.descuento_pct);
    const propinaPct = Number(cuenta.propina_pct);

    container.querySelector('[data-subtotal]').textContent = formatearMoneda(subtotal);

    const lineaDescuento = container.querySelector('[data-linea-descuento]');
    lineaDescuento.hidden = !(descuentoPct > 0);
    if (descuentoPct > 0) {
      container.querySelector('[data-descuento-pct]').textContent = descuentoPct;
      container.querySelector('[data-descuento]').textContent = `- ${formatearMoneda(subtotal * descuentoPct / 100)}`;
    }

    const lineaPropina = container.querySelector('[data-linea-propina]');
    const hayPropina = Boolean(cuenta.nivel);
    lineaPropina.hidden = !hayPropina;
    if (hayPropina) {
      const conDescuento = subtotal * (1 - descuentoPct / 100);
      container.querySelector('[data-propina-pct]').textContent = propinaPct;
      container.querySelector('[data-propina]').textContent = formatearMoneda(Number(cuenta.total) - conDescuento);
    }
  }

  function pintarPaso() {
    cargando.hidden = true;
    vacio.hidden = true;
    detalle.hidden = false;
    pie.hidden = false;

    const pagada = cuenta.estado !== ESTADOS_CUENTA.PENDIENTE;
    const confirmada = cuenta.estado === ESTADOS_CUENTA.CONFIRMADA;
    // Sin nivel de propina no hay total que mostrar: es la regla del punto 21,
    // y la base la sostiene con ck_propina_obligatoria.
    const hayPropina = Boolean(cuenta.nivel);

    pasos.propina.hidden = pagada || hayPropina;
    pasos.total.hidden = pagada || !hayPropina;
    pasos.esperando.hidden = !pagada;

    if (hayPropina && !pagada) {
      container.querySelector('[data-nivel]').textContent = `${cuenta.nivel.etiqueta} — ${Number(cuenta.nivel.porcentaje)}% de propina`;
      container.querySelector('[data-total]').textContent = formatearMoneda(Number(cuenta.total));
      botonPagar.disabled = false;
    }

    if (pagada) {
      // El paso 3 es pasivo: una vez pagado no hay nada que cancelar desde acá.
      // Que la cuenta pase a 'confirmada' es del punto 22; cuando exista, llega
      // por la suscripción de abajo y sólo cambia este texto.
      esperandoSpinner.hidden = confirmada;
      esperandoTexto.textContent = confirmada
        ? '¡Listo! El mozo confirmó tu pago. Gracias por tu visita.'
        : 'Esperando la confirmación del mozo…';

      // La visita terminó acá: se avisa con un toast y, unos segundos después
      // -para que le dé tiempo a leerlo-, se lo manda al inicio como a
      // cualquier cliente registrado (no hay nada más para hacer en esta
      // pantalla ni sesión que cerrar, sea anónimo o no).
      if (confirmada && !avisoConfirmacionMostrado) {
        avisoConfirmacionMostrado = true;
        mostrarToastNormal('¡Pago confirmado! Gracias por tu visita.');
        setTimeout(() => {
          if (container.isConnected) reemplazarRuta('/home');
        }, 3000);
      }
    }
  }

  async function procesarQrPropina(contenido) {
    lector.establecerBloqueado(true);
    try {
      const nivel = await validarQrPropina(contenido);
      if (!nivel) {
        lector.mostrarError('Ese código no corresponde a ningún nivel de propina. Probá con el QR de tu mesa.');
        return;
      }
      cuenta = await aplicarPropina(estadia.id, nivel);
      pintarTotales();
      pintarPaso();
    } catch (error) {
      lector.mostrarError(`No se pudo registrar la propina: ${error.message ?? 'error desconocido'}`);
    } finally {
      lector.establecerBloqueado(false);
    }
  }

  async function pagar() {
    botonPagar.disabled = true;
    try {
      cuenta = await pagarCuenta(estadia.id);
      pintarPaso();
    } catch (error) {
      mostrarToastError(`No se pudo registrar el pago: ${error.message ?? 'error desconocido'}`);
      botonPagar.disabled = false;
    }
  }

  botonPagar.addEventListener('click', () => void pagar());

  async function cargar() {
    try {
      const resumen = await obtenerResumenCuenta();
      if (!container.isConnected) return;

      if (!resumen) {
        mostrarVacio('No encontramos una mesa abierta a tu nombre. Pedí la cuenta desde la pantalla de tu pedido.');
        return;
      }

      estadia = resumen.estadia;
      // Red de seguridad: lo normal es que la cuenta ya exista, porque la crea
      // el botón "Pedir la cuenta" del punto 19 antes de navegar hasta acá.
      // Si el cliente entró directo (recarga, notificación, historial), se crea
      // ahora. solicitarCuenta es idempotente, así que no duplica ni reavisa.
      cuenta = resumen.cuenta ?? (await solicitarCuenta()).cuenta;
      if (!container.isConnected) return;

      pintarDetalle(resumen.items);
      pintarTotales();
      pintarPaso();

      desuscribir?.();
      desuscribir = suscribirseAMiCuenta(estadia.id, (fila) => {
        cuenta = { ...cuenta, ...fila };
        if (container.isConnected) pintarPaso();
      });
    } catch (error) {
      if (!container.isConnected) return;
      mostrarVacio(`No se pudo preparar tu cuenta: ${error.message ?? 'error desconocido'}`);
    }
  }

  void cargar();

  window.addEventListener('hashchange', () => {
    desuscribir?.();
  }, { once: true });
}
