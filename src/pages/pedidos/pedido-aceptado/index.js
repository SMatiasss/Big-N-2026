import './index.css';
import { crearAppHeader } from '../../../components/app-header/app-header.js';
import { ajustarVista } from '../../../components/lista-ajustada/lista-ajustada.js';
import { formatearMoneda } from '../../../utils/formato.js';
import { navegarA } from '../../../router.js';
import { mostrarToastNormal } from '../../../components/toast-normal/toast-normal.js';
import { ESTADOS_PEDIDO } from '../../../config/constantes.js';
import { precargarCarritoDesdePedido } from '../../../utils/carrito-desde-pedido.js';
import { obtenerMiPedidoEnCurso, suscribirseAMiPedido } from '../../../services/pedidos.service.js';

const PEDIDO_DEMO = {
  mesa: 1,
  items: [
    { cantidad: 1, nombre: 'Albóndigas', subtotal: 30000 },
    { cantidad: 2, nombre: 'Albóndiguitas', subtotal: 180000 },
  ],
};

const icono = (contenido) => `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${contenido}</svg>
`;

export function render(container) {
  const total = PEDIDO_DEMO.items.reduce((suma, item) => suma + item.subtotal, 0);

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

          <section class="pedido-aceptado__resumen" aria-labelledby="titulo-pedido-demo">
            <header>
              <h2 id="titulo-pedido-demo">${icono('<path d="M6 8h12l-1 11H7zM9 8V6a3 3 0 0 1 6 0v2"/>')} Tu pedido</h2>
              <span>Mesa ${PEDIDO_DEMO.mesa}</span>
            </header>
            <ul>
              ${PEDIDO_DEMO.items.map((item) => `
                <li>
                  <span class="pedido-aceptado__cantidad">${item.cantidad}</span>
                  <span>${item.nombre}</span>
                  <strong>${formatearMoneda(item.subtotal)}</strong>
                </li>`).join('')}
            </ul>
            <footer><span>Total parcial</span><strong>${formatearMoneda(total)}</strong></footer>

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
      if (pedido) {
        desuscribirRechazo = suscribirseAMiPedido(pedido.id, async () => {
          const actualizado = await obtenerMiPedidoEnCurso().catch(() => null);
          if (container.isConnected && actualizado?.id === pedido.id) reaccionarSiRechazado(actualizado);
        });
      }
    })
    .catch(() => {
      // Silencioso: esta vigilancia es un accesorio, no debe romper la pantalla.
    });

  window.addEventListener('hashchange', () => {
    ajusteVista.destruir();
    desuscribirRechazo?.();
  }, { once: true });
}
