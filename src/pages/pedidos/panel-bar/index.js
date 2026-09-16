import { listarPedidosPorSector } from '../../../services/pedidos.service.js';
import { crearActualizacionHu11 } from '../../../utils/actualizacion-hu11.js';
import { navegarA } from '../../../router.js';
import { crearAppHeader } from '../../../components/app-header/app-header.js';

export async function render(container) {
  container.innerHTML = `
    <ion-content class="panel-sector">
      <div data-header></div>
      <main class="panel-sector__main" style="padding: 1rem;">
        <p role="status"></p>
        <div class="panel-sector__lista" aria-live="polite"></div>
      </main>
    </ion-content>
  `;

  const raiz = container.firstElementChild;
  const aviso = raiz.querySelector('[role="status"]');
  const lista = raiz.querySelector('.panel-sector__lista');

  const header = crearAppHeader({
    titulo: 'Bar - Pedidos',
    onVolver: () => navegarA('/home'),
  });
  raiz.querySelector('[data-header]').append(header);

  const actualizacion = crearActualizacionHu11(raiz, async vigente => {
    let pedidos;
    try {
      pedidos = await listarPedidosPorSector('bar');
    } catch (err) {
      if (vigente()) aviso.textContent = 'Error al cargar pedidos: ' + err.message;
      return;
    }
    
    if (!vigente()) return;

    if (pedidos.length === 0) {
      lista.innerHTML = '<p class="panel-sector__vacio">No hay pedidos pendientes para este sector.</p>';
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
      tarjeta.style.marginBottom = '1rem';
      tarjeta.style.padding = '1rem';
      tarjeta.style.border = '1px solid #ccc';
      tarjeta.style.borderRadius = '8px';
      
      const mesaNumero = pedido.estadias?.mesas?.numero || '?';
      const fecha = new Date(pedido.creado_en);
      const horaMinutos = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const itemsHtml = pedido.pedido_items.map(item => 
        `<li style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
          <span>${item.cantidad}x ${item.productos?.nombre}</span>
        </li>`
      ).join('');

      tarjeta.innerHTML = `
        <div class="pedido-card__header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid #eee; padding-bottom:0.5rem;">
          <h3 style="margin:0;">Mesa ${mesaNumero}</h3>
          <span style="color:#666; font-size:0.9rem;">${horaMinutos}</span>
        </div>
        <div class="pedido-card__cuerpo">
          <ul style="list-style:none;padding:0;">${itemsHtml}</ul>
        </div>
      `;
      
      lista.appendChild(tarjeta);
    }
  });

  actualizacion.actualizar();
  const intervaloFrecuente = setInterval(() => {
    if (raiz.isConnected) actualizacion.actualizar();
  }, 5000);
  actualizacion.alSalir(() => clearInterval(intervaloFrecuente));
}
