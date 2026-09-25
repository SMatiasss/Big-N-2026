// Roles, estados y nombres de tablas: un solo lugar para no repetir strings sueltos.

// Exactamente los valores del enum rol_usuario (01_schema.sql), ni uno más:
// un rol que no existe en la base hace que cualquier comparación contra él
// sea siempre falsa sin que nada avise. tests/roles-enum.test.js lo verifica.
// Los sectores de trabajo ("cocina", "bar") no son roles: ver SECTORES.
export const ROLES = {
  DUENO: 'dueno',
  SUPERVISOR: 'supervisor',
  METRE: 'metre',
  MOZO: 'mozo',
  // El rol identifica al empleado autorizado para trabajar en cocina.
  COCINERO: 'cocinero',
  // El cantinero es el perfil autorizado para administrar bebidas del bar.
  CANTINERO: 'cantinero',
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

// Roles asignables desde el alta de empleado: todos menos los dos de cliente.
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

// Coincide con el enum estado_cuenta del schema (01_schema.sql).
// 'confirmada' la escribe el mozo al confirmar el pago, que es el punto 22.
export const ESTADOS_CUENTA = {
  PENDIENTE: 'pendiente',
  PAGADA: 'pagada',
  CONFIRMADA: 'confirmada',
};

// Puntos 21 y 22: los tres avisos de la cuenta tienen alcance distinto a
// propósito, y los resuelve la misma Edge Function (avisar-cuenta) según este
// valor:
//   solicitada -> sólo el mozo.
//   pagada     -> mozo + dueño + supervisor.
//   confirmada -> dueño y supervisor (punto 22: "verificar que luego de la
//                 confirmación de pago, la notificación llegue al dueño y al
//                 supervisor"). No incluye al mozo: es quien la disparó.
export const EVENTOS_CUENTA = {
  SOLICITADA: 'solicitada',
  PAGADA: 'pagada',
  CONFIRMADA: 'confirmada',
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
  PREGUNTAS: 'preguntas',
  RESPUESTAS_ENCUESTA: 'respuestas',
  RESPUESTA_ITEMS: 'respuesta_items',
  CUENTAS: 'cuentas',
  // Punto 21: los cinco niveles con su qr_token, para validar contra la base
  // el QR de propina que escanea el cliente.
  NIVELES_PROPINA: 'niveles_propina',
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
