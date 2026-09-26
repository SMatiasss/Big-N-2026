import './index.css';
import { listarCartaConFotos } from '../../../services/productos.service.js';
import { obtenerContextoMesa } from '../../../services/mesa-cliente.service.js';
import { crearCarruselImagenes } from '../../../components/carrusel-imagenes/carrusel-imagenes.js';
import { ordenarFotosProducto } from '../../../utils/hu11.js';
import { crearActualizacionHu11 } from '../../../utils/actualizacion-hu11.js';
import { navegarA } from '../../../router.js';
import { crearAppHeader } from '../../../components/app-header/app-header.js';
import { crearPestanas } from '../../../components/pestanas-filtro/pestanas-filtro.js';
import { ajustarLista } from '../../../components/lista-ajustada/lista-ajustada.js';

import './nuevos-estilos.css';
import { CarritoService } from '../../../services/carrito.service.js';
import { crearPedido, obtenerMiPedidoEnCurso } from '../../../services/pedidos.service.js';
import { ESTADOS_PEDIDO } from '../../../config/constantes.js';
import { avisarNuevoPedido } from '../../../services/notificaciones.service.js';
import { atajarAtrasInvitado } from '../../../utils/salida-invitado.js';
import { calcularTiempoEstimadoPedido, formatearTiempoEstimado } from '../../../utils/tiempo-pedido.js';

// Un solo pedido activo por estadía: si el último no fue rechazado, ya hay
// uno en curso (o entregado) y la carta queda sólo para consultar. Antes se
// podía volver a armar y confirmar otro, y al mozo le llegaban dos pedidos de
// la misma mesa. Con el pedido rechazado sí se puede volver a pedir: es el
// "modificalo y volvé a enviarlo" del punto 13.
function hayPedidoActivo(pedido) {
  return Boolean(pedido) && pedido.estado !== ESTADOS_PEDIDO.RECHAZADO;
}

export async function render(container) {
  const operativa = location.hash.replace('#', '') === '/mesa/carta';
  // Si esta carta deja armar el carrito. Arranca en false hasta saber si la
  // estadía ya tiene un pedido activo (ver hayPedidoActivo).
  let puedePedir = false;
  container.innerHTML = `
    <ion-content class="hu11 pantalla-lista" scroll-y="false">
      <div data-header></div>
      <main class="hu11__main-espaciado pantalla-lista__cuerpo">
        <p data-mesa></p>
        <p class="hu11__solo-lectura" data-solo-lectura hidden>Ya hiciste tu pedido. La carta queda sólo para consultar: seguilo desde "Mi pedido".</p>
        <div data-acciones class="hu11__acciones-contenedor"></div>
        <div data-pestanas></div>
        <p role="status"></p>
        <section class="hu11__productos lista-ajustada" aria-label="Productos"></section>
      </main>
    </ion-content>
  `;
  const raiz = container.firstElementChild;
  const aviso = raiz.querySelector('[role="status"]');
  const lista = raiz.querySelector('.hu11__productos');
  const acciones = raiz.querySelector('[data-acciones]');
  const header = crearAppHeader({
    titulo: 'Carta',
    onVolver: () => navegarA(operativa ? '/lista-espera' : '/home'),
  });
  raiz.querySelector('[data-header]').append(header);

  /* La lista traía la clase .lista-ajustada y la cáscara .pantalla-lista,
     pero nunca se llamaba a ajustarLista(): sin eso --la-alto nunca se
     calcula, cada tarjeta conserva su alto natural y el snap corta la
     última que entra. Cuántas entran lo decide el CSS con --la-items.

     Sin opciones, igual que el resto de los listados: el hueco para el
     carrito flotante es un margin fijo de la lista (ver nuevos-estilos.css),
     así que el alto no cambia y no hay nada extra que reservar acá. */

  const ajusteLista = ajustarLista(lista);
  // Invitado: el botón atrás de Android pregunta si cerrar la sesión.
  const soltarAtras = atajarAtrasInvitado();
  window.addEventListener('hashchange', () => {
    ajusteLista.destruir();
    soltarAtras();
  }, { once: true });
  
  let carritoAbierto = false;
  const footerCarrito = document.createElement('div');
  footerCarrito.className = 'carrito-flotante';
  
  footerCarrito.innerHTML = `
    <div class="carrito-header">
      <div class="carrito-header-resumen">
        <h3>Tu Pedido<span id="carrito-count"></span></h3>
        <small>Tiempo estimado: <strong id="carrito-tiempo-header"></strong></small>
      </div>
      <div class="carrito-header-total">
        <strong id="carrito-total-header"></strong>
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
    footerCarrito.hidden = true;
    container.appendChild(footerCarrito);
  }

  // Muestra u oculta todo lo que sirve para pedir: el carrito flotante (y el
  // hueco que la lista le reserva) y el aviso de carta sólo de consulta.
  function aplicarModoPedido(valor) {
    puedePedir = valor;
    footerCarrito.hidden = !valor;
    lista.classList.toggle('hu11__productos--con-carrito', valor);
    raiz.querySelector('[data-solo-lectura]').hidden = !operativa || valor;
    if (!valor) {
      // Lo que hubiera quedado en el carrito de antes no se puede enviar.
      CarritoService.vaciarCarrito();
      abrirCarrito(false);
    }
  }

  const headerCarrito = footerCarrito.querySelector('.carrito-header');
  const bodyCarrito = footerCarrito.querySelector('.carrito-body');
  const iconCarrito = footerCarrito.querySelector('#carrito-icon');
  const itemsContainer = footerCarrito.querySelector('#carrito-items');
  const countSpan = footerCarrito.querySelector('#carrito-count');
  const totalHeader = footerCarrito.querySelector('#carrito-total-header');
  const tiempoHeader = footerCarrito.querySelector('#carrito-tiempo-header');
  const btnConfirmar = footerCarrito.querySelector('#btn-confirmar-pedido');
  const statusCarrito = footerCarrito.querySelector('#carrito-status');

  const abrirCarrito = (abrir) => {
    carritoAbierto = abrir;
    footerCarrito.classList.toggle('carrito-flotante--abierto', abrir);
    bodyCarrito.classList.toggle('carrito-body--visible', abrir);
    iconCarrito.textContent = abrir ? '▼' : '▲';
  };

  // Vacío no se despliega: no hay nada que mostrar ni confirmar.
  headerCarrito.onclick = () => {
    if (CarritoService.getCarrito().length === 0) return;
    abrirCarrito(!carritoAbierto);
  };

  const actualizarUI = () => {
    const carrito = CarritoService.getCarrito();
    const cantidadTotal = carrito.reduce((acc, item) => acc + item.cantidad, 0);
    const importeTotal = CarritoService.obtenerTotal();
    const tiempoEstimado = calcularTiempoEstimadoPedido(carrito);
    
    const vacio = cantidadTotal === 0;

    countSpan.textContent = vacio ? '' : ` (${cantidadTotal})`;
    totalHeader.textContent = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(vacio ? 0 : importeTotal);
    tiempoHeader.textContent = vacio ? '—' : formatearTiempoEstimado(tiempoEstimado);

    // Siempre a la vista en la carta operativa, aunque esté vacío: ocupa el
    // hueco que la lista le deja reservado abajo, que si no quedaba como
    // una franja vacía.
    footerCarrito.classList.add('carrito-flotante--visible');
    footerCarrito.classList.toggle('carrito-flotante--vacio', vacio);
    if (vacio && carritoAbierto) abrirCarrito(false);

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
      // Se vuelve a verificar contra la base justo antes de crear: la
      // pantalla pudo quedar abierta desde antes del primer pedido.
      if (hayPedidoActivo(await obtenerMiPedidoEnCurso())) {
        aplicarModoPedido(false);
        dibujarCarta();
        statusCarrito.textContent = '';
        btnConfirmar.disabled = false;
        return;
      }

      const contexto = await obtenerContextoMesa();
      const tiempoEstimado = calcularTiempoEstimadoPedido(carrito);
      
      const pedidoInfo = {
        estadia_id: contexto.estadia_id,
        tiempo_estimado_min: tiempoEstimado
      };
      
      const itemsInfo = carrito.map(item => ({
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio_unitario: item.producto.precio,
        // Usar el sector real con el que el producto fue creado en la base de datos
        sector: item.producto.sector || (item.producto.tipo === 'bebida' ? 'bar' : 'cocina')
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
      // Emitimos el evento para que los números de las cards vuelvan a 0
      window.dispatchEvent(new Event('carrito-actualizado'));

      if (contexto.rol === 'cliente_registrado') {
        navegarA('/pedidos/aceptado');
      } else {
        const avisoExito = document.createElement('div');
        avisoExito.textContent = '¡Pedido enviado con éxito! El mozo lo confirmará en breve.';
        avisoExito.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #283618; color: #dda15e; padding: 16px; border-radius: 8px; font-weight: bold; z-index: 2000; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border: 1px solid #dda15e;';
        document.body.appendChild(avisoExito);
        setTimeout(() => avisoExito.remove(), 4000);
        navegarA('/pedidos/estado');
      }
      
    } catch (error) {
      console.error(error);
      statusCarrito.textContent = 'Hubo un error al enviar tu pedido. Intenta nuevamente.';
      statusCarrito.style.color = '#ff6b6b';
      btnConfirmar.disabled = false;
    }
  };

  // Escuchar eventos globales si necesitamos reaccionar desde otro lado
  window.addEventListener('carrito-actualizado', actualizarUI);

  let productosCache = [];
  let tipoSeleccionado = 'plato';

  const pestanasContainer = raiz.querySelector('[data-pestanas]');
  const pestanas = crearPestanas({
    etiqueta: 'Filtrar carta',
    opciones: [
      { valor: 'plato', texto: 'Platos' },
      { valor: 'bebida', texto: 'Bebidas' },
      { valor: 'postre', texto: 'Postres' }
    ],
    seleccionInicial: tipoSeleccionado,
    onCambio: (valor) => {
      tipoSeleccionado = valor;
      dibujarCarta();
    },
  });
  if (pestanasContainer) pestanasContainer.append(pestanas.elemento);

  const dibujarCarta = () => {
    lista.replaceChildren();
    const productosVisibles = productosCache.filter(p => p.tipo === tipoSeleccionado);
    
    if (productosVisibles.length === 0) {
      lista.textContent = 'No hay productos disponibles en esta categoría.';
      return;
    }

    for (const producto of productosVisibles) {
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
      const resumen = document.createElement('div');
      resumen.className = 'hu11-producto__resumen';
      resumen.append(tiempo, precio);
      datos.append(descripcion, resumen);
      
      if (puedePedir) {
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

      tarjeta.append(
        nombre,
        crearCarruselImagenes(ordenarFotosProducto(producto.producto_fotos), producto.nombre),
        datos,
      );
      lista.append(tarjeta);
    }
  };

  const actualizacion = crearActualizacionHu11(raiz, async vigente => {
    if (operativa) {
      const contexto = await obtenerContextoMesa();
      if (!vigente()) return;
      if (contexto.rol === 'mozo') throw new Error('Esta carta operativa es para el cliente de la mesa.');
      raiz.querySelector('[data-mesa]').textContent = `Mesa asignada: ${contexto.numero_mesa}`;
      const pedido = await obtenerMiPedidoEnCurso();
      if (!vigente()) return;
      aplicarModoPedido(!hayPedidoActivo(pedido));
      if (!acciones.childElementCount) {
        const consulta = document.createElement('button');
        consulta.textContent = 'Consulta al mozo';
        consulta.onclick = () => navegarA('/pedidos/consulta');

        // Puntos 18 y 19: desde acá el cliente sigue el estado de su pedido y
        // confirma la recepción cuando el mozo se lo entrega.
        const estadoPedido = document.createElement('button');
        estadoPedido.textContent = 'Mi pedido';
        estadoPedido.onclick = () => navegarA('/pedidos/estado');

        acciones.append(consulta, estadoPedido);
      }
    }
    const productos = await listarCartaConFotos();
    if (!vigente()) return;
    // puedePedir entra en la firma: si sólo cambió eso (ej. se confirmó el
    // pedido), igual hay que redibujar para sacar los controles de cantidad.
    const firma = JSON.stringify({ productos, puedePedir });
    if (lista.dataset.firma === firma) return;
    lista.dataset.firma = firma;
    
    productosCache = productos;
    dibujarCarta();

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
