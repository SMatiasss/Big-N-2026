-- ============================================================
-- TFI - Gestión de restaurante
-- Esquema para Supabase / PostgreSQL
-- Alcance: puntos 1 al 22 (primera fecha de entrega)
-- ============================================================

-- ------------------------------------------------------------
-- 1. TIPOS ENUMERADOS
-- ------------------------------------------------------------

create type rol_usuario as enum (
  'dueno', 'supervisor', 'metre', 'mozo', 'cocinero', 'cantinero',
  'cliente_registrado', 'cliente_anonimo'
);

create type estado_aprobacion as enum ('pendiente', 'aprobado', 'rechazado');

create type tipo_mesa    as enum ('estandar', 'vip', 'movilidad_reducida');
create type estado_mesa  as enum ('libre', 'ocupada');

create type sector_trabajo as enum ('cocina', 'bar');
create type tipo_producto  as enum ('plato', 'bebida', 'postre');

create type estado_espera as enum ('esperando', 'asignado', 'cancelado');

create type estado_estadia as enum (
  'abierta',            -- el metre le asignó mesa, todavía no pidió
  'pedido_en_curso',
  'entregado',
  'cuenta_solicitada',
  'pagada',
  'cerrada'             -- el mozo confirmó el pago y liberó la mesa (punto 22)
);

create type estado_pedido as enum (
  'pendiente_confirmacion',  -- el cliente lo cerró, espera al mozo (punto 12)
  'rechazado',               -- punto 13
  'en_preparacion',          -- punto 14: derivado a cocina y bar
  'listo',                   -- punto 18: todos los sectores terminaron
  'entregado'                -- punto 19: el cliente confirmó la recepción
);

create type estado_item as enum ('pendiente', 'en_preparacion', 'listo', 'entregado');

create type tipo_control as enum (
  'radio', 'checkbox', 'select', 'slider', 'rating', 'texto', 'switch'
);

create type estado_cuenta as enum ('pendiente', 'pagada', 'confirmada');


-- ------------------------------------------------------------
-- 2. IDENTIDAD
-- ------------------------------------------------------------
-- La contraseña NO se guarda acá: vive en auth.users (Supabase Auth).
-- El cliente anónimo también tiene fila en auth.users vía signInAnonymously().

create table perfiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  apellidos          text not null,
  nombres            text not null,
  dni                text,
  cuil               text,
  email              text,
  foto_url           text,
  rol                rol_usuario not null,
  estado             estado_aprobacion not null default 'aprobado',
  motivo_rechazo     text,
  resuelto_por       uuid references perfiles(id),
  resuelto_en        timestamptz,
  creado_en          timestamptz not null default now(),

  -- El DNI es obligatorio para todos menos el cliente anónimo (punto 9)
  constraint ck_dni_requerido check (rol = 'cliente_anonimo' or dni is not null),
  -- El CUIL sólo se pide a los empleados (punto 1)
  constraint ck_cuil_empleado check (
    rol not in ('dueno','supervisor','metre','mozo','cocinero','cantinero')
    or cuil is not null
  )
);

create unique index uq_perfiles_dni  on perfiles (dni)  where dni  is not null;
create unique index uq_perfiles_cuil on perfiles (cuil) where cuil is not null;
create index idx_perfiles_rol_estado on perfiles (rol, estado);

-- Un usuario puede tener varios dispositivos (en la demo son cuatro celulares)
create table push_tokens (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references perfiles(id) on delete cascade,
  token       text not null unique,
  plataforma  text not null check (plataforma in ('android','ios','web')),
  creado_en   timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 3. CATÁLOGO
-- ------------------------------------------------------------
-- Una sola tabla de productos. El ruteo del punto 14 (cocina / bar)
-- sale de la columna `sector`, no de tablas separadas.

create table productos (
  id                     uuid primary key default gen_random_uuid(),
  nombre                 text not null,
  descripcion            text not null,
  tiempo_elaboracion_min integer not null check (tiempo_elaboracion_min > 0),
  precio                 numeric(12,2) not null check (precio >= 0),
  tipo                   tipo_producto not null,
  sector                 sector_trabajo not null,
  activo                 boolean not null default true,
  creado_por             uuid references perfiles(id),
  creado_en              timestamptz not null default now(),

  -- las bebidas las carga el cantinero (bar), platos y postres el cocinero
  constraint ck_sector_coherente check (
    (tipo = 'bebida' and sector = 'bar') or
    (tipo in ('plato','postre') and sector = 'cocina')
  )
);

create unique index uq_productos_nombre on productos (lower(nombre));
create index idx_productos_sector on productos (sector) where activo;

-- Tres fotos por producto como filas, no como foto1/foto2/foto3
create table producto_fotos (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  url         text not null,
  orden       smallint not null default 1,
  unique (producto_id, orden)
);


-- ------------------------------------------------------------
-- 4. SALÓN
-- ------------------------------------------------------------

create table mesas (
  id                 uuid primary key default gen_random_uuid(),
  numero             integer not null unique,
  cantidad_comensales integer not null check (cantidad_comensales > 0),
  tipo               tipo_mesa not null default 'estandar',
  estado             estado_mesa not null default 'libre',
  foto_url           text,
  -- El QR se genera automáticamente al insertar (punto 4).
  -- En la app el payload puede ser: 'mesa:' || qr_token
  qr_token           uuid not null unique default gen_random_uuid(),
  creado_en          timestamptz not null default now()
);

-- Los cinco QR de propina son datos, no constantes hardcodeadas:
-- así el token se valida contra la base y no se puede falsear desde el cliente.
create table niveles_propina (
  id          smallserial primary key,
  etiqueta    text not null unique,
  porcentaje  numeric(5,2) not null check (porcentaje between 0 and 100),
  qr_token    uuid not null unique default gen_random_uuid()
);

insert into niveles_propina (etiqueta, porcentaje) values
  ('Excelente', 20), ('Muy bueno', 15), ('Bueno', 10),
  ('Regular', 5),    ('Malo', 0);

-- El QR de ingreso al local es único y fijo: una fila de configuración.
create table configuracion (
  clave  text primary key,
  valor  text not null
);

insert into configuracion (clave, valor)
values ('qr_ingreso_token', gen_random_uuid()::text);


-- ------------------------------------------------------------
-- 5. LISTA DE ESPERA (punto 9)
-- ------------------------------------------------------------

create table lista_espera (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references perfiles(id) on delete cascade,
  comensales integer not null default 1 check (comensales > 0),
  estado     estado_espera not null default 'esperando',
  creado_en  timestamptz not null default now(),
  atendido_en timestamptz
);

-- Un cliente no puede anotarse dos veces
create unique index uq_espera_activa
  on lista_espera (cliente_id) where estado = 'esperando';


-- ------------------------------------------------------------
-- 6. ESTADÍA  (la entidad central)
-- ------------------------------------------------------------
-- Representa una visita: cliente + mesa + todo lo que pasa entre que
-- el metre le asigna la mesa y el mozo confirma el pago.
-- Es lo que hace enforzables las reglas "una encuesta por estadía"
-- y "un solo descuento (el primero)".

create table estadias (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid not null references perfiles(id),
  mesa_id          uuid not null references mesas(id),
  lista_espera_id  uuid references lista_espera(id),
  asignada_por     uuid references perfiles(id),        -- el metre (punto 10)
  estado           estado_estadia not null default 'abierta',
  -- Se escribe UNA sola vez, la primera vez que gana un juego en el
  -- primer intento (puntos 14 y 15).
  descuento_pct    numeric(5,2) not null default 0 check (descuento_pct between 0 and 100),
  iniciada_en      timestamptz not null default now(),
  cerrada_en       timestamptz
);

-- Punto 10: no se le puede asignar la misma mesa a otro cliente
create unique index uq_estadia_activa_mesa
  on estadias (mesa_id) where estado <> 'cerrada';

-- Punto 10: el cliente no se puede vincular a otra mesa
create unique index uq_estadia_activa_cliente
  on estadias (cliente_id) where estado <> 'cerrada';

create index idx_estadias_cliente on estadias (cliente_id, iniciada_en desc);


-- ------------------------------------------------------------
-- 7. PEDIDOS (puntos 12 a 19)
-- ------------------------------------------------------------

create table pedidos (
  id                  uuid primary key default gen_random_uuid(),
  estadia_id          uuid not null references estadias(id) on delete cascade,
  estado              estado_pedido not null default 'pendiente_confirmacion',
  mozo_id             uuid references perfiles(id),      -- quien confirma / rechaza
  motivo_rechazo      text,                              -- punto 13
  tiempo_estimado_min integer,                           -- punto 12
  creado_en           timestamptz not null default now(),
  confirmado_en       timestamptz,
  entregado_en        timestamptz,
  -- punto 19: el cliente confirma la recepción
  recibido_en         timestamptz
);

create index idx_pedidos_estadia on pedidos (estadia_id);
create index idx_pedidos_estado  on pedidos (estado);

-- El estado vive a nivel de ÍTEM, no sólo de pedido: sin esto no se puede
-- representar "la cocina terminó pero el bar todavía no" (punto 18).
create table pedido_items (
  id               uuid primary key default gen_random_uuid(),
  pedido_id        uuid not null references pedidos(id) on delete cascade,
  producto_id      uuid not null references productos(id),
  cantidad         integer not null check (cantidad > 0),
  -- Precio congelado al momento del pedido: si el cocinero cambia el precio
  -- del plato, las cuentas viejas no se mueven.
  precio_unitario  numeric(12,2) not null check (precio_unitario >= 0),
  sector           sector_trabajo not null,
  estado           estado_item not null default 'pendiente',
  unique (pedido_id, producto_id)
);

create index idx_items_sector on pedido_items (sector, estado);

-- Vistas para las pantallas de cocina y bar (puntos 16 y 17),
-- ya agrupadas por número de mesa.
create view v_pedidos_por_sector as
select
  pi.sector,
  m.numero        as numero_mesa,
  p.id            as pedido_id,
  p.creado_en     as fecha,
  pr.nombre       as producto,
  pi.cantidad,
  pi.estado
from pedido_items pi
join pedidos   p  on p.id  = pi.pedido_id
join estadias  e  on e.id  = p.estadia_id
join mesas     m  on m.id  = e.mesa_id
join productos pr on pr.id = pi.producto_id
where p.estado in ('en_preparacion','listo');


-- ------------------------------------------------------------
-- 8. SALA DE CONVERSACIÓN (punto 11)
-- ------------------------------------------------------------
-- Una única sala global entre todos los mozos y todos los clientes.
-- No hace falta tabla de conversaciones: alcanza con los mensajes.

create table mensajes (
  id         uuid primary key default gen_random_uuid(),
  autor_id   uuid not null references perfiles(id),
  estadia_id uuid references estadias(id) on delete set null,  -- para mostrar la mesa
  cuerpo     text not null check (length(trim(cuerpo)) > 0),
  creado_en  timestamptz not null default now()
);

create index idx_mensajes_fecha on mensajes (creado_en desc);


-- ------------------------------------------------------------
-- 9. JUEGOS Y DESCUENTOS (puntos 14 y 15)
-- ------------------------------------------------------------

create table juegos (
  id               smallserial primary key,
  nombre           text not null unique,
  descuento_pct    numeric(5,2) not null check (descuento_pct between 0 and 100)
);

insert into juegos (nombre, descuento_pct) values
  ('Adivina el número', 10),
  ('Piedra, papel o tijera', 15),
  ('Memotest', 20);

create table partidas (
  id           uuid primary key default gen_random_uuid(),
  estadia_id   uuid not null references estadias(id) on delete cascade,
  juego_id     smallint not null references juegos(id),
  intento_nro  integer not null check (intento_nro > 0),
  gano         boolean not null,
  jugada_en    timestamptz not null default now(),
  unique (estadia_id, juego_id, intento_nro)
);


-- ------------------------------------------------------------
-- 10. ENCUESTAS (punto 20)
-- ------------------------------------------------------------
-- Modelo pregunta / respuesta en vez de columnas fijas o un jsonb suelto:
-- cada gráfico del enunciado sale de un GROUP BY, y se pueden agregar
-- preguntas sin migrar la base.

create table encuestas (
  id      smallserial primary key,
  nombre  text not null unique,
  activa  boolean not null default true
);

create table preguntas (
  id           uuid primary key default gen_random_uuid(),
  encuesta_id  smallint not null references encuestas(id) on delete cascade,
  texto        text not null,
  control      tipo_control not null,
  -- Para radio / checkbox / select: ["Muy bueno","Bueno",...]
  -- Para slider / rating: {"min":1,"max":10,"paso":1}
  opciones     jsonb,
  obligatoria  boolean not null default true,
  orden        smallint not null,
  unique (encuesta_id, orden)
);

create table respuestas (
  id           uuid primary key default gen_random_uuid(),
  encuesta_id  smallint not null references encuestas(id),
  estadia_id   uuid not null references estadias(id) on delete cascade,
  cliente_id   uuid not null references perfiles(id),
  creado_en    timestamptz not null default now(),
  -- Punto 20: una encuesta por estadía
  unique (estadia_id, encuesta_id)
);

create table respuesta_items (
  id             uuid primary key default gen_random_uuid(),
  respuesta_id   uuid not null references respuestas(id) on delete cascade,
  pregunta_id    uuid not null references preguntas(id),
  valor_numerico numeric(10,2),
  valor_texto    text,
  valor_opciones text[],
  unique (respuesta_id, pregunta_id),
  constraint ck_algun_valor check (
    valor_numerico is not null or valor_texto is not null or valor_opciones is not null
  )
);

-- Base de los gráficos: un GROUP BY y listo.
create view v_resultados_encuestas as
select
  p.id            as pregunta_id,
  p.texto         as pregunta,
  p.control,
  coalesce(ri.valor_texto, ri.valor_numerico::text, opcion) as valor,
  count(*)        as cantidad
from respuesta_items ri
join preguntas p on p.id = ri.pregunta_id
left join lateral unnest(ri.valor_opciones) as opcion on true
group by p.id, p.texto, p.control, 4;


-- ------------------------------------------------------------
-- 11. CUENTA (puntos 21 y 22)
-- ------------------------------------------------------------

create table cuentas (
  id                uuid primary key default gen_random_uuid(),
  estadia_id        uuid not null unique references estadias(id) on delete cascade,
  subtotal          numeric(12,2) not null default 0 check (subtotal >= 0),
  descuento_pct     numeric(5,2)  not null default 0,
  nivel_propina_id  smallint references niveles_propina(id),
  propina_pct       numeric(5,2)  not null default 0,
  total             numeric(12,2) generated always as (
                      round(subtotal * (1 - descuento_pct / 100)
                                     * (1 + propina_pct   / 100), 2)
                    ) stored,
  estado            estado_cuenta not null default 'pendiente',
  solicitada_en     timestamptz not null default now(),
  pagada_en         timestamptz,
  confirmada_por    uuid references perfiles(id),   -- el mozo (punto 22)
  confirmada_en     timestamptz,
  -- Punto 21: no se genera la cuenta sin elegir el nivel de propina
  constraint ck_propina_obligatoria check (
    estado = 'pendiente' or nivel_propina_id is not null
  )
);


-- ------------------------------------------------------------
-- 12. NOTIFICACIONES
-- ------------------------------------------------------------
-- Historial en base. El push real lo dispara una Edge Function contra FCM;
-- con la app abierta alcanza con Realtime sobre esta tabla.

create table notificaciones (
  id             uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references perfiles(id) on delete cascade,
  titulo         text not null,
  cuerpo         text not null,
  tipo           text not null,
  datos          jsonb,
  leida          boolean not null default false,
  creado_en      timestamptz not null default now()
);

create index idx_notif_destinatario on notificaciones (destinatario_id, leida, creado_en desc);


-- ------------------------------------------------------------
-- 13. FUNCIONES Y TRIGGERS DE NEGOCIO
-- ------------------------------------------------------------

-- Al ganar un juego en el PRIMER intento se fija el descuento, una sola vez.
create or replace function aplicar_descuento_juego()
returns trigger language plpgsql as $$
declare
  pct numeric(5,2);
begin
  if new.gano and new.intento_nro = 1 then
    select j.descuento_pct into pct from juegos j where j.id = new.juego_id;
    update estadias
       set descuento_pct = pct
     where id = new.estadia_id
       and descuento_pct = 0;   -- no acumulativo: sólo el primero
  end if;
  return new;
end $$;

create trigger trg_descuento_juego
  after insert on partidas
  for each row execute function aplicar_descuento_juego();


-- Punto 18: cuando no queda ningún ítem pendiente, el pedido pasa a 'listo'.
create or replace function recalcular_estado_pedido()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from pedido_items
     where pedido_id = new.pedido_id and estado <> 'listo'
  ) then
    update pedidos set estado = 'listo'
     where id = new.pedido_id and estado = 'en_preparacion';
  end if;
  return new;
end $$;

create trigger trg_estado_pedido
  after update of estado on pedido_items
  for each row execute function recalcular_estado_pedido();


-- Punto 22: confirmar el pago libera la mesa y cierra la estadía.
create or replace function cerrar_estadia()
returns trigger language plpgsql as $$
begin
  if new.estado = 'confirmada' and old.estado <> 'confirmada' then
    update estadias set estado = 'cerrada', cerrada_en = now()
     where id = new.estadia_id;
    update mesas set estado = 'libre'
     where id = (select mesa_id from estadias where id = new.estadia_id);
  end if;
  return new;
end $$;

create trigger trg_cerrar_estadia
  after update on cuentas
  for each row execute function cerrar_estadia();


-- Al asignar una mesa, marcarla ocupada.
create or replace function ocupar_mesa()
returns trigger language plpgsql as $$
begin
  update mesas set estado = 'ocupada' where id = new.mesa_id;
  update lista_espera set estado = 'asignado', atendido_en = now()
   where id = new.lista_espera_id;
  return new;
end $$;

create trigger trg_ocupar_mesa
  after insert on estadias
  for each row execute function ocupar_mesa();


-- ------------------------------------------------------------
-- 14. ROW LEVEL SECURITY
-- ------------------------------------------------------------
-- OJO: una policy sobre `perfiles` que consulte `perfiles` genera
-- recursión infinita. Por eso el rol se lee con SECURITY DEFINER.

create or replace function mi_rol() returns rol_usuario
language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid()
$$;

create or replace function es_jefe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles
     where id = auth.uid() and rol in ('dueno','supervisor')
  )
$$;

create or replace function es_empleado() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles
     where id = auth.uid()
       and rol in ('dueno','supervisor','metre','mozo','cocinero','cantinero')
  )
$$;

create or replace function mi_estadia_activa() returns uuid
language sql stable security definer set search_path = public as $$
  select id from estadias
   where cliente_id = auth.uid() and estado <> 'cerrada'
   limit 1
$$;

alter table perfiles        enable row level security;
alter table push_tokens     enable row level security;
alter table productos       enable row level security;
alter table producto_fotos  enable row level security;
alter table mesas           enable row level security;
alter table niveles_propina enable row level security;
alter table configuracion   enable row level security;
alter table lista_espera    enable row level security;
alter table estadias        enable row level security;
alter table pedidos         enable row level security;
alter table pedido_items    enable row level security;
alter table mensajes        enable row level security;
alter table juegos          enable row level security;
alter table partidas        enable row level security;
alter table encuestas       enable row level security;
alter table preguntas       enable row level security;
alter table respuestas      enable row level security;
alter table respuesta_items enable row level security;
alter table cuentas         enable row level security;
alter table notificaciones  enable row level security;

-- Perfiles
create policy perfiles_propio on perfiles
  for select using (id = auth.uid());
create policy perfiles_staff_lee on perfiles
  for select using (es_empleado());
create policy perfiles_alta on perfiles
  for insert with check (id = auth.uid() or es_jefe() or mi_rol() = 'metre');
create policy perfiles_aprueba on perfiles
  for update using (es_jefe()) with check (es_jefe());

create policy tokens_propios on push_tokens
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Catálogo: todos leen, cada sector carga lo suyo
create policy productos_lectura on productos for select using (true);
create policy productos_alta on productos for insert
  with check (
    (tipo = 'bebida' and mi_rol() = 'cantinero') or
    (tipo in ('plato','postre') and mi_rol() = 'cocinero') or
    es_jefe()
  );
create policy fotos_lectura on producto_fotos for select using (true);
create policy fotos_alta on producto_fotos for insert
  with check (mi_rol() in ('cocinero','cantinero') or es_jefe());

-- Mesas: todos leen, sólo dueño/supervisor administra
create policy mesas_lectura on mesas for select using (true);
create policy mesas_admin on mesas for all
  using (es_jefe() or mi_rol() = 'metre') with check (es_jefe() or mi_rol() = 'metre');

create policy propinas_lectura on niveles_propina for select using (true);
create policy config_lectura   on configuracion   for select using (true);

-- Lista de espera
create policy espera_propia on lista_espera
  for insert with check (cliente_id = auth.uid());
create policy espera_lectura on lista_espera
  for select using (cliente_id = auth.uid() or es_empleado());
create policy espera_gestion on lista_espera
  for update using (mi_rol() = 'metre' or es_jefe());
create policy espera_baja on lista_espera
  for delete using (mi_rol() = 'metre' or es_jefe());

-- Estadías: sólo el metre asigna mesas
create policy estadias_lectura on estadias
  for select using (cliente_id = auth.uid() or es_empleado());
create policy estadias_alta on estadias
  for insert with check (mi_rol() = 'metre' or es_jefe());
create policy estadias_update on estadias
  for update using (cliente_id = auth.uid() or es_empleado());

-- Pedidos
create policy pedidos_lectura on pedidos for select using (
  es_empleado() or estadia_id = mi_estadia_activa()
);
create policy pedidos_alta on pedidos for insert
  with check (estadia_id = mi_estadia_activa());
create policy pedidos_update on pedidos for update using (
  es_empleado() or estadia_id = mi_estadia_activa()
);

-- El cocinero sólo ve lo suyo, el cantinero lo suyo
create policy items_lectura on pedido_items for select using (
  es_jefe()
  or mi_rol() in ('mozo','metre')
  or (mi_rol() = 'cocinero'  and sector = 'cocina')
  or (mi_rol() = 'cantinero' and sector = 'bar')
  or pedido_id in (select id from pedidos where estadia_id = mi_estadia_activa())
);
create policy items_alta on pedido_items for insert with check (
  pedido_id in (select id from pedidos where estadia_id = mi_estadia_activa())
);
create policy items_update on pedido_items for update using (
  (mi_rol() = 'cocinero'  and sector = 'cocina')
  or (mi_rol() = 'cantinero' and sector = 'bar')
  or mi_rol() = 'mozo' or es_jefe()
  or pedido_id in (select id from pedidos where estadia_id = mi_estadia_activa())
);

-- Sala de conversación: mozos y clientes con estadía activa
create policy mensajes_lectura on mensajes for select using (
  es_empleado() or mi_estadia_activa() is not null
);
create policy mensajes_alta on mensajes for insert with check (
  autor_id = auth.uid()
  and (mi_rol() in ('mozo','metre','dueno','supervisor') or mi_estadia_activa() is not null)
);

-- Juegos y encuestas
create policy juegos_lectura on juegos for select using (true);
create policy partidas_propias on partidas for all
  using (estadia_id = mi_estadia_activa() or es_jefe())
  with check (estadia_id = mi_estadia_activa());

create policy encuestas_lectura  on encuestas  for select using (true);
create policy preguntas_lectura  on preguntas  for select using (true);
-- Punto 9 y 22: los resultados los puede ver cualquiera que escaneó el QR
create policy respuestas_lectura on respuestas for select using (true);
create policy items_resp_lectura on respuesta_items for select using (true);
create policy respuestas_alta    on respuestas for insert
  with check (cliente_id = auth.uid() and estadia_id = mi_estadia_activa());
create policy items_resp_alta    on respuesta_items for insert with check (
  respuesta_id in (select id from respuestas where cliente_id = auth.uid())
);

-- Cuentas
create policy cuentas_lectura on cuentas for select using (
  es_empleado() or estadia_id = mi_estadia_activa()
);
create policy cuentas_alta on cuentas for insert
  with check (estadia_id = mi_estadia_activa());
create policy cuentas_update on cuentas for update using (
  es_empleado() or estadia_id = mi_estadia_activa()
);

-- Notificaciones
create policy notif_propias on notificaciones for select
  using (destinatario_id = auth.uid());
create policy notif_marcar on notificaciones for update
  using (destinatario_id = auth.uid());


-- ------------------------------------------------------------
-- 15. REALTIME
-- ------------------------------------------------------------
-- Con esto los cuatro dispositivos se sincronizan con la app abierta.

alter publication supabase_realtime add table lista_espera;
alter publication supabase_realtime add table estadias;
alter publication supabase_realtime add table pedidos;
alter publication supabase_realtime add table pedido_items;
alter publication supabase_realtime add table mensajes;
alter publication supabase_realtime add table cuentas;
alter publication supabase_realtime add table notificaciones;
alter publication supabase_realtime add table perfiles;
