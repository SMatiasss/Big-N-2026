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
  // Los dos valores reales de cliente en el enum rol_usuario (01_schema.sql).
  // ROLES.CLIENTE ('cliente') no coincide con ninguno de los dos y no se usa.
  CLIENTE_REGISTRADO: 'cliente_registrado',
  CLIENTE_ANONIMO: 'cliente_anonimo',
};

// Cómo se muestra cada rol en pantalla: los valores de la base vienen en
// snake_case ('cliente_registrado') y no se pueden mostrar tal cual.
export const ETIQUETAS_ROL = {
  [ROLES.DUENO]: 'Dueño',
  [ROLES.SUPERVISOR]: 'Supervisor',
  [ROLES.METRE]: 'Metre',
  [ROLES.MOZO]: 'Mozo',
  [ROLES.COCINERO]: 'Cocinero',
  [ROLES.CANTINERO]: 'Cantinero',
  [ROLES.CLIENTE_REGISTRADO]: 'Cliente registrado',
  [ROLES.CLIENTE_ANONIMO]: 'Cliente anónimo',
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
  CREADO: 'pendiente_confirmacion',
  CONFIRMADO: 'en_preparacion',
  RECHAZADO: 'rechazado',
  EN_PREPARACION: 'en_preparacion',
  // Punto 18: todos los sectores terminaron su parte. No lo escribe la app:
  // lo pone el trigger trg_estado_pedido cuando ya no queda ningún ítem sin
  // marcar 'listo' (ver 01_schema.sql).
  LISTO: 'listo',
  // Punto 19: el cliente confirmó que recibió el pedido.
  ENTREGADO: 'entregado',
};

// El estado vive también a nivel de ítem: es lo que permite representar
// "la cocina ya terminó pero el bar todavía no" (puntos 16 a 18).
export const ESTADOS_ITEM = {
  PENDIENTE: 'pendiente',
  EN_PREPARACION: 'en_preparacion',
  LISTO: 'listo',
  ENTREGADO: 'entregado',
};

export const ESTADOS_ESTADIA = {
  ABIERTA: 'abierta',
  PEDIDO_EN_CURSO: 'pedido_en_curso',
  // Punto 19: con el pedido ya recibido se habilitan juegos, encuesta y cuenta.
  ENTREGADO: 'entregado',
  CUENTA_SOLICITADA: 'cuenta_solicitada',
  PAGADA: 'pagada',
  CERRADA: 'cerrada',
};

// Coincide con el enum estado_espera del schema (01_schema.sql).
export const ESTADOS_ESPERA = {
  ESPERANDO: 'esperando',
  ASIGNADO: 'asignado',
  CANCELADO: 'cancelado',
};

// Coincide con el enum estado_mesa del schema (01_schema.sql).
export const ESTADOS_MESA = {
  LIBRE: 'libre',
  OCUPADA: 'ocupada',
};

export const TABLAS = {
  PERFILES: 'perfiles',
  PRODUCTOS: 'productos',
  PRODUCTO_FOTOS: 'producto_fotos',
  MESAS: 'mesas',
  LISTA_ESPERA: 'lista_espera',
  ESTADIAS: 'estadias',
  PEDIDOS: 'pedidos',
  ITEMS_PEDIDO: 'pedido_items',
  MENSAJES: 'mensajes',
  PARTIDAS: 'partidas',
  ENCUESTAS: 'encuestas',
  RESPUESTAS_ENCUESTA: 'respuestas_encuesta',
  CUENTAS: 'cuentas',
  CONFIGURACION: 'configuracion',
  NOTIFICACIONES: 'notificaciones',
};

// Vistas de sólo lectura (GROUP BY ya resuelto en el schema, ver 01_schema.sql).
export const VISTAS = {
  RESULTADOS_ENCUESTAS: 'v_resultados_encuestas',
};

// Buckets públicos de Supabase Storage para las imágenes reales de cada entidad.
export const BUCKETS = {
  PRODUCTOS: 'productos',
  MESAS: 'mesas',
  // Fotos de perfil (empleados, clientes registrados y anónimos).
  PERFILES: 'perfiles',
};

export const TIPOS_PRODUCTO = {
  PLATO: 'plato',
  BEBIDA: 'bebida',
};
