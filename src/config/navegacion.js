import { ROLES } from './constantes.js';

const JEFES = [ROLES.DUENO, ROLES.SUPERVISOR];
const CLIENTES = [ROLES.CLIENTE_REGISTRADO, ROLES.CLIENTE_ANONIMO];

// Las rutas públicas admiten usuarios sin sesión. Si ya hay una sesión,
// el router igualmente valida el rol para evitar usar pantallas de alta como
// atajo hacia funciones que no corresponden.
export const RUTAS_PUBLICAS = new Set(['/login', '/ingreso-anonimo', '/clientes/alta']);

export const ROLES_POR_RUTA = {
  '/home': [...JEFES, ROLES.COCINERO, ROLES.CANTINERO, ROLES.MOZO, ROLES.METRE, ...CLIENTES],
  '/empleados': JEFES,
  '/empleados/alta-empleado': JEFES,
  '/productos': [...JEFES, ROLES.COCINERO, ROLES.CANTINERO],
  '/productos/alta-plato': [...JEFES, ROLES.COCINERO],
  '/productos/alta-bebida': [...JEFES, ROLES.CANTINERO],
  '/carta': [...JEFES, ROLES.COCINERO, ROLES.CANTINERO],
  '/mesas': [...JEFES, ROLES.METRE, ROLES.MOZO],
  '/mesas/alta': [...JEFES, ROLES.METRE],
  '/clientes/alta': [ROLES.METRE],
  '/clientes/aprobacion': JEFES,
  '/lista-espera': CLIENTES,
  '/lista-espera/metre': [...JEFES, ROLES.METRE],
  '/mesa/escanear': CLIENTES,
  '/mesa/carta': CLIENTES,
  '/pedidos/consulta': [ROLES.MOZO, ...CLIENTES],
  '/pedidos/confirmacion': [ROLES.MOZO],
};

// Home de clientes: se mantiene la lógica por rol (es un caso totalmente
// distinto al de empleados, con una sola acción cada uno).
const ACCIONES_HOME = {
  [ROLES.CLIENTE_REGISTRADO]: {
    principales: [
      { id: 'ingreso-local', titulo: 'Ingresar al local', descripcion: 'Escanear el QR de la entrada', accion: 'ingreso-local' },
    ],
    secundarias: [],
  },
  [ROLES.CLIENTE_ANONIMO]: { principales: [], secundarias: [] },
};

// Home de empleados: por ahora TODOS comparten esta misma pantalla con las
// mismas 7 tarjetas (a diferencia de antes, que cada rol tenía su propia
// lista curada en ACCIONES_HOME). Cuál queda habilitada para cada rol se
// decide con ROLES_POR_RUTA -la misma tabla que ya protege la navegación
// real-, así hay un solo lugar para corregir permisos en vez de dos listas
// (acciones visibles + rutas permitidas) que se podían desincronizar.
const ACCIONES_HOME_EMPLEADOS = [
  { id: 'mesas', titulo: 'Mesas', ruta: '/mesas' },
  { id: 'empleados', titulo: 'Empleados', ruta: '/empleados' },
  { id: 'productos', titulo: 'Productos', ruta: '/productos' },
  { id: 'pedidos', titulo: 'Pedidos', ruta: '/pedidos/confirmacion' },
  { id: 'espera', titulo: 'Lista de espera', ruta: '/lista-espera/metre' },
  { id: 'consultas', titulo: 'Consultas', ruta: '/pedidos/consulta' },
  { id: 'clientes', titulo: 'Clientes', ruta: '/clientes/aprobacion' },
];

export function puedeAccederRuta(ruta, rol) {
  return Boolean(rol && ROLES_POR_RUTA[ruta]?.includes(rol));
}

export function esRolCliente(rol) {
  return CLIENTES.includes(rol);
}

export function obtenerAccionesHome(rol) {
  const acciones = ACCIONES_HOME[rol] ?? { principales: [], secundarias: [] };
  return {
    principales: acciones.principales.map((accion) => ({ ...accion })),
    secundarias: acciones.secundarias.map((accion) => ({ ...accion })),
  };
}

// habilitada:false no le esconde la tarjeta al empleado -es la idea pedida,
// "se vea pero no se pueda entrar todavía"-, sólo la deja marcada para que
// home/index.js la dibuje bloqueada.
export function obtenerAccionesHomeEmpleado(rol) {
  return ACCIONES_HOME_EMPLEADOS.map((accion) => ({
    ...accion,
    habilitada: puedeAccederRuta(accion.ruta, rol),
  }));
}
