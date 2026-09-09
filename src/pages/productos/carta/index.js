import './index.css';
import { listarCartaConFotos } from '../../../services/productos.service.js';
import { obtenerContextoMesa } from '../../../services/mesa-cliente.service.js';
import { crearCarruselImagenes } from '../../../components/carrusel-imagenes/carrusel-imagenes.js';
import { ordenarFotosProducto } from '../../../utils/hu11.js';
import { crearActualizacionHu11 } from '../../../utils/actualizacion-hu11.js';
import { navegarA } from '../../../router.js';

import './nuevos-estilos.css';
import { CarritoService } from '../../../services/carrito.service.js';
import { crearPedido } from '../../../services/pedidos.service.js';
import { avisarNuevoPedido } from '../../../services/notificaciones.service.js';

export async function render(container) {
  const operativa = location.hash.replace('#', '') === '/mesa/carta';
  container.innerHTML = `
    <ion-content class="hu11">
      <main class="hu11__main-espaciado">
        <button type="button" data-volver>Volver</button>
        <h1>Carta</h1>
        <p data-mesa></p>
        <div data-acciones class="hu11__acciones-contenedor"></div>
        <p role="status"></p>
        <div class="hu11__productos"></div>
      </main>
    </ion-content>
  `;
  const raiz = container.firstElementChild;
  const aviso = raiz.querySelector('[role="status"]');
  const lista = raiz.querySelector('.hu11__productos');
  const acciones = raiz.querySelector('[data-acciones]');
  raiz.querySelector('[data-volver]').onclick = () => navegarA(operativa ? '/lista-espera' : '/login');
  
  let carritoAbierto = false;
  const footerCarrito = document.createElement('div');
  footerCarrito.className = 'carrito-flotante';
  
  footerCarrito.innerHTML = `
    <div class="carrito-header">
      <h3>Tu Pedido (<span id="carrito-count">0</span>)</h3>
      <div class="carrito-header-total">
        <strong id="carrito-total-header">$0.00</strong>
        <span id="carrito-icon">▲</span>
      </div>
    </div>
    <div class="carrito-body">
      <div id="carrito-items" class="carrito-items"></div>
      <button id="btn-confirmar-pedido" class="btn-confirmar-pedido">Confirmar Pedido</button>
      <p id="carrito-status" class="carrito-status"></p>
    </div>
  `;

  if (operativa) {
    container.appendChild(footerCarrito);
  }

  const headerCarrito = footerCarrito.querySelector('.carrito-header');
  const bodyCarrito = footerCarrito.querySelector('.carrito-body');
  const iconCarrito = footerCarrito.querySelector('#carrito-icon');
  const itemsContainer = footerCarrito.querySelector('#carrito-items');
  const countSpan = footerCarrito.querySelector('#carrito-count');
  const totalHeader = footerCarrito.querySelector('#carrito-total-header');
  const btnConfirmar = footerCarrito.querySelector('#btn-confirmar-pedido');
  const statusCarrito = footerCarrito.querySelector('#carrito-status');

  headerCarrito.onclick = () => {
    carritoAbierto = !carritoAbierto;
    if (carritoAbierto) {
      footerCarrito.classList.add('carrito-flotante--abierto');
      bodyCarrito.classList.add('carrito-body--visible');
      iconCarrito.textContent = '▼';
    } else {
      footerCarrito.classList.remove('carrito-flotante--abierto');
      bodyCarrito.classList.remove('carrito-body--visible');
      iconCarrito.textContent = '▲';
    }
  };

  const actualizarUI = () => {
    const carrito = CarritoService.getCarrito();
    const cantidadTotal = carrito.reduce((acc, item) => acc + item.cantidad, 0);
    const importeTotal = CarritoService.obtenerTotal();
    
    countSpan.textContent = cantidadTotal;
    totalHeader.textContent = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(importeTotal);

    if (cantidadTotal > 0) {
      footerCarrito.classList.add('carrito-flotante--visible');
    } else {
      footerCarrito.classList.remove('carrito-flotante--visible');
      if (carritoAbierto) headerCarrito.click(); // Cerrar si se vacía
    }

    itemsContainer.innerHTML = '';
    carrito.forEach(item => {
      const el = document.createElement('div');
      el.className = 'carrito-item';
      el.innerHTML = `
        <div class="carrito-item-info">
          <h4>${item.producto.nombre}</h4>
          <strong class="carrito-item-subtotal">${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(item.producto.precio * item.cantidad)}</strong>
        </div>
        <div class="carrito-item-controles">
          <button type="button" class="btn-menos carrito-item-btn">-</button>
          <span>${item.cantidad}</span>
          <button type="button" class="btn-mas carrito-item-btn">+</button>
          <button type="button" class="btn-eliminar carrito-item-eliminar" aria-label="Eliminar">🗑️</button>
        </div>
      `;
      
      const btnMenos = el.querySelector('.btn-menos');
      const btnMas = el.querySelector('.btn-mas');
      const btnEliminar = el.querySelector('.btn-eliminar');

      btnMenos.onclick = (e) => {
        e.stopPropagation();
        CarritoService.actualizarProducto(item.producto, item.cantidad - 1);
        actualizarUI();
        
        // Disparar evento para que la carta se entere de que bajó la cantidad
        window.dispatchEvent(new Event('carrito-actualizado'));
      };

      btnMas.onclick = (e) => {
        e.stopPropagation();
        CarritoService.actualizarProducto(item.producto, item.cantidad + 1);
        actualizarUI();
        window.dispatchEvent(new Event('carrito-actualizado'));
      };

      btnEliminar.onclick = (e) => {
        e.stopPropagation();
        CarritoService.actualizarProducto(item.producto, 0); // 0 lo elimina del carrito
        actualizarUI();
        window.dispatchEvent(new Event('carrito-actualizado'));
      };

      itemsContainer.appendChild(el);
    });
  };

  btnConfirmar.onclick = async () => {
    const carrito = CarritoService.getCarrito();
    if (carrito.length === 0) return;

    btnConfirmar.disabled = true;
    statusCarrito.textContent = 'Enviando pedido...';
    statusCarrito.style.color = '#fefae0';
    
    try {
      const contexto = await obtenerContextoMesa();
      const tiempoMaximo = Math.max(...carrito.map(item => item.producto.tiempo_elaboracion_min || 0));
      
      const pedidoInfo = {
        estadia_id: contexto.estadia_id,
        tiempo_estimado_min: tiempoMaximo > 0 ? tiempoMaximo : 15
      };
      
      const itemsInfo = carrito.map(item => ({
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio_unitario: item.producto.precio,
        // Asignar sector según tipo: las bebidas van al bar, lo demás a cocina
        sector: item.producto.tipo === 'bebida' ? 'bar' : 'cocina'
      }));

      const pedidoCreado = await crearPedido(pedidoInfo, itemsInfo);
      
      // Intentar avisar a los mozos (no bloquea si falla temporalmente)
      try {
        await avisarNuevoPedido(pedidoCreado.id);
      } catch (err) {
        console.warn('El pedido se creó pero no se pudo enviar el push nativo:', err);
      }
      
      CarritoService.vaciarCarrito();
      statusCarrito.textContent = '';
      btnConfirmar.disabled = false;
      actualizarUI(); // Esto cierra el carrito porque queda vacío
      
      const avisoExito = document.createElement('div');
      avisoExito.textContent = '¡Pedido enviado con éxito! El mozo lo confirmará en breve.';
      avisoExito.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #283618; color: #dda15e; padding: 16px; border-radius: 8px; font-weight: bold; z-index: 2000; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border: 1px solid #dda15e;';
      document.body.appendChild(avisoExito);
      
      setTimeout(() => avisoExito.remove(), 4000);
      
      // Emitimos el evento para que los números de las cards vuelvan a 0
      window.dispatchEvent(new Event('carrito-actualizado'));
      
    } catch (error) {
      console.error(error);
      statusCarrito.textContent = 'Hubo un error al enviar tu pedido. Intenta nuevamente.';
      statusCarrito.style.color = '#ff6b6b';
      btnConfirmar.disabled = false;
    }
  };

  // Escuchar eventos globales si necesitamos reaccionar desde otro lado
  window.addEventListener('carrito-actualizado', actualizarUI);

  const actualizacion = crearActualizacionHu11(raiz, async vigente => {
    if (operativa) {
      const contexto = await obtenerContextoMesa();
      if (!vigente()) return;
      if (contexto.rol === 'mozo') throw new Error('Esta carta operativa es para el cliente de la mesa.');
      raiz.querySelector('[data-mesa]').textContent = `Mesa asignada: ${contexto.numero_mesa}`;
      if (!acciones.childElementCount) {
        const consulta = document.createElement('button');
        consulta.textContent = 'Consulta al mozo';
        consulta.onclick = () => navegarA('/pedidos/consulta');
        acciones.append(consulta);
      }
    }
    const productos = await listarCartaConFotos();
    if (!vigente()) return;
    const firma = JSON.stringify(productos);
    if (lista.dataset.firma === firma) return;
    lista.dataset.firma = firma;
    lista.replaceChildren();
    const tipos = { plato: 'Platos', bebida: 'Bebidas', postre: 'Postres' };
    for (const [tipo, titulo] of Object.entries(tipos)) {
      const details = document.createElement('details');
      if (tipo === 'plato') details.open = true;
      details.className = 'hu11__categoria';
      const summary = document.createElement('summary');
      summary.textContent = titulo;
      summary.className = 'hu11__categoria-titulo';
      details.append(summary);

      const grupo = document.createElement('div');
      grupo.className = 'hu11__grupo hu11__grupo-espaciado';
      
      for (const producto of productos.filter(p => p.tipo === tipo)) {
        const tarjeta = document.createElement('article');
        tarjeta.className = 'hu11-producto';
        const datos = document.createElement('div');
        datos.className = 'hu11-producto__datos';
        const nombre = document.createElement('h3'); nombre.textContent = producto.nombre;
        const descripcion = document.createElement('p'); descripcion.textContent = producto.descripcion;
        descripcion.className = 'hu11-producto__descripcion';
        const precio = document.createElement('strong');
        precio.className = 'hu11-producto__precio';
        precio.textContent = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(producto.precio);
        const tiempo = document.createElement('p'); tiempo.textContent = `Preparación: ${producto.tiempo_elaboracion_min} min`;
        tiempo.className = 'hu11-producto__tiempo';
        datos.append(nombre, descripcion, precio, tiempo);
        
        if (operativa) {
          const controles = document.createElement('div');
          controles.className = 'hu11-producto__controles';
          
          let cantidad = CarritoService.obtenerCantidad(producto.id);
          
          controles.innerHTML = `
            <button type="button" class="btn-menos hu11-producto__btn-cantidad">-</button>
            <span class="cantidad hu11-producto__cantidad-texto">${cantidad}</span>
            <button type="button" class="btn-mas hu11-producto__btn-cantidad">+</button>
          `;
          
          const btnMenos = controles.querySelector('.btn-menos');
          const btnMas = controles.querySelector('.btn-mas');
          const spanCantidad = controles.querySelector('.cantidad');
          
          btnMenos.onclick = () => {
            if (cantidad > 0) {
              cantidad--;
              spanCantidad.textContent = cantidad;
              CarritoService.actualizarProducto(producto, cantidad);
              actualizarUI();
            }
          };
          
          btnMas.onclick = () => {
            cantidad++;
            spanCantidad.textContent = cantidad;
            CarritoService.actualizarProducto(producto, cantidad);
            actualizarUI();
          };
          
          // Escuchar cambios hechos desde el carrito flotante
          window.addEventListener('carrito-actualizado', () => {
            cantidad = CarritoService.obtenerCantidad(producto.id);
            if (spanCantidad) spanCantidad.textContent = cantidad;
          });
          
          datos.append(controles);
        }

        tarjeta.append(crearCarruselImagenes(ordenarFotosProducto(producto.producto_fotos), producto.nombre), datos);
        grupo.append(tarjeta);
      }
      if (!grupo.childElementCount) grupo.textContent = 'No hay productos disponibles en esta categoría.';
      details.append(grupo);
      lista.append(details);
    }
    aviso.textContent = '';
    actualizarUI(); // Sincronizar UI al cargar
  }, error => {
    aviso.textContent = error.message;
    acciones.replaceChildren();
    lista.replaceChildren();
    delete lista.dataset.firma;
  });
  aviso.textContent = 'Cargando carta…';
  await actualizacion.actualizar();
}
