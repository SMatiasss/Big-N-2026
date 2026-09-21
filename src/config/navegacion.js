import { ESTADOS_PERFIL, ROLES, TIPOS_PRODUCTO } from './constantes.js';

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
  // Metre entra sólo a la pestaña "Activos" (ver PERMISOS_PESTANAS.clientes);
  // la pantalla decide sola qué le muestra, esto sólo la deja entrar.
  '/clientes/aprobacion': [...JEFES, ROLES.METRE],
  '/lista-espera': CLIENTES,
  '/lista-espera/metre': [...JEFES, ROLES.METRE],
  '/mesa/escanear': CLIENTES,
  '/mesa/carta': CLIENTES,
  '/pedidos/carrito': CLIENTES,
  '/pedidos/consulta': [ROLES.MOZO, ...CLIENTES],
  '/pedidos/confirmacion': [ROLES.MOZO],
  '/pedidos/cocina': [ROLES.COCINERO],
  '/pedidos/bar': [ROLES.CANTINERO],
  // Puntos 18 y 19: el mozo ve los pedidos completos y los entrega; el cliente
  // sigue el estado del suyo y confirma que lo recibió.
  '/pedidos/entrega': [ROLES.MOZO],
  '/pedidos/estado': CLIENTES,
  // Punto 19: "el cliente podrá acceder a los juegos, a la encuesta y a la
  // opción de pedir la cuenta". Las pantallas son de los puntos 15, 20 y 21
  // (todavía sin implementar); acá sólo se abre el acceso, que es la parte que
  // le corresponde al 19.
  // HU15 es exclusiva del cliente registrado. El cliente anónimo puede
  // pedir y seguir su pedido, pero no participa por descuentos.
  '/pedidos/aceptado': [ROLES.CLIENTE_REGISTRADO],
  '/juegos': [ROLES.CLIENTE_REGISTRADO],
  '/juegos/1': [ROLES.CLIENTE_REGISTRADO],
  '/juegos/2': [ROLES.CLIENTE_REGISTRADO],
  '/juegos/3': [ROLES.CLIENTE_REGISTRADO],
  '/encuesta': CLIENTES,
  '/encuesta/resultados': CLIENTES,
  '/cuenta/solicitar': CLIENTES,
  // Punto 22: cobrar es del mozo. El dueño y el supervisor reciben el aviso de
  // la confirmación, pero no confirman ellos, así que no entran acá.
  '/cuenta/confirmar-pago': [ROLES.MOZO],
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

// Home de empleados: matriz de acceso pedida explícitamente. Las 7 tarjetas
// se muestran SIEMPRE a todo el staff; esta matriz sólo decide cuáles quedan
// habilitadas para cada rol y cuáles se ven grisadas (sin acceso de sólo
// lectura real: el botón gris no navega a ningún lado). El resto del staff
// visible por rol es una decisión de diseño, no un permiso de RLS: por eso
// vive acá y no en ROLES_POR_RUTA (que sigue protegiendo la navegación real
// si alguien llega por URL directa).
const PERMISOS_HOME = {
  [ROLES.DUENO]: {
    empleados: true, mesas: true, productos: false, pedidos: false,
    listaEspera: false, clientes: true, consultas: false, cuentas: false,
  },
  [ROLES.SUPERVISOR]: {
    empleados: true, mesas: true, productos: false, pedidos: false,
    listaEspera: false, clientes: true, consultas: false, cuentas: false,
  },
  [ROLES.COCINERO]: {
    empleados: false, mesas: false, productos: true, pedidos: true,
    listaEspera: false, clientes: false, consultas: false, cuentas: false,
  },
  [ROLES.CANTINERO]: {
    empleados: false, mesas: false, productos: true, pedidos: true,
    listaEspera: false, clientes: false, consultas: false, cuentas: false,
  },
  [ROLES.METRE]: {
    empleados: false, mesas: false, productos: false, pedidos: false,
    listaEspera: true, clientes: true, consultas: false, cuentas: false,
  },
  // Punto 22: cobrar es una función propia del mozo, al mismo nivel que
  // Pedidos y Consultas, así que entra como tarjeta y no escondida adentro de
  // otra pantalla.
  [ROLES.MOZO]: {
    empleados: false, mesas: false, productos: false, pedidos: true,
    listaEspera: false, clientes: false, consultas: true, cuentas: true,
  },
};

// Metadatos de cada tarjeta (título, ruta, ícono) separados del permiso: la
// matriz de arriba sólo dice sí/no, esto dice cómo se ve y adónde lleva.
const METADATA_ACCIONES_HOME = {
  mesas: { id: 'mesas', titulo: 'Mesas', ruta: '/mesas' },
  empleados: { id: 'empleados', titulo: 'Empleados', ruta: '/empleados' },
  productos: { id: 'productos', titulo: 'Productos', ruta: '/productos' },
  pedidos: { id: 'pedidos', titulo: 'Pedidos', ruta: '/pedidos/confirmacion' },
  listaEspera: { id: 'espera', titulo: 'Lista de espera', ruta: '/lista-espera/metre' },
  consultas: { id: 'consultas', titulo: 'Consultas', ruta: '/pedidos/consulta' },
  clientes: { id: 'clientes', titulo: 'Clientes', ruta: '/clientes/aprobacion' },
  cuentas: { id: 'cuentas', titulo: 'Cuentas', ruta: '/cuenta/confirmar-pago' },
};

// Orden fijo de dibujado, en filas de a dos: Mesas/Empleados,
// Productos/Pedidos, Lista de espera/Consultas, Clientes/Cuentas.
// Con "Cuentas" (punto 22) la grilla queda en cuatro filas completas: antes
// Clientes quedaba sola ocupando el ancho entero, así que la tarjeta nueva no
// agrega ninguna fila ni cambia el alto del home.
const ORDEN_ACCIONES_HOME = ['mesas', 'empleados', 'productos', 'pedidos', 'listaEspera', 'consultas', 'clientes', 'cuentas'];

// Pestañas internas de las dos pantallas que hoy comparten dos roles cada
// una: se muestran SIEMPRE las dos, pero una queda deshabilitada según el rol
// (pedido explícito: "no la escondas, grisala"). Las claves usan los mismos
// valores que ya identifican cada pestaña en el código real (TIPOS_PRODUCTO
// en Productos, ESTADOS_PERFIL en Clientes), no nombres genéricos nuevos.
export const PERMISOS_PESTANAS = {
  productos: {
    [ROLES.COCINERO]: { [TIPOS_PRODUCTO.PLATO]: 'editar', [TIPOS_PRODUCTO.BEBIDA]: 'deshabilitada' },
    [ROLES.CANTINERO]: { [TIPOS_PRODUCTO.PLATO]: 'deshabilitada', [TIPOS_PRODUCTO.BEBIDA]: 'editar' },
  },
  // La pestaña "Todos" de aprobacion-clientes es la que la matriz llama
  // "Clientes - Activos" (clientes registrados ya aprobados). No se le
  // cambió el texto visible, sólo se mapea el permiso sobre ella.
  clientes: {
    [ROLES.DUENO]: { [ESTADOS_PERFIL.PENDIENTE]: 'editar', [ESTADOS_PERFIL.APROBADO]: 'deshabilitada' },
    [ROLES.SUPERVISOR]: { [ESTADOS_PERFIL.PENDIENTE]: 'editar', [ESTADOS_PERFIL.APROBADO]: 'deshabilitada' },
    [ROLES.METRE]: { [ESTADOS_PERFIL.PENDIENTE]: 'deshabilitada', [ESTADOS_PERFIL.APROBADO]: 'editar' },
  },
};

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

// Devuelve las 7 tarjetas siempre, marcadas con "habilitada" según el rol:
// la pantalla las dibuja todas y grisa las que tengan habilitada:false.
export function obtenerAccionesHomeEmpleado(rol) {
  const permisos = PERMISOS_HOME[rol] ?? {};
  return ORDEN_ACCIONES_HOME.map((clave) => {
    let ruta = METADATA_ACCIONES_HOME[clave].ruta;
    if (clave === 'pedidos') {
      if (rol === ROLES.COCINERO) ruta = '/pedidos/cocina';
      if (rol === ROLES.CANTINERO) ruta = '/pedidos/bar';
    }
    return {
      ...METADATA_ACCIONES_HOME[clave],
      ruta,
      habilitada: Boolean(permisos[clave]),
    };
  });
}
