-- HU06: limita el alta propia a los dos perfiles públicos permitidos.
-- Las altas administrativas existentes conservan su autorización, pero el
-- usuario nuevo ya no puede aprovechar id = auth.uid() para elegir otro rol.
begin;

drop policy if exists perfiles_alta on public.perfiles;

create policy perfiles_alta
on public.perfiles
for insert
to authenticated
with check (
  (
    id = (select auth.uid())
    and resuelto_por is null
    and resuelto_en is null
    and (
      (
        rol = 'cliente_registrado'
        and estado = 'pendiente'
        and coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') = 'false'
      )
      or (
        rol = 'cliente_anonimo'
        and estado = 'aprobado'
        and (select auth.jwt()) ->> 'is_anonymous' = 'true'
      )
    )
  )
  or (
    (select public.es_jefe())
    and exists (
      select 1
      from public.perfiles actor
      where actor.id = (select auth.uid())
        and actor.activo = true
        and actor.estado = 'aprobado'
    )
  )
  or (
    (select public.mi_rol()) = 'metre'
    and exists (
      select 1
      from public.perfiles actor
      where actor.id = (select auth.uid())
        and actor.activo = true
        and actor.estado = 'aprobado'
    )
    and rol = 'cliente_registrado'
    and estado = 'pendiente'
    and resuelto_por is null
    and resuelto_en is null
  )
);

commit;
