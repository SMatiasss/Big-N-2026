-- ============================================================
-- 03_baja_logica.sql
-- Agrega baja lógica (activo/inactivo) donde el esquema original
-- sólo tenía baja física, y bloquea los deletes que romperían
-- historial de pedidos, cuentas o estadías.
--
-- Ejecutar DESPUÉS de 01_schema.sql y 02_seed.sql.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PERFILES
-- ------------------------------------------------------------
-- `estado` ya existía pero es de APROBACIÓN (pendiente/aprobado/rechazado),
-- no de actividad. Un empleado que deja de trabajar, o un cliente que se
-- quiere borrar de la app, necesitan poder desactivarse sin perder el
-- historial de pedidos/mensajes/respuestas que ya generaron.

alter table perfiles add column activo boolean not null default true;

-- Los listados de "empleados" y de "clientes para aprobar" deben ignorar
-- a los inactivos por defecto.
create index idx_perfiles_activos on perfiles (rol) where activo;


-- ------------------------------------------------------------
-- 2. MESAS
-- ------------------------------------------------------------
-- No existía forma de retirar una mesa (rota, en refacción, etc.) sin
-- borrarla, y borrarla rompería cualquier `estadia` histórica que la
-- referencia (`estadias.mesa_id`).

alter table mesas add column activa boolean not null default true;

-- El listado de mesas disponibles para asignar sólo debe considerar
-- las activas. Se ajusta el índice de unicidad de estadía activa
-- para que conviva con esto (no cambia, pero queda documentado el motivo):
-- una mesa dada de baja nunca debería tener una estadía abierta al mismo tiempo.
alter table mesas add constraint ck_mesa_inactiva_libre
  check (activa or estado = 'libre');


-- ------------------------------------------------------------
-- 3. PRODUCTOS
-- ------------------------------------------------------------
-- Ya tenía `activo`, pero faltaba el índice que lo aprovecha en listados
-- filtrados (la carta del cliente NUNCA debe mostrar productos dados de
-- baja, aunque haya pedidos viejos que los referencien).
-- (el índice idx_productos_sector ya filtraba por activo en 01_schema.sql,
--  esto sólo lo confirma para cuando se liste el catálogo completo)

create index if not exists idx_productos_activos on productos (tipo) where activo;


-- ------------------------------------------------------------
-- 4. BLOQUEAR DELETES FÍSICOS PELIGROSOS
-- ------------------------------------------------------------
-- La baja lógica sólo sirve si además se impide el delete físico por
-- accidente. Un DELETE en Supabase Studio, o un bug en el frontend que
-- llame a .delete() en vez de .update({activo:false}), no debería poder
-- borrar una fila con historial real detrás.

create or replace function impedir_delete_con_historial()
returns trigger language plpgsql as $$
begin
  raise exception
    'No se permite borrar % (id=%). Usá baja lógica: update % set activo/activa = false.',
    tg_table_name, old.id, tg_table_name;
end $$;

create trigger trg_no_delete_perfiles
  before delete on perfiles
  for each row execute function impedir_delete_con_historial();

create trigger trg_no_delete_mesas
  before delete on mesas
  for each row execute function impedir_delete_con_historial();

create trigger trg_no_delete_productos
  before delete on productos
  for each row execute function impedir_delete_con_historial();

-- estadias, pedidos, cuentas, respuestas: estas NUNCA se dan de baja,
-- ni lógica ni físicamente. Son el historial en sí mismo (equivalente a
-- un asiento contable). Si alguna vez hace falta "anular" un pedido,
-- se agrega un estado 'anulado' al enum estado_pedido, no se borra la fila.
create trigger trg_no_delete_estadias
  before delete on estadias
  for each row execute function impedir_delete_con_historial();

create trigger trg_no_delete_pedidos
  before delete on pedidos
  for each row execute function impedir_delete_con_historial();

create trigger trg_no_delete_cuentas
  before delete on cuentas
  for each row execute function impedir_delete_con_historial();


-- ------------------------------------------------------------
-- 5. AJUSTE DE RLS: las policies de UPDATE ya cubren esto,
--    pero conviene revocar el DELETE de estas tablas para clientes
--    autenticados aunque no exista policy de delete definida
--    (por defecto Postgres deniega si no hay policy, esto es sólo
--    una capa extra explícita).
-- ------------------------------------------------------------

revoke delete on perfiles, mesas, productos, estadias, pedidos, cuentas
  from authenticated, anon;


-- ------------------------------------------------------------
-- 6. HELPERS PARA LOS SERVICES DEL FRONTEND
-- ------------------------------------------------------------
-- Vistas que ya filtran lo dado de baja, para que services/ las use
-- directamente en vez de acordarse de agregar `.eq('activo', true)`
-- en cada query.

create or replace view v_mesas_activas as
  select * from mesas where activa;

create or replace view v_productos_activos as
  select * from productos where activo;

create or replace view v_empleados_activos as
  select * from perfiles
   where activo
     and rol in ('dueno','supervisor','metre','mozo','cocinero','cantinero');
