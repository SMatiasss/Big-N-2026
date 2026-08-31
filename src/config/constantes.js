// Roles, estados y nombres de tablas: un solo lugar para no repetir strings sueltos.

export const ROLES = {
  ADMIN: 'admin',
  DUENO: 'dueno',
  SUPERVISOR: 'supervisor',
  MOZO: 'mozo',
  // El rol identifica al empleado autorizado para trabajar en cocina.
  COCINERO: 'cocinero',
  // El cantinero es el perfil autorizado para administrar bebidas del bar.
  CANTINERO: 'cantinero',
  // Se conserva por compatibilidad: "cocina" es un sector, no el rol cocinero.
  COCINA: 'cocina',
  BAR: 'bar',
  METRE: 'metre',
  CLIENTE: 'cliente',
};

// Roles asignables desde el alta de empleado: excluye ADMIN/COCINA/BAR/CLIENTE,
// que no son valores válidos de la columna perfiles.rol en la base (ver rol_usuario en 01_schema.sql).
export const ROLES_EMPLEADO = [
  ROLES.DUENO,
  ROLES.SUPERVISOR,
  ROLES.METRE,
  ROLES.MOZO,
  ROLES.COCINERO,
  ROLES.CANTINERO,
];

// Los sectores indican dónde se prepara el producto; no representan roles de usuario.
export const SECTORES = {
  COCINA: 'cocina',
  BAR: 'bar',
};

// Coincide con el enum tipo_mesa del schema (01_schema.sql).
export const TIPOS_MESA = {
  ESTANDAR: 'estandar',
  VIP: 'vip',
  MOVILIDAD_REDUCIDA: 'movilidad_reducida',
};

export const ESTADOS_PERFIL = {
  PENDIENTE: 'pendiente',
  APROBADO: 'aprobado',
  RECHAZADO: 'rechazado',
};

export const ESTADOS_PEDIDO = {
  CREADO: 'creado',
  CONFIRMADO: 'confirmado',
  RECHAZADO: 'rechazado',
  EN_PREPARACION: 'en_preparacion',
  ENTREGADO: 'entregado',
};

export const ESTADOS_ESTADIA = {
  ABIERTA: 'abierta',
  CERRADA: 'cerrada',
};

export const TABLAS = {
  PERFILES: 'perfiles',
  PRODUCTOS: 'productos',
  PRODUCTO_FOTOS: 'producto_fotos',
  MESAS: 'mesas',
  LISTA_ESPERA: 'lista_espera',
  ESTADIAS: 'estadias',
  PEDIDOS: 'pedidos',
  ITEMS_PEDIDO: 'items_pedido',
  MENSAJES: 'mensajes',
  PARTIDAS: 'partidas',
  ENCUESTAS: 'encuestas',
  RESPUESTAS_ENCUESTA: 'respuestas_encuesta',
  CUENTAS: 'cuentas',
};

// Buckets públicos de Supabase Storage para las imágenes reales de cada entidad.
export const BUCKETS = {
  PRODUCTOS: 'productos',
  MESAS: 'mesas',
};

export const TIPOS_PRODUCTO = {
  PLATO: 'plato',
  BEBIDA: 'bebida',
};
