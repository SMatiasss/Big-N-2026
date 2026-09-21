import './index.css';
import { listarPedidosPendientes, confirmarPedido, rechazarPedido } from '../../../services/pedidos.service.js';
import { avisarSectoresPedido, avisarPedidoRechazado } from '../../../services/notificaciones.service.js';
import { crearActualizacionHu11 } from '../../../utils/actualizacion-hu11.js';
import { navegarA } from '../../../router.js';
import { crearAppHeader } from '../../../components/app-header/app-header.js';

export async function render(container) {
  container.innerHTML = `
    <ion-content class="confirmacion-mozo">
      <div data-header></div>
      <main class="confirmacion-mozo__main">
        <p role="status"></p>
        <div class="confirmacion-mozo__lista" aria-live="polite"></div>
      </main>
    </ion-content>
  `;

  const raiz = container.firstElementChild;
  const aviso = raiz.querySelector('[role="status"]');
  const lista = raiz.querySelector('.confirmacion-mozo__lista');

  const header = crearAppHeader({
    titulo: 'Confirmar pedidos',
    onVolver: () => navegarA('/home'),
    // Puntos 18 y 19: desde acá se llega al listado de pedidos completos
    // para entregar (la tarjeta "Pedidos" del home entra por esta pantalla).
    accion: {
      texto: '›',
      etiqueta: 'Ir a entregar pedidos',
      onClick: () => navegarA('/pedidos/entrega'),
    },
  });
  raiz.querySelector('[data-header]').append(header);

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
      lista.innerHTML = `<section class="confirmacion-mozo__vacio">
        <span class="confirmacion-mozo__vacio-icono" aria-hidden="true">✓</span>
        <strong>Todo al día</strong>
        <p>No hay pedidos pendientes de confirmación.</p>
        <small>Los nuevos pedidos aparecerán automáticamente.</small>
      </section>`;
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
          // 14. Avisar a los sectores correspondientes (cocina y bar)
          await avisarSectoresPedido(pedido.id).catch(e => console.error('No se pudo enviar push a sectores', e));
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
          // Punto 13: sin motivo. El pedido no se borra (queda en 'rechazado',
          // ver 03_baja_logica.sql); el cliente lo ve en su pantalla de "Mi
          // pedido" con un botón para modificarlo y reenviarlo.
          await rechazarPedido(pedido.id);
          await avisarPedidoRechazado(pedido.id).catch((e) => console.error('No se pudo enviar push de rechazo al cliente', e));
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
