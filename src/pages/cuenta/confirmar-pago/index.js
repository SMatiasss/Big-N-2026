// Punto 22 (lado mozo): confirmar el pago y liberar la mesa.
//
// Dos pestañas, porque al mozo le sirven las dos mitades del punto 21:
//   "Por confirmar" -> el cliente ya pagó y espera que el mozo lo confirme.
//                      Es la acción del punto 22.
//   "Sin pagar"     -> pidió la cuenta pero todavía no pagó. Sólo informativo:
//                      acá no hay nada para tocar.
//
// Liberar la mesa no se hace desde esta pantalla: al pasar la cuenta a
// 'confirmada' lo resuelve el trigger trg_cerrar_estadia (cierra la estadía y
// deja la mesa 'libre' en la misma operación). Ver cuentas.service.js.
import './index.css';
import { ajustarLista } from '../../../components/lista-ajustada/lista-ajustada.js';
import { crearAppHeader } from '../../../components/app-header/app-header.js';
import { crearPestanas } from '../../../components/pestanas-filtro/pestanas-filtro.js';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { mostrarToastNormal } from '../../../components/toast-normal/toast-normal.js';
import { ESTADOS_CUENTA } from '../../../config/constantes.js';
import {
  confirmarPago,
  listarCuentasDelSalon,
  suscribirseACuentasDelSalon,
} from '../../../services/cuentas.service.js';
import { formatearMoneda } from '../../../utils/formato.js';
import { navegarA } from '../../../router.js';

const FILTROS = {
  POR_CONFIRMAR: 'por-confirmar',
  SIN_PAGAR: 'sin-pagar',
};

function estaPagada(cuenta) {
  return cuenta.estado === ESTADOS_CUENTA.PAGADA;
}

function formatearHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function nombreCliente(cuenta) {
  const cliente = cuenta.estadias?.cliente;
  if (!cliente) return 'Cliente';
  return [cliente.nombres, cliente.apellidos].filter(Boolean).join(' ').trim() || 'Cliente';
}

function plantillaCuenta(cuenta) {
  const pagada = estaPagada(cuenta);
  const mesa = cuenta.estadias?.mesas?.numero ?? '?';
  const subtotal = Number(cuenta.subtotal);
  const descuentoPct = Number(cuenta.descuento_pct);
  const propinaPct = Number(cuenta.propina_pct);

  // Las mismas líneas que ve el cliente en su cuenta (punto 21), para que los
  // dos estén mirando exactamente el mismo número.
  const lineas = [
    `<li><span>Subtotal</span><span>${formatearMoneda(subtotal)}</span></li>`,
    descuentoPct > 0
      ? `<li class="cobro__linea--descuento"><span>Descuento juegos (${descuentoPct}%)</span><span>- ${formatearMoneda(subtotal * descuentoPct / 100)}</span></li>`
      : '',
    cuenta.nivel
      ? `<li><span>Propina ${cuenta.nivel.etiqueta} (${propinaPct}%)</span><span>${formatearMoneda(Number(cuenta.total) - subtotal * (1 - descuentoPct / 100))}</span></li>`
      : '<li class="cobro__linea--falta"><span>Propina</span><span>sin elegir</span></li>',
  ].join('');

  const momento = pagada
    ? `Pagó a las ${formatearHora(cuenta.pagada_en)}`
    : `Pidió la cuenta a las ${formatearHora(cuenta.solicitada_en)}`;

  return `
    <li class="cobro ${pagada ? 'cobro--pagada' : ''}" data-estadia="${cuenta.estadia_id}">

      <div class="cobro__cabecera">
        <h2 class="cobro__mesa">Mesa ${mesa}</h2>
        <span class="cobro__estado ${pagada ? 'cobro__estado--pagada' : ''}">
          ${pagada ? 'Pagada' : 'Sin pagar'}
        </span>
      </div>

      <p class="cobro__datos">${nombreCliente(cuenta)} · ${momento}</p>

      <ul class="cobro__lineas">${lineas}</ul>

      <p class="cobro__total">
        <span class="cobro__total-etiqueta">Total</span>
        <strong>${formatearMoneda(Number(cuenta.total))}</strong>
      </p>

      <button type="button" class="cobro__accion" ${pagada ? '' : 'disabled'}>
        ${pagada ? 'Confirmar pago y liberar la mesa' : 'El cliente todavía no pagó'}
      </button>

    </li>
  `;
}

export function render(container) {
  container.innerHTML = `
    <ion-page class="confirmar-pago">
      <ion-content class="pantalla-lista" scroll-y="false">

        <div data-header></div>

        <main class="confirmar-pago__contenido pantalla-lista__cuerpo">

          <div data-pestanas></div>

          <div class="confirmar-pago__estado-carga">
            <ion-spinner name="crescent" aria-hidden="true"></ion-spinner>
            <span>Cargando cuentas...</span>
          </div>

          <ul class="confirmar-pago__lista lista-ajustada" aria-live="polite" hidden></ul>

          <p class="confirmar-pago__mensaje" hidden></p>

        </main>

      </ion-content>
    </ion-page>
  `;

  const estadoCarga = container.querySelector('.confirmar-pago__estado-carga');
  const lista = container.querySelector('.confirmar-pago__lista');
  const mensaje = container.querySelector('.confirmar-pago__mensaje');

  const ajusteLista = ajustarLista(lista);

  container.querySelector('[data-header]').append(crearAppHeader({
    titulo: 'Cobrar mesas',
    etiquetaVolver: 'Volver al inicio',
    onVolver: () => navegarA('/home'),
  }));

  let filtro = FILTROS.POR_CONFIRMAR;
  let cuentas = [];

  const pestanas = crearPestanas({
    etiqueta: 'Filtrar cuentas',
    opciones: [
      { valor: FILTROS.POR_CONFIRMAR, texto: 'Por confirmar' },
      { valor: FILTROS.SIN_PAGAR, texto: 'Sin pagar' },
    ],
    seleccionInicial: filtro,
    onCambio: (valor) => {
      filtro = valor;
      pintar();
    },
  });
  container.querySelector('[data-pestanas]').append(pestanas.elemento);

  function cuentasVisibles() {
    return filtro === FILTROS.POR_CONFIRMAR
      ? cuentas.filter(estaPagada)
      : cuentas.filter((cuenta) => !estaPagada(cuenta));
  }

  async function confirmar(estadiaId, boton) {
    boton.disabled = true;
    try {
      await confirmarPago(estadiaId);
      mostrarToastNormal('Pago confirmado. La mesa quedó libre.');
      await cargar();
    } catch (error) {
      mostrarToastError(`No se pudo confirmar el pago: ${error.message ?? 'error desconocido'}`);
      boton.disabled = false;
    }
  }

  function pintar() {
    const visibles = cuentasVisibles();
    estadoCarga.hidden = true;

    if (!visibles.length) {
      lista.hidden = true;
      mensaje.hidden = false;
      mensaje.textContent = filtro === FILTROS.POR_CONFIRMAR
        ? 'No hay pagos esperando confirmación.'
        : 'No hay cuentas pedidas sin pagar.';
      return;
    }

    mensaje.hidden = true;
    lista.hidden = false;
    lista.innerHTML = visibles.map(plantillaCuenta).join('');

    lista.querySelectorAll('.cobro').forEach((fila) => {
      const boton = fila.querySelector('.cobro__accion');
      if (boton.disabled) return;
      boton.addEventListener('click', () => void confirmar(fila.dataset.estadia, boton));
    });

    ajusteLista.actualizar();
  }

  async function cargar() {
    try {
      cuentas = await listarCuentasDelSalon();
      if (!lista.isConnected) return;
      pintar();
    } catch (error) {
      if (!lista.isConnected) return;
      estadoCarga.hidden = true;
      lista.hidden = true;
      mensaje.hidden = false;
      mensaje.textContent = `No se pudieron cargar las cuentas: ${error.message ?? 'error desconocido'}`;
    }
  }

  void cargar();

  // Que un cliente pague se ve solo, sin que el mozo tenga que recargar.
  const pagosAvisados = new Set();

  const desuscribir = suscribirseACuentasDelSalon((cuenta) => {
    if (cuenta?.estado === ESTADOS_CUENTA.PAGADA && !pagosAvisados.has(cuenta.id)) {
      pagosAvisados.add(cuenta.id);
      mostrarToastNormal('Una mesa acaba de pagar. Confirmá el pago para liberarla.');
    }
    void cargar();
  });

  window.addEventListener('hashchange', () => {
    desuscribir();
    ajusteLista.destruir();
  }, { once: true });
}
