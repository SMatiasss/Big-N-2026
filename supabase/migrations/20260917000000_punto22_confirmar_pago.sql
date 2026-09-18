-- ============================================================
-- Punto 22: el mozo confirma el pago y se libera la mesa.
-- ============================================================
--
-- La función cerrar_estadia() ya existía (01_schema.sql) y hacía lo correcto:
-- al pasar la cuenta a 'confirmada', cierra la estadía y deja la mesa libre.
-- El problema es que estaba declarada SIN security definer, así que sus dos
-- UPDATE corren con los permisos de quien dispara el trigger. Y quien lo
-- dispara en el punto 22 es el MOZO, que según la policy mesas_admin
--
--     using (es_jefe() or mi_rol() = 'metre')
--
-- no puede escribir en `mesas`. Con RLS de por medio eso no da error: el
-- UPDATE simplemente no afecta ninguna fila. Resultado: la estadía se cerraba
-- (esa policy sí incluye a los empleados) pero la mesa quedaba 'ocupada' para
-- siempre, y el cliente nunca podía volver a escanear su QR.
--
-- Se arregla donde corresponde -en la función, no aflojando la policy de
-- mesas- para que el mozo siga sin poder tocar mesas por fuera de este flujo.
-- El cuerpo es el mismo de 01_schema.sql; lo único que cambia es cómo corre.
--
-- create or replace conserva el trigger trg_cerrar_estadia ya existente, así
-- que no hace falta volver a crearlo.

create or replace function cerrar_estadia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'confirmada' and old.estado <> 'confirmada' then
    update estadias
       set estado = 'cerrada', cerrada_en = now()
     where id = new.estadia_id;

    update mesas
       set estado = 'libre'
     where id = (select mesa_id from estadias where id = new.estadia_id);
  end if;
  return new;
end $$;


-- ------------------------------------------------------------
-- El cliente tiene que poder ver SU cuenta también después de cerrada
-- ------------------------------------------------------------
--
-- Efecto colateral del trigger de arriba: confirmar el pago cierra la estadía
-- en la misma transacción. Y cuentas_lectura dejaba ver la cuenta sólo
-- mientras la estadía siguiera abierta:
--
--     using (es_empleado() or estadia_id = mi_estadia_activa())
--
-- o sea que el cliente perdía el acceso a su propia cuenta en el mismo
-- instante en que se confirmaba. Como Realtime evalúa RLS al entregar el
-- evento, el UPDATE a 'confirmada' nunca le llegaba y su pantalla se quedaba
-- en "Esperando la confirmación del mozo…" para siempre (punto 21).
--
-- Se agrega el caso "es mi cuenta, aunque la visita ya haya terminado". No
-- abre nada hacia afuera: sigue siendo la cuenta del propio cliente.

drop policy if exists cuentas_lectura on cuentas;

create policy cuentas_lectura on cuentas for select using (
  es_empleado()
  or estadia_id = mi_estadia_activa()
  or estadia_id in (select id from estadias where cliente_id = auth.uid())
);
