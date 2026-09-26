import './index.css';
import { crearAppHeader } from '../../../components/app-header/app-header.js';
import { ajustarVista } from '../../../components/lista-ajustada/lista-ajustada.js';
import { formatearMoneda } from '../../../utils/formato.js';
import { navegarA } from '../../../router.js';
import { mostrarToastNormal } from '../../../components/toast-normal/toast-normal.js';
import { ESTADOS_PEDIDO } from '../../../config/constantes.js';
import { precargarCarritoDesdePedido } from '../../../utils/carrito-desde-pedido.js';
import { obtenerMiPedidoEnCurso, suscribirseAMiPedido } from '../../../services/pedidos.service.js';

const icono = (contenido) => `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${contenido}</svg>
`;

// Subtotal con el precio congelado al hacer el pedido (precio_unitario); el
// precio actual del producto queda sólo como respaldo.
function subtotalItem(item) {
  return item.cantidad * Number(item.precio_unitario ?? item.productos?.precio ?? 0);
}

export function render(container) {
  container.innerHTML = `
    <ion-page class="pedido-aceptado">
      <ion-content scroll-y="false">
        <div data-header></div>
        <main class="pedido-aceptado__contenido">
          <section class="pedido-aceptado__hero">
            <p>El mozo ya tomó tu pedido.</p>
            <p>Mientras lo preparamos, podés jugar o seguir su estado.</p>
          </section>

          <nav class="pedido-aceptado__atajos" aria-label="Acciones del pedido">
            <button type="button" data-ruta="/juegos">
              ${icono('<path d="M8 8h8a5 5 0 0 1 4.7 6.7l-1 3a2 2 0 0 1-3.4.7L14.8 17H9.2l-1.5 1.4a2 2 0 0 1-3.4-.7l-1-3A5 5 0 0 1 8 8z"/><path d="M8 11v4M6 13h4M16 12h.01M18 14h.01"/>')}
              <strong>Juegos<br>y descuentos</strong>
            </button>
            <button type="button" data-ruta="/pedidos/estado">
              ${icono('<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 4.5V3h6v1.5M9 9h6M9 13h6M9 17h4"/>')}
              <strong>Estado<br>de tu pedido</strong>
            </button>
          </nav>

          <section class="pedido-aceptado__resumen" aria-labelledby="titulo-pedido">
            <header>
              <h2 id="titulo-pedido">${icono('<path d="M6 8h12l-1 11H7zM9 8V6a3 3 0 0 1 6 0v2"/>')} Tu pedido</h2>
              <span data-mesa></span>
            </header>
            <ul data-items aria-busy="true">
              <li class="pedido-aceptado__aviso">Cargando tu pedido…</li>
            </ul>
            <footer><span>Total parcial</span><strong data-total>—</strong></footer>

            <aside class="pedido-aceptado__beneficio">
              <span aria-hidden="true">%</span>
              <p><strong>Jugá y podés obtener un descuento en tu cuenta final.</strong><br>Solo el primer descuento ganado se aplica y no es acumulable.</p>
            </aside>

            <button type="button" class="pedido-aceptado__carta" data-ruta="/mesa/carta">
              ${icono('<path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c3 2 4 5 4 8h-4"/>')}
              Seguir en la carta
            </button>
          </section>
        </main>
      </ion-content>
    </ion-page>
  `;

  container.querySelector('[data-header]').append(crearAppHeader({
    titulo: 'Pedido aceptado',
    etiquetaVolver: 'Volver a la carta',
    onVolver: () => navegarA('/mesa/carta'),
  }));

  container.querySelectorAll('[data-ruta]').forEach((boton) => {
    boton.addEventListener('click', () => navegarA(boton.dataset.ruta));
  });

  const ajusteVista = ajustarVista(container.querySelector('.pedido-aceptado__contenido'), {
    variable: '--pa-ajuste',
    minimo: 0.88,
    maximo: 1.16,
  });

  const textoMesa = container.querySelector('[data-mesa]');
  const listaItems = container.querySelector('[data-items]');
  const textoTotal = container.querySelector('[data-total]');

  // Antes esta pantalla mostraba un pedido de demostración fijo (mesa 1,
  // albóndigas): ahora pinta el pedido real de la estadía del cliente.
  function mostrarAviso(texto) {
    const aviso = document.createElement('li');
    aviso.className = 'pedido-aceptado__aviso';
    aviso.textContent = texto;
    listaItems.replaceChildren(aviso);
  }

  function pintarPedido(pedido) {
    listaItems.removeAttribute('aria-busy');
    const numeroMesa = pedido?.estadias?.mesas?.numero;
    textoMesa.textContent = numeroMesa ? `Mesa ${numeroMesa}` : '';

    const items = pedido?.pedido_items ?? [];
    if (!items.length) {
      mostrarAviso('Todavía no tenés un pedido en curso.');
      textoTotal.textContent = formatearMoneda(0);
      ajusteVista.actualizar();
      return;
    }

    // Con textContent: los nombres de producto los cargan los empleados.
    listaItems.replaceChildren(...items.map((item) => {
      const fila = document.createElement('li');
      const cantidad = document.createElement('span');
      cantidad.className = 'pedido-aceptado__cantidad';
      cantidad.textContent = item.cantidad;
      const nombre = document.createElement('span');
      nombre.textContent = item.productos?.nombre ?? 'Producto';
      const subtotal = document.createElement('strong');
      subtotal.textContent = formatearMoneda(subtotalItem(item));
      fila.append(cantidad, nombre, subtotal);
      return fila;
    }));
    textoTotal.textContent = formatearMoneda(items.reduce((suma, item) => suma + subtotalItem(item), 0));
    ajusteVista.actualizar();
  }

  // Punto 13: esta pantalla es la primera parada del cliente registrado
  // apenas confirma (ver ROLES_POR_RUTA['/pedidos/aceptado']); si el mozo
  // rechaza mientras sigue acá -no tiene por qué haberse ido a "Estado de tu
  // pedido"-, lo mandamos de vuelta a la carta con el carrito ya cargado con
  // lo que había pedido, en vez de dejarlo mirando un pedido que ya no existe.
  let desuscribirRechazo = null;
  let redirigiendoPorRechazo = false;

  function reaccionarSiRechazado(pedido) {
    if (!pedido || pedido.estado !== ESTADOS_PEDIDO.RECHAZADO || redirigiendoPorRechazo) return;
    redirigiendoPorRechazo = true;
    desuscribirRechazo?.();
    precargarCarritoDesdePedido(pedido);
    mostrarToastNormal('El mozo rechazó tu pedido. Modificalo y volvé a enviarlo.');
    navegarA('/mesa/carta');
  }

  obtenerMiPedidoEnCurso()
    .then((pedido) => {
      if (!container.isConnected || redirigiendoPorRechazo) return;
      if (pedido?.estado === ESTADOS_PEDIDO.RECHAZADO) {
        reaccionarSiRechazado(pedido);
        return;
      }
      pintarPedido(pedido);
      if (pedido) {
        desuscribirRechazo = suscribirseAMiPedido(pedido.id, async () => {
          const actualizado = await obtenerMiPedidoEnCurso().catch(() => null);
          if (container.isConnected && actualizado?.id === pedido.id) reaccionarSiRechazado(actualizado);
        });
      }
    })
    .catch(() => {
      // La vigilancia del rechazo es un accesorio; sólo se avisa que el
      // resumen no se pudo cargar, sin romper los atajos de la pantalla.
      if (!container.isConnected) return;
      listaItems.removeAttribute('aria-busy');
      mostrarAviso('No se pudo cargar tu pedido. Lo podés ver en "Estado de tu pedido".');
    });

  window.addEventListener('hashchange', () => {
    ajusteVista.destruir();
    desuscribirRechazo?.();
  }, { once: true });
}
