import './index.css';
import { listarPedidosPendientes, confirmarPedido, rechazarPedido } from '../../../services/pedidos.service.js';
import { crearActualizacionHu11 } from '../../../utils/actualizacion-hu11.js';
import { navegarA } from '../../../router.js';

export async function render(container) {
  container.innerHTML = `
    <ion-content class="confirmacion-mozo">
      <main class="confirmacion-mozo__main">
        <button type="button" class="btn-volver" data-volver>Volver</button>
        <h1>Confirmar Pedidos</h1>
        <p role="status"></p>
        <div class="confirmacion-mozo__lista" aria-live="polite"></div>
      </main>
    </ion-content>
  `;

  const raiz = container.firstElementChild;
  const aviso = raiz.querySelector('[role="status"]');
  const lista = raiz.querySelector('.confirmacion-mozo__lista');
  
  raiz.querySelector('[data-volver]').onclick = () => navegarA('/home');

  const actualizacion = crearActualizacionHu11(raiz, async vigente => {
    let pedidos;
    try {
      pedidos = await listarPedidosPendientes();
    } catch (err) {
      if (vigente()) aviso.textContent = 'Error al cargar pedidos: ' + err.message;
      return;
    }
    
    if (!vigente()) return;

    if (pedidos.length === 0) {
      lista.innerHTML = '<p class="confirmacion-mozo__vacio">No hay pedidos pendientes de confirmación.</p>';
      aviso.textContent = '';
      return;
    }

    const firma = JSON.stringify(pedidos);
    if (lista.dataset.firma === firma) return;
    lista.dataset.firma = firma;
    
    lista.replaceChildren();
    
    for (const pedido of pedidos) {
      const tarjeta = document.createElement('article');
      tarjeta.className = 'pedido-card';
      
      const mesaNumero = pedido.estadias?.mesas?.numero || '?';
      const clienteNombre = pedido.estadias?.cliente?.nombres + ' ' + pedido.estadias?.cliente?.apellidos;
      
      const itemsHtml = pedido.pedido_items.map(item => 
        `<li>${item.cantidad}x ${item.productos?.nombre || 'Producto'}</li>`
      ).join('');

      tarjeta.innerHTML = `
        <div class="pedido-card__header">
          <h3>Mesa ${mesaNumero}</h3>
          <p class="pedido-card__cliente">${clienteNombre}</p>
        </div>
        <div class="pedido-card__cuerpo">
          <ul>${itemsHtml}</ul>
        </div>
        <div class="pedido-card__controles">
          <button type="button" class="btn-rechazar" aria-label="Rechazar">❌</button>
          <button type="button" class="btn-aceptar" aria-label="Confirmar">✅</button>
        </div>
      `;
      
      const btnAceptar = tarjeta.querySelector('.btn-aceptar');
      const btnRechazar = tarjeta.querySelector('.btn-rechazar');
      
      btnAceptar.onclick = async () => {
        try {
          btnAceptar.disabled = true;
          btnRechazar.disabled = true;
          await confirmarPedido(pedido.id);
          actualizacion.actualizar();
        } catch (err) {
          aviso.textContent = 'Error al confirmar: ' + err.message;
          btnAceptar.disabled = false;
          btnRechazar.disabled = false;
        }
      };
      
      btnRechazar.onclick = async () => {
        try {
          btnAceptar.disabled = true;
          btnRechazar.disabled = true;
          // Según el punto 13, si el mozo rechaza podría haber un motivo de rechazo.
          // Por ahora solo lo rechazamos directamente.
          await rechazarPedido(pedido.id);
          actualizacion.actualizar();
        } catch (err) {
          aviso.textContent = 'Error al rechazar: ' + err.message;
          btnAceptar.disabled = false;
          btnRechazar.disabled = false;
        }
      };
      
      lista.appendChild(tarjeta);
    }
  });

  // Forzar la primera carga inmediatamente
  actualizacion.actualizar();

  // El actualizador global hace poll cada 30 segundos, pero para los pedidos
  // pendientes de confirmar queremos que sea más rápido (cada 5 segundos).
  const intervaloFrecuente = setInterval(() => {
    if (raiz.isConnected) actualizacion.actualizar();
  }, 5000);
  
  actualizacion.alSalir(() => clearInterval(intervaloFrecuente));
}
