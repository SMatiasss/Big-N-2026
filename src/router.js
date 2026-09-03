// Router casero: cada ruta apunta a un módulo de pages/ que expone render(container).
// Se importa con import() dinámico para que cada pantalla se cargue solo cuando se visita.
import { verificarAccesoSesion } from './services/auth.service.js';

const rutas = {
  '/login': () => import('./pages/auth/login/index.js'),
  '/ingreso-anonimo': () => import('./pages/auth/ingreso-anonimo/index.js'),

  '/empleados/alta-empleado': () => import('./pages/empleados/alta-empleado/index.js'),
  '/empleados': () => import('./pages/empleados/listado-empleados/index.js'),

  '/productos/alta-plato': () => import('./pages/productos/alta-plato/index.js'),
  '/productos/alta-bebida': () => import('./pages/productos/alta-bebida/index.js'),
  '/carta': () => import('./pages/productos/carta/index.js'),
  '/mesa/escanear': () => import('./pages/mesas/escanear-mesa/index.js'),
  '/mesa/carta': () => import('./pages/productos/carta/index.js'),

  '/mesas/alta': () => import('./pages/mesas/alta-mesa/index.js'),
  '/mesas': () => import('./pages/mesas/gestion-mesas/index.js'),

  '/clientes/alta': () => import('./pages/clientes/alta-cliente/index.js'),
  '/clientes/aprobacion': () => import('./pages/clientes/aprobacion-clientes/index.js'),

  '/lista-espera': () => import('./pages/lista-espera/anuncio-cliente/index.js'),
  '/lista-espera/metre': () => import('./pages/lista-espera/panel-metre/index.js'),

  '/pedidos/carrito': () => import('./pages/pedidos/carta-y-carrito/index.js'),
  '/pedidos/confirmacion': () => import('./pages/pedidos/confirmacion-mozo/index.js'),
  '/pedidos/cocina': () => import('./pages/pedidos/panel-cocina/index.js'),
  '/pedidos/bar': () => import('./pages/pedidos/panel-bar/index.js'),
  '/pedidos/entrega': () => import('./pages/pedidos/entrega-pedido/index.js'),
  '/pedidos/consulta': () => import('./pages/pedidos/consulta-mozo/index.js'),

  '/juegos/1': () => import('./pages/juegos/juego-1/index.js'),
  '/juegos/2': () => import('./pages/juegos/juego-2/index.js'),
  '/juegos/3': () => import('./pages/juegos/juego-3/index.js'),

  '/encuesta': () => import('./pages/encuesta/responder-encuesta/index.js'),
  '/encuesta/resultados': () => import('./pages/encuesta/resultados-encuesta/index.js'),

  '/cuenta/solicitar': () => import('./pages/cuenta/solicitar-cuenta/index.js'),
  '/cuenta/confirmar-pago': () => import('./pages/cuenta/confirmar-pago/index.js'),
};

const RUTA_POR_DEFECTO = '/login';
let generacionNavegacion = 0;

export async function iniciarRouter(container) {
  window.addEventListener('hashchange', () => navegar(container));
  await navegar(container);
}

async function navegar(container) {
  const generacion = ++generacionNavegacion;
  const ruta = location.hash.replace('#', '') || RUTA_POR_DEFECTO;
  const cargarPagina = rutas[ruta];

  // Revisar enlaces directos y sesiones restauradas: ocultar botones no impide
  // que un cliente pendiente escriba una ruta manualmente. RLS sigue siendo necesaria.
  if (!['/login', '/ingreso-anonimo', '/clientes/alta'].includes(ruta)) {
    container.textContent = 'Verificando acceso…';
    try {
      const session = await verificarAccesoSesion();
      if (generacion !== generacionNavegacion) return;
      if (!session) { navegarA('/login'); return; }
    } catch (error) {
      if (generacion !== generacionNavegacion) return;
      container.replaceChildren();
      const mensaje = document.createElement('p');
      mensaje.setAttribute('role', 'alert');
      mensaje.textContent = error.message;
      const volver = document.createElement('button');
      volver.textContent = 'Volver al login';
      volver.addEventListener('click', () => navegarA('/login'));
      container.append(mensaje, volver);
      return;
    }
  }

  if (!cargarPagina) {
    container.textContent = `Página no encontrada: ${ruta}`;
    return;
  }

  const modulo = await cargarPagina();
  if (generacion !== generacionNavegacion) return;
  container.innerHTML = '';
  modulo.render(container);
}

export function navegarA(ruta) {
  location.hash = ruta;
}
