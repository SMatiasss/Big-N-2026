-- PROPUESTA LOCAL: no aplicada al remoto. Revisar en entorno de pruebas primero.
-- Inspección 2026-09-02: perfiles_alta admite id = auth.uid() sin limitar rol.
-- Un alta propia no debe poder fabricar un dueño/supervisor ni aprobarse sola.
-- IMPORTANTE: el alta de empleados actual usa signUp en la sesión compartida.
-- Debe corregirse con el equipo ANTES de aplicar: no preservar ese bypass.
begin;

-- RLS no protege TRUNCATE. No es una operación que deba tener el frontend.
revoke truncate, references, trigger on public.perfiles from anon, authenticated;

-- RESTRICTIVE agrega un AND a las policies existentes; no abre nuevos permisos.
create policy perfiles_alta_limite_roles_punto6
on public.perfiles as restrictive for insert to authenticated
with check (
  (
    (select public.es_jefe())
    and exists (
      select 1 from public.perfiles actor
      where actor.id = (select auth.uid())
        and actor.activo and actor.estado = 'aprobado'
    )
  )
  or (
    id = (select auth.uid())
    and resuelto_por is null and resuelto_en is null
    and (
      (rol = 'cliente_registrado' and estado = 'pendiente'
        and coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') = 'false')
      or (rol = 'cliente_anonimo' and estado = 'aprobado'
        and (select auth.jwt()) ->> 'is_anonymous' = 'true')
    )
  )
  or (
    (select public.mi_rol()) = 'metre'
    and exists (
      select 1 from public.perfiles actor
      where actor.id = (select auth.uid())
        and actor.activo and actor.estado = 'aprobado'
    )
    and rol = 'cliente_registrado' and estado = 'pendiente'
    and resuelto_por is null and resuelto_en is null
  )
);

-- perfiles_aprueba ya exige es_jefe(). Se añade estado/actividad del actor y
-- transición pendiente -> decisión para clientes registrados. Otros perfiles
-- conservan la administración existente del jefe, sin cambiar sus columnas.
create policy perfiles_decision_limite_punto6
on public.perfiles as restrictive for update to authenticated
using (
  (select public.es_jefe())
  and exists (
    select 1 from public.perfiles actor
    where actor.id = (select auth.uid())
      and actor.activo and actor.estado = 'aprobado'
  )
  and (rol <> 'cliente_registrado' or estado = 'pendiente')
)
with check (
  (select public.es_jefe())
  and exists (
    select 1 from public.perfiles actor
    where actor.id = (select auth.uid())
      and actor.activo and actor.estado = 'aprobado'
  )
  and (rol <> 'cliente_registrado' or (
    estado in ('aprobado', 'rechazado')
    and resuelto_por = (select auth.uid()) and resuelto_en is not null
  ))
);

commit;
-- No resuelve por sí sola la autorización del resto de tablas para clientes
-- pendientes, ni implementa entrega de email/push. No aplicar en producción sin
-- acordar también la futura edición/baja lógica de clientes ya resueltos.
