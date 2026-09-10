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

const ACCIONES_HOME = {
  [ROLES.DUENO]: {
    principales: [
      { id: 'mesas', titulo: 'Mesas', descripcion: 'Administrar las mesas del local', ruta: '/mesas' },
      { id: 'empleados', titulo: 'Empleados', descripcion: 'Consultar y registrar personal', ruta: '/empleados' },
      { id: 'clientes', titulo: 'Clientes', descripcion: 'Revisar solicitudes pendientes', ruta: '/clientes/aprobacion' },
    ],
    secundarias: [
      { id: 'productos', titulo: 'Productos', ruta: '/productos' },
      { id: 'espera', titulo: 'Lista de espera', ruta: '/lista-espera/metre' },
    ],
  },
  [ROLES.SUPERVISOR]: {
    principales: [
      { id: 'mesas', titulo: 'Mesas', descripcion: 'Administrar las mesas del local', ruta: '/mesas' },
      { id: 'empleados', titulo: 'Empleados', descripcion: 'Consultar y registrar personal', ruta: '/empleados' },
      { id: 'clientes', titulo: 'Clientes', descripcion: 'Revisar solicitudes pendientes', ruta: '/clientes/aprobacion' },
    ],
    secundarias: [
      { id: 'productos', titulo: 'Productos', ruta: '/productos' },
      { id: 'espera', titulo: 'Lista de espera', ruta: '/lista-espera/metre' },
    ],
  },
  [ROLES.COCINERO]: {
    principales: [
      { id: 'productos', titulo: 'Platos', descripcion: 'Consultar y administrar los platos', ruta: '/productos' },
    ],
    secundarias: [],
  },
  [ROLES.CANTINERO]: {
    principales: [
      { id: 'productos', titulo: 'Bebidas', descripcion: 'Consultar y administrar las bebidas', ruta: '/productos' },
    ],
    secundarias: [],
  },
  [ROLES.MOZO]: {
    principales: [
      { id: 'consultas', titulo: 'Consultas', descripcion: 'Leer y responder mensajes de las mesas', ruta: '/pedidos/consulta' },
      { id: 'pedidos', titulo: 'Pedidos', descripcion: 'Revisar los pedidos pendientes', ruta: '/pedidos/confirmacion' },
    ],
    secundarias: [{ id: 'mesas', titulo: 'Mesas', ruta: '/mesas' }],
  },
  [ROLES.METRE]: {
    principales: [
      { id: 'espera', titulo: 'Lista de espera', descripcion: 'Asignar mesas a los clientes', ruta: '/lista-espera/metre' },
      { id: 'mesas', titulo: 'Mesas', descripcion: 'Consultar disponibilidad y administrar mesas', ruta: '/mesas' },
      { id: 'registrar-cliente', titulo: 'Registrar un cliente', descripcion: 'Dar de alta un cliente desde el local', ruta: '/clientes/alta' },
    ],
    secundarias: [],
  },
  [ROLES.CLIENTE_REGISTRADO]: {
    principales: [
      { id: 'ingreso-local', titulo: 'Ingresar al local', descripcion: 'Escanear el QR de la entrada', accion: 'ingreso-local' },
    ],
    secundarias: [],
  },
  [ROLES.CLIENTE_ANONIMO]: { principales: [], secundarias: [] },
};

export function puedeAccederRuta(ruta, rol) {
  return Boolean(rol && ROLES_POR_RUTA[ruta]?.includes(rol));
}

export function obtenerAccionesHome(rol) {
  const acciones = ACCIONES_HOME[rol] ?? { principales: [], secundarias: [] };
  return {
    principales: acciones.principales.map((accion) => ({ ...accion })),
    secundarias: acciones.secundarias.map((accion) => ({ ...accion })),
  };
}
