import './index.css';
import { listarCartaConFotos } from '../../../services/productos.service.js';
import { obtenerContextoMesa } from '../../../services/mesa-cliente.service.js';
import { crearCarruselImagenes } from '../../../components/carrusel-imagenes/carrusel-imagenes.js';
import { ordenarFotosProducto } from '../../../utils/hu11.js';
import { crearActualizacionHu11 } from '../../../utils/actualizacion-hu11.js';
import { navegarA } from '../../../router.js';

export async function render(container) {
  const operativa = location.hash.replace('#', '') === '/mesa/carta';
  container.innerHTML = '<ion-content class="hu11"><main><button type="button" data-volver>Volver</button><h1>Carta</h1><p data-mesa></p><div data-acciones></div><p role="status"></p><div class="hu11__productos"></div></main></ion-content>';
  const raiz = container.firstElementChild;
  const aviso = raiz.querySelector('[role="status"]');
  const lista = raiz.querySelector('.hu11__productos');
  const acciones = raiz.querySelector('[data-acciones]');
  raiz.querySelector('[data-volver]').onclick = () => navegarA(operativa ? '/lista-espera' : '/login');
  const actualizacion = crearActualizacionHu11(raiz, async vigente => {
    // La ruta operativa jamás habilita consultas por un flag del navegador.
    // Revalida en servidor la estadía propia, abierta y con QR comprobado.
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
    // No reconstruir los carruseles al verificar permisos si la carta no cambió.
    const firma = JSON.stringify(productos);
    if (lista.dataset.firma === firma) return;
    lista.dataset.firma = firma;
    lista.replaceChildren();
    const tipos = { plato: 'Platos', bebida: 'Bebidas', postre: 'Postres' };
    for (const [tipo, titulo] of Object.entries(tipos)) {
      const encabezado = document.createElement('h2');
      encabezado.textContent = titulo;
      lista.append(encabezado);
      const grupo = document.createElement('div');
      grupo.className = 'hu11__grupo';
      for (const producto of productos.filter(p => p.tipo === tipo)) {
        const tarjeta = document.createElement('article');
        tarjeta.className = 'hu11-producto';
        // Foto y datos en dos columnas: conserva el carrusel sin una tarjeta alta.
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
        tarjeta.append(crearCarruselImagenes(ordenarFotosProducto(producto.producto_fotos), producto.nombre), datos);
        grupo.append(tarjeta);
      }
      if (!grupo.childElementCount) grupo.textContent = 'No hay productos disponibles en esta categoría.';
      lista.append(grupo);
    }
    aviso.textContent = '';
  }, error => {
    aviso.textContent = error.message;
    acciones.replaceChildren();
    lista.replaceChildren();
    delete lista.dataset.firma;
  });
  aviso.textContent = 'Cargando carta…';
  await actualizacion.actualizar();
}
