// Roles, estados y nombres de tablas: un solo lugar para no repetir strings sueltos.

export const ROLES = {
  ADMIN: 'admin',
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

// Los sectores indican dónde se prepara el producto; no representan roles de usuario.
export const SECTORES = {
  COCINA: 'cocina',
  BAR: 'bar',
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

// El bucket público confirmado para almacenar las imágenes reales de productos.
export const BUCKETS = {
  PRODUCTOS: 'productos',
};

export const TIPOS_PRODUCTO = {
  PLATO: 'plato',
  BEBIDA: 'bebida',
};
