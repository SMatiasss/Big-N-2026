// Puntos 18 y 19 (lado mozo).
//
// 18: el mozo ve cada parte del pedido en su listado de pedidos pendientes y
//     se le informa cuando el pedido está completo, es decir cuando TODOS los
//     sectores que intervienen terminaron lo suyo.
// 19: con el pedido completo, el mozo lo entrega en la mesa. La confirmación
//     de recepción la hace el cliente desde su propia pantalla
//     (pages/pedidos/estado-pedido).
import './index.css';
import { ajustarLista } from '../../../components/lista-ajustada/lista-ajustada.js';
import { crearAppHeader } from '../../../components/app-header/app-header.js';
import { crearPestanas } from '../../../components/pestanas-filtro/pestanas-filtro.js';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { mostrarToastNormal } from '../../../components/toast-normal/toast-normal.js';
import { ESTADOS_ITEM, ESTADOS_PEDIDO } from '../../../config/constantes.js';
import {
  listarPedidosEnCurso,
  marcarPedidoEntregado,
  suscribirseAPedidosEnCurso,
} from '../../../services/pedidos.service.js';
import { navegarA } from '../../../router.js';

const ETIQUETAS_SECTOR = {
  cocina: 'Cocina',
  bar: 'Bar',
};

// Las dos pestañas del listado. "Completos" es lo que el punto 18 pide
// destacar: los pedidos que ya se pueden entregar.
const FILTROS = {
  COMPLETOS: 'completos',
  PREPARANDO: 'preparando',
};

function formatearFecha(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function nombreCliente(pedido) {
  const cliente = pedido.estadias?.cliente;
  if (!cliente) return '';
  return [cliente.nombres, cliente.apellidos].filter(Boolean).join(' ').trim();
}

// Punto 18: el pedido se informa como completo sólo cuando TODOS los sectores
// intervinientes terminaron. Este resumen es lo que deja ver de un vistazo
// cuál falta ("la cocina ya está, falta el bar").
function resumirSectores(items = []) {
  const porSector = new Map();

  for (const item of items) {
    const resumen = porSector.get(item.sector) ?? { sector: item.sector, total: 0, listos: 0 };
    resumen.total += 1;
    if (item.estado === ESTADOS_ITEM.LISTO || item.estado === ESTADOS_ITEM.ENTREGADO) {
      resumen.listos += 1;
    }
    porSector.set(item.sector, resumen);
  }

  return [...porSector.values()];
}

function estaCompleto(pedido) {
  return pedido.estado === ESTADOS_PEDIDO.LISTO;
}

function plantillaPedido(pedido) {
  const completo = estaCompleto(pedido);
  const yaEntregado = Boolean(pedido.entregado_en);
  const mesa = pedido.estadias?.mesas?.numero ?? '?';
  const cliente = nombreCliente(pedido);

  const sectores = resumirSectores(pedido.pedido_items)
    .map((resumen) => {
      const listo = resumen.listos === resumen.total;
      return `
        <li class="sector-chip ${listo ? 'sector-chip--listo' : 'sector-chip--preparando'}">
          <span class="sector-chip__punto" aria-hidden="true"></span>
          ${ETIQUETAS_SECTOR[resumen.sector] ?? resumen.sector}
          <strong>${resumen.listos}/${resumen.total}</strong>
        </li>
      `;
    })
    .join('');

  const items = (pedido.pedido_items ?? [])
    .map((item) => {
      const listo = item.estado === ESTADOS_ITEM.LISTO || item.estado === ESTADOS_ITEM.ENTREGADO;
      return `
        <li class="pedido-entrega__item ${listo ? 'pedido-entrega__item--listo' : ''}">
          <span class="pedido-entrega__cantidad">${item.cantidad}×</span>
          <span class="pedido-entrega__producto">${item.productos?.nombre ?? 'Producto'}</span>
        </li>
      `;
    })
    .join('');

  let textoBoton = 'Entregar pedido';
  if (!completo) textoBoton = 'Falta terminar el pedido';
  if (yaEntregado) textoBoton = 'Esperando al cliente';

  return `
    <li class="pedido-entrega ${completo ? 'pedido-entrega--completo' : ''}" data-id="${pedido.id}">

      <div class="pedido-entrega__cabecera">
        <h2 class="pedido-entrega__mesa">Mesa ${mesa}</h2>
        <span class="pedido-entrega__estado ${completo ? 'pedido-entrega__estado--completo' : ''}">
          ${completo ? 'Completo' : 'En preparación'}
        </span>
      </div>

      <p class="pedido-entrega__datos">
        ${formatearFecha(pedido.creado_en)}${cliente ? ` · ${cliente}` : ''}
      </p>

      <ul class="pedido-entrega__sectores">${sectores}</ul>

      <ul class="pedido-entrega__items">${items}</ul>

      <button
        type="button"
        class="pedido-entrega__accion"
        ${completo && !yaEntregado ? '' : 'disabled'}
      >${textoBoton}</button>

    </li>
  `;
}

export function render(container) {
  container.innerHTML = `
    <ion-page class="entrega-pedido">
      <ion-content class="pantalla-lista" scroll-y="false">

        <div data-header></div>

        <main class="entrega-pedido__contenido pantalla-lista__cuerpo">

          <div data-pestanas></div>

          <div class="entrega-pedido__estado-carga">
            <ion-spinner name="crescent" aria-hidden="true"></ion-spinner>
            <span>Cargando pedidos...</span>
          </div>

          <ul class="entrega-pedido__lista lista-ajustada" aria-live="polite" hidden></ul>

          <p class="entrega-pedido__mensaje" hidden></p>

        </main>

      </ion-content>
    </ion-page>
  `;

  const estadoCarga = container.querySelector('.entrega-pedido__estado-carga');
  const lista = container.querySelector('.entrega-pedido__lista');
  const mensaje = container.querySelector('.entrega-pedido__mensaje');

  const ajusteLista = ajustarLista(lista);

  const header = crearAppHeader({
    titulo: 'Entregar pedidos',
    etiquetaVolver: 'Volver al inicio',
    onVolver: () => navegarA('/home'),
    accion: {
      texto: '✓',
      etiqueta: 'Ir a confirmar pedidos',
      onClick: () => navegarA('/pedidos/confirmacion'),
    },
  });
  container.querySelector('[data-header]').append(header);

  let filtro = FILTROS.COMPLETOS;
  let pedidos = [];

  const pestanas = crearPestanas({
    etiqueta: 'Filtrar pedidos',
    opciones: [
      { valor: FILTROS.COMPLETOS, texto: 'Completos' },
      { valor: FILTROS.PREPARANDO, texto: 'En preparación' },
    ],
    seleccionInicial: filtro,
    onCambio: (valor) => {
      filtro = valor;
      pintar();
    },
  });
  container.querySelector('[data-pestanas]').append(pestanas.elemento);

  function pedidosVisibles() {
    return filtro === FILTROS.COMPLETOS
      ? pedidos.filter(estaCompleto)
      : pedidos.filter((pedido) => !estaCompleto(pedido));
  }

  async function entregar(pedidoId, boton) {
    boton.disabled = true;
    try {
      await marcarPedidoEntregado(pedidoId);
      mostrarToastNormal('Pedido entregado. Falta que el cliente confirme la recepción.');
      await cargar();
    } catch (error) {
      mostrarToastError(`No se pudo marcar la entrega: ${error.message ?? 'error desconocido'}`);
      boton.disabled = false;
    }
  }

  function pintar() {
    const visibles = pedidosVisibles();
    estadoCarga.hidden = true;

    if (!visibles.length) {
      lista.hidden = true;
      mensaje.hidden = false;
      mensaje.textContent = filtro === FILTROS.COMPLETOS
        ? 'Todavía no hay pedidos completos para entregar.'
        : 'No hay pedidos en preparación.';
      return;
    }

    mensaje.hidden = true;
    lista.hidden = false;
    lista.innerHTML = visibles.map(plantillaPedido).join('');

    lista.querySelectorAll('.pedido-entrega').forEach((fila) => {
      const boton = fila.querySelector('.pedido-entrega__accion');
      if (boton.disabled) return;
      boton.addEventListener('click', () => entregar(fila.dataset.id, boton));
    });

    ajusteLista.actualizar();
  }

  async function cargar() {
    try {
      pedidos = await listarPedidosEnCurso();
      if (!lista.isConnected) return;
      pintar();
    } catch (error) {
      if (!lista.isConnected) return;
      estadoCarga.hidden = true;
      lista.hidden = true;
      mensaje.hidden = false;
      mensaje.textContent = `No se pudieron cargar los pedidos: ${error.message ?? 'error desconocido'}`;
    }
  }

  void cargar();

  // Punto 18: "se informe cuando el pedido esté completo". Con la app abierta
  // el aviso llega por realtime, sin esperar a que el mozo recargue: la cocina
  // o el bar marcan su parte y el trigger trg_estado_pedido deja el pedido en
  // 'listo', que es lo que se detecta acá.
  const completosAvisados = new Set();

  const desuscribir = suscribirseAPedidosEnCurso((pedido) => {
    if (pedido?.estado === ESTADOS_PEDIDO.LISTO && !completosAvisados.has(pedido.id)) {
      completosAvisados.add(pedido.id);
      mostrarToastNormal('Hay un pedido completo listo para entregar.');
    }
    void cargar();
  });

  window.addEventListener('hashchange', () => {
    desuscribir();
    ajusteLista.destruir();
  }, { once: true });
}
