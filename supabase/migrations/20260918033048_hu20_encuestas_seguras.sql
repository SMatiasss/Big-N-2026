-- HU20: encuesta de satisfacción segura y resultados anónimos agregados.
-- La cabecera y sus ítems se crean en una única transacción mediante RPC.

drop policy if exists respuestas_lectura on public.respuestas;
drop policy if exists items_resp_lectura on public.respuesta_items;
drop policy if exists respuestas_alta on public.respuestas;
drop policy if exists items_resp_alta on public.respuesta_items;

create policy respuestas_propias_lectura
  on public.respuestas for select
  to authenticated
  using ((select auth.uid()) = cliente_id);

create policy items_respuesta_propios_lectura
  on public.respuesta_items for select
  to authenticated
  using (
    respuesta_id in (
      select r.id from public.respuestas r
      where r.cliente_id = (select auth.uid())
    )
  );

-- El cliente no inserta directamente en las tablas: la función valida la
-- estadía, el pedido recibido, la encuesta y las preguntas en conjunto.
revoke insert, update, delete on public.respuestas from anon, authenticated;
revoke insert, update, delete on public.respuesta_items from anon, authenticated;

create or replace function public.enviar_encuesta(
  p_encuesta_id smallint,
  p_respuestas jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
  v_estadia public.estadias%rowtype;
  v_respuesta_id uuid;
  v_item jsonb;
  v_pregunta public.preguntas%rowtype;
begin
  if v_usuario is null then
    raise exception 'Necesitás iniciar sesión para responder la encuesta.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_respuestas) <> 'array' then
    raise exception 'Las respuestas tienen un formato inválido.' using errcode = '22023';
  end if;

  select e.* into v_estadia
  from public.estadias e
  where e.cliente_id = v_usuario
    and e.estado <> 'cerrada'
  order by e.iniciada_en desc
  limit 1
  for update;

  if v_estadia.id is null then
    raise exception 'No tenés una estadía activa.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.pedidos p
    where p.estadia_id = v_estadia.id and p.estado = 'entregado'
  ) then
    raise exception 'La encuesta se habilita después de confirmar la recepción del pedido.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.encuestas e where e.id = p_encuesta_id and e.activa
  ) then
    raise exception 'La encuesta ya no está disponible.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.respuestas r
    where r.estadia_id = v_estadia.id and r.encuesta_id = p_encuesta_id
  ) then
    raise exception 'Ya respondiste la encuesta durante esta estadía.' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.preguntas p
    where p.encuesta_id = p_encuesta_id
      and p.obligatoria
      and not exists (
        select 1
        from jsonb_array_elements(p_respuestas) item
        where item->>'pregunta_id' = p.id::text
          and (
            nullif(btrim(item->>'valor_texto'), '') is not null
            or item ? 'valor_numerico'
            or jsonb_array_length(coalesce(item->'valor_opciones', '[]'::jsonb)) > 0
          )
      )
  ) then
    raise exception 'Completá todas las preguntas obligatorias.' using errcode = '23514';
  end if;

  insert into public.respuestas (encuesta_id, estadia_id, cliente_id)
  values (p_encuesta_id, v_estadia.id, v_usuario)
  returning id into v_respuesta_id;

  for v_item in select value from jsonb_array_elements(p_respuestas)
  loop
    select p.* into v_pregunta
    from public.preguntas p
    where p.id = (v_item->>'pregunta_id')::uuid
      and p.encuesta_id = p_encuesta_id;

    if v_pregunta.id is null then
      raise exception 'La respuesta contiene una pregunta inválida.' using errcode = '22023';
    end if;

    insert into public.respuesta_items (
      respuesta_id,
      pregunta_id,
      valor_numerico,
      valor_texto,
      valor_opciones
    ) values (
      v_respuesta_id,
      v_pregunta.id,
      case when v_item ? 'valor_numerico' then (v_item->>'valor_numerico')::numeric else null end,
      nullif(btrim(v_item->>'valor_texto'), ''),
      case
        when jsonb_typeof(v_item->'valor_opciones') = 'array'
        then array(select jsonb_array_elements_text(v_item->'valor_opciones'))
        else null
      end
    );
  end loop;

  return v_respuesta_id;
end;
$$;

revoke all on function public.enviar_encuesta(smallint, jsonb) from public, anon;
grant execute on function public.enviar_encuesta(smallint, jsonb) to authenticated;

-- Sólo expone cantidades y porcentajes. Nunca ids de clientes, estadías ni
-- comentarios libres. Los comentarios no se grafican ni se publican.
create or replace function public.obtener_resultados_encuestas()
returns table (
  encuesta_id smallint,
  pregunta_id uuid,
  pregunta text,
  control tipo_control,
  valor text,
  cantidad bigint,
  porcentaje numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with valores as (
    select
      p.encuesta_id,
      p.id as pregunta_id,
      p.texto as pregunta,
      p.control,
      coalesce(
        ri.valor_texto,
        ri.valor_numerico::text,
        opcion.valor
      ) as valor
    from public.respuesta_items ri
    join public.preguntas p on p.id = ri.pregunta_id
    left join lateral unnest(ri.valor_opciones) opcion(valor) on true
    where p.control <> 'texto'
  ), agrupados as (
    select v.*, count(*) as cantidad
    from valores v
    where v.valor is not null
    group by v.encuesta_id, v.pregunta_id, v.pregunta, v.control, v.valor
  )
  select
    a.encuesta_id,
    a.pregunta_id,
    a.pregunta,
    a.control,
    a.valor,
    a.cantidad,
    round(a.cantidad * 100.0 / nullif(sum(a.cantidad) over (partition by a.pregunta_id), 0), 1)
  from agrupados a
  order by a.encuesta_id, a.pregunta_id, a.valor;
$$;

revoke all on function public.obtener_resultados_encuestas() from public, anon;
grant execute on function public.obtener_resultados_encuestas() to authenticated;
