import './index.css';
import { listarPedidosPorSector, marcarSectorListo } from '../../../services/pedidos.service.js';
import { avisarPedidoListo } from '../../../services/notificaciones.service.js';
import { ajustarLista } from '../../../components/lista-ajustada/lista-ajustada.js';
import { crearActualizacionHu11 } from '../../../utils/actualizacion-hu11.js';
import { navegarA } from '../../../router.js';
import { crearAppHeader } from '../../../components/app-header/app-header.js';

export async function render(container) {
  container.innerHTML = `
    <ion-content class="panel-sector pantalla-lista" scroll-y="false">
      <div data-header></div>
      <main class="panel-sector__main pantalla-lista__cuerpo">
        <p role="status"></p>
        <div class="panel-sector__lista lista-ajustada" aria-live="polite"><div class="carga-lista" role="status"><ion-spinner name="crescent" aria-hidden="true"></ion-spinner><span>Cargando pedidos…</span></div></div>
      </main>
    </ion-content>
  `;

  const raiz = container.firstElementChild;
  const aviso = raiz.querySelector('[role="status"]');
  const lista = raiz.querySelector('.panel-sector__lista');

  const header = crearAppHeader({
    titulo: 'Cocina - Pedidos',
    onVolver: () => navegarA('/home'),
  });
  raiz.querySelector('[data-header]').append(header);

  const ajusteLista = ajustarLista(lista, { paddingInferior: 12 });

  const actualizacion = crearActualizacionHu11(raiz, async vigente => {
    let pedidos;
    try {
      pedidos = await listarPedidosPorSector('cocina');
    } catch (err) {
      if (vigente()) {
        aviso.textContent = 'Error al cargar pedidos: ' + err.message;
        lista.querySelector('.carga-lista')?.remove();
      }
      return;
    }
    
    if (!vigente()) return;

    if (pedidos.length === 0) {
      lista.innerHTML = `<section class="panel-sector__vacio">
        <span class="panel-sector__vacio-icono" aria-hidden="true">✓</span>
        <strong>Sector al día</strong>
        <p>No hay pedidos pendientes para preparar.</p>
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
      const fecha = new Date(pedido.creado_en);
      const horaMinutos = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const itemsHtml = pedido.pedido_items.map(item => 
        `<li>${item.cantidad}x ${item.productos?.nombre}</li>`
      ).join('');

      tarjeta.innerHTML = `
        <div class="pedido-card__header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3>Mesa ${mesaNumero}</h3>
          <span style="color:var(--texto-claro); font-size:1rem;">${horaMinutos}</span>
        </div>
        <div class="pedido-card__cuerpo">
          <ul>${itemsHtml}</ul>
        </div>
        <div class="pedido-card__controles">
          <button type="button" class="btn-aceptar" aria-label="Marcar como listo">✅</button>
        </div>
      `;

      // Punto 18: la cocina avisa que terminó su parte. Si con esto el pedido
      // queda completo (el trigger trg_estado_pedido lo pasa a 'listo'), se le
      // avisa al mozo para que lo entregue. avisar-pedido-listo revalida el
      // estado en el servidor, así que si todavía falta el bar no manda nada.
      const btnListo = tarjeta.querySelector('.btn-aceptar');
      btnListo.onclick = async () => {
        btnListo.disabled = true;
        try {
          await marcarSectorListo(pedido.id, 'cocina');
          try {
            await avisarPedidoListo(pedido.id);
          } catch (err) {
            console.warn('El pedido quedó listo pero no se pudo enviar el push al mozo:', err);
          }
          actualizacion.actualizar();
        } catch (err) {
          aviso.textContent = 'No se pudo marcar como listo: ' + err.message;
          btnListo.disabled = false;
        }
      };

      lista.appendChild(tarjeta);
    }
    
    ajusteLista.actualizar();
  });

  actualizacion.actualizar();
  const intervaloFrecuente = setInterval(() => {
    if (raiz.isConnected) actualizacion.actualizar();
  }, 5000);
  actualizacion.alSalir(() => {
    clearInterval(intervaloFrecuente);
    ajusteLista.destruir();
  });
}
