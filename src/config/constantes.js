// Roles, estados y nombres de tablas: un solo lugar para no repetir strings sueltos.

export const ROLES = {
  ADMIN: 'admin',
  MOZO: 'mozo',
  COCINA: 'cocina',
  BAR: 'bar',
  METRE: 'metre',
  CLIENTE: 'cliente',
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
