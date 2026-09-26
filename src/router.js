// Router casero: cada ruta apunta a un módulo de pages/ que expone render(container).
// Se importa con import() dinámico para que cada pantalla se cargue solo cuando se visita.
import { obtenerPerfilActual, verificarAccesoSesion } from './services/auth.service.js';
import { puedeAccederRuta, RUTAS_PUBLICAS } from './config/navegacion.js';

const rutas = {
  '/login': () => import('./pages/auth/login/index.js'),
  '/home': () => import('./pages/home/index.js'),
  '/ingreso-anonimo': () => import('./pages/auth/ingreso-anonimo/index.js'),

  '/empleados/alta-empleado': () => import('./pages/empleados/alta-empleado/index.js'),
  '/empleados': () => import('./pages/empleados/listado-empleados/index.js'),

  '/productos/alta-plato': () => import('./pages/productos/alta-plato/index.js'),
  '/productos/alta-bebida': () => import('./pages/productos/alta-bebida/index.js'),
  '/productos': () => import('./pages/productos/gestion-productos/index.js'),
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
  '/pedidos/estado': () => import('./pages/pedidos/estado-pedido/index.js'),
  '/pedidos/consulta': () => import('./pages/pedidos/consulta-mozo/index.js'),
  '/pedidos/aceptado': () => import('./pages/pedidos/pedido-aceptado/index.js'),

  '/juegos': () => import('./pages/juegos/index.js'),
  '/juegos/1': () => import('./pages/juegos/juego-1/index.js'),
  '/juegos/2': () => import('./pages/juegos/juego-2/index.js'),
  '/juegos/3': () => import('./pages/juegos/juego-3/index.js'),

  '/encuesta': () => import('./pages/encuesta/responder-encuesta/index.js'),
  '/encuesta/resultados': () => import('./pages/encuesta/resultados-encuesta/index.js'),

  '/cuenta/solicitar': () => import('./pages/cuenta/solicitar-cuenta/index.js'),
  '/cuenta/confirmar-pago': () => import('./pages/cuenta/confirmar-pago/index.js'),
};

// Rutas con parámetro: se prueban sólo si no hubo coincidencia exacta arriba
// (así /mesa/escanear y /mesa/carta siguen yendo a sus pantallas). La clave
// es la que usan los permisos (ROLES_POR_RUTA) y la página recibe los grupos
// con nombre del patrón como segundo argumento de render().
const rutasConParametro = [
  {
    clave: '/mesa/:id',
    patron: /^\/mesa\/(?<id>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
    cargar: () => import('./pages/mesas/info-mesa/index.js'),
  },
];

function resolverRuta(ruta) {
  if (rutas[ruta]) return { clave: ruta, cargarPagina: rutas[ruta], parametros: {} };
  for (const { clave, patron, cargar } of rutasConParametro) {
    const coincidencia = ruta.match(patron);
    if (coincidencia) return { clave, cargarPagina: cargar, parametros: { ...coincidencia.groups } };
  }
  return { clave: ruta, cargarPagina: null, parametros: {} };
}

const RUTA_POR_DEFECTO = '/login';
let generacionNavegacion = 0;
let avisoNavegacion = '';

export async function iniciarRouter(container) {
  window.addEventListener('hashchange', () => navegar(container));
  await navegar(container);
}

async function navegar(container) {
  const generacion = ++generacionNavegacion;
  const rutaHash = location.hash.replace('#', '') || RUTA_POR_DEFECTO;
  // "ruta" es la clave (ej. '/mesa/:id'): la que usan permisos y rutas públicas.
  const { clave: ruta, cargarPagina, parametros } = resolverRuta(rutaHash);
  container.removeAttribute('aria-busy');

  // Los permisos de ruta son la primera barrera de navegación. RLS sigue
  // siendo la protección definitiva para las operaciones y los datos.
  if (!RUTAS_PUBLICAS.has(ruta)) {
    // Se mantiene visible la pantalla actual mientras se consulta la sesión.
    // Así la validación no produce una pantalla blanca intermedia con texto plano.
    container.setAttribute('aria-busy', 'true');
    try {
      const session = await verificarAccesoSesion();
      if (generacion !== generacionNavegacion) return;
      if (!session) {
        container.removeAttribute('aria-busy');
        navegarA('/login');
        return;
      }
      const perfil = await obtenerPerfilActual();
      if (generacion !== generacionNavegacion) return;
      if (!puedeAccederRuta(ruta, perfil?.rol)) {
        container.removeAttribute('aria-busy');
        avisoNavegacion = 'Esa opción no está disponible para tu perfil.';
        reemplazarRuta('/home');
        return;
      }
    } catch (error) {
      if (generacion !== generacionNavegacion) return;
      container.removeAttribute('aria-busy');
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

  // Login e ingreso anónimo son exclusivos de usuarios sin sesión. El alta
  // de cliente también es pública, pero con sesión sólo corresponde al metre.
  if (RUTAS_PUBLICAS.has(ruta)) {
    try {
      const session = await verificarAccesoSesion();
      if (generacion !== generacionNavegacion) return;
      if (session) {
        if (ruta === '/clientes/alta') {
          const perfil = await obtenerPerfilActual();
          if (puedeAccederRuta(ruta, perfil?.rol)) {
            // El metre puede continuar con el alta administrativa.
          } else {
            avisoNavegacion = 'Esa opción no está disponible para tu perfil.';
            reemplazarRuta('/home');
            return;
          }
        } else {
          reemplazarRuta('/home');
          return;
        }
      }
    } catch {
      if (generacion !== generacionNavegacion) return;
      // Un perfil pendiente/rechazado ya fue desconectado por el servicio y
      // sigue a la pantalla pública. No se guarda el motivo como aviso: sólo
      // lo muestra el home, así que quedaba pendiente hasta el próximo login
      // exitoso y un cliente recién aprobado veía "Tu registro está pendiente
      // de aprobación". Si intenta entrar sin estar aprobado, el login ya le
      // muestra ese mismo motivo (signIn lo rechaza).
    }
  }

  if (!cargarPagina) {
    container.removeAttribute('aria-busy');
    container.textContent = `Página no encontrada: ${rutaHash}`;
    return;
  }

  const modulo = await cargarPagina();
  if (generacion !== generacionNavegacion) return;
  container.removeAttribute('aria-busy');
  container.innerHTML = '';
  modulo.render(container, parametros);
}

/* =========================================================
   HISTORIAL: VOLVER SIN APILAR Y BOTÓN ATRÁS INTERCEPTABLE

   navegarA() cambia location.hash, y cada cambio apila una entrada en el
   historial del WebView. El botón volver del header también navegaba así,
   con lo que "Empleados -> Agregar -> volver" dejaba Empleados, Agregar y
   Empleados apilados: el botón atrás de Android volvía a Agregar y se armaba
   un bucle. Acá se lleva una pila de rutas para que "volver" retroceda de
   verdad (history.back) cuando el destino es la pantalla anterior, y
   reemplace la entrada actual cuando no lo es.
   ========================================================= */

const rutaActual = () => location.hash.replace(/^#/, '') || '/';

// Aproximación del historial del WebView, alimentada por hashchange.
const pila = [rutaActual()];
let proximoEsReemplazo = false;
let modoVolver = false;

window.addEventListener('hashchange', () => {
  const ruta = rutaActual();
  if (proximoEsReemplazo) {
    proximoEsReemplazo = false;
    pila[pila.length - 1] = ruta;
  } else if (pila.length >= 2 && pila[pila.length - 2] === ruta) {
    pila.pop(); // fue un retroceso (botón atrás o history.back)
  } else {
    pila.push(ruta);
  }
});

export function navegarA(ruta) {
  // Llamada desde el botón volver del header: no apila (ver volverA).
  if (modoVolver) {
    volverA(ruta);
    return;
  }
  location.hash = ruta;
}

// Ejecuta el handler del botón volver del header: cualquier navegarA() que
// haga adentro (sincrónico) se resuelve como volverA(), sin apilar.
export function ejecutarComoVolver(handler) {
  modoVolver = true;
  try {
    return handler();
  } finally {
    modoVolver = false;
  }
}

/* Botón atrás de Android: una pantalla puede atajarlo mientras tiene algo
   abierto (ej. el visor de fotos) para cerrarlo en vez de navegar.
   Devuelve la función que lo suelta. Gana el último registrado. */
const manejadoresAtras = [];

export function alPresionarAtras(manejador) {
  manejadoresAtras.push(manejador);
  return () => {
    const indice = manejadoresAtras.lastIndexOf(manejador);
    if (indice >= 0) manejadoresAtras.splice(indice, 1);
  };
}

// Lo llama main.js al recibir el botón atrás. true si alguien lo atajó.
export function manejarBotonAtras() {
  const manejador = manejadoresAtras.at(-1);
  if (!manejador) return false;
  manejador();
  return true;
}

export function irAlHome() {
  navegarA('/home');
}

// Volver a una pantalla sin apilar: si es la anterior, se retrocede de
// verdad; si no, se reemplaza la entrada actual.
export function volverA(ruta) {
  if (pila.length >= 2 && pila[pila.length - 2] === ruta) {
    window.history.back();
    return;
  }
  reemplazarRuta(ruta);
}

export function reemplazarRuta(ruta) {
  // A la misma ruta no hay navegación ni hashchange: no se marca nada.
  if (ruta === rutaActual()) return;
  proximoEsReemplazo = true;
  const destino = `${window.location.pathname}${window.location.search}#${ruta}`;
  window.location.replace(destino);
}

export function consumirAvisoNavegacion() {
  const aviso = avisoNavegacion;
  avisoNavegacion = '';
  return aviso;
}
