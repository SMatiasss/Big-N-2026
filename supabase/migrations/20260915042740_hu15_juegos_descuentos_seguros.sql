begin;

-- HU15: catálogo definitivo. Se conserva cada id para no romper partidas.
update public.juegos
set nombre = 'HU15 temporal ' || id::text
where descuento_pct in (10, 15, 20);
update public.juegos
set nombre = case descuento_pct
  when 10 then 'Memotest'
  when 15 then 'Caja premiada'
  when 20 then 'Ruleta'
end
where descuento_pct in (10, 15, 20);

-- El cliente no puede insertar un resultado inventado. Toda partida nace en
-- la RPC transaccional y el porcentaje siempre sale de public.juegos.
drop trigger if exists trg_descuento_juego on public.partidas;
revoke insert, update, delete on public.partidas from anon, authenticated;

create or replace function public.hu15_jugar(
  p_juego_id smallint,
  p_eleccion integer default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_estadia public.estadias%rowtype;
  v_juego public.juegos%rowtype;
  v_intento integer;
  v_objetivo integer;
  v_gano boolean;
  v_descuento_antes numeric(5,2);
  v_descuento_despues numeric(5,2);
  v_partida uuid;
begin
  if v_usuario is null then
    raise exception 'Necesitás iniciar sesión para jugar.' using errcode = '42501';
  end if;

  if coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false)
     or not exists (
       select 1 from public.perfiles p
       where p.id = v_usuario
         and p.rol = 'cliente_registrado'
         and p.activo
         and p.estado = 'aprobado'
     ) then
    raise exception 'Los descuentos son exclusivos para clientes registrados.' using errcode = '42501';
  end if;

  select e.* into v_estadia
  from public.estadias e
  where e.cliente_id = v_usuario and e.estado <> 'cerrada'
  order by e.iniciada_en desc
  limit 1
  for update;

  if v_estadia.id is null then
    raise exception 'Necesitás una estadía activa para jugar.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.pedidos p
    where p.estadia_id = v_estadia.id
      and p.estado in ('en_preparacion', 'listo', 'entregado')
  ) then
    raise exception 'Los juegos se habilitan cuando el mozo confirma tu pedido.' using errcode = '42501';
  end if;

  select j.* into v_juego from public.juegos j where j.id = p_juego_id;
  if v_juego.id is null then
    raise exception 'El juego seleccionado no existe.' using errcode = '22023';
  end if;

  select coalesce(max(p.intento_nro), 0) + 1 into v_intento
  from public.partidas p
  where p.estadia_id = v_estadia.id and p.juego_id = v_juego.id;

  -- Cada mecánica usa un rango pequeño y comprobable. El objetivo se genera
  -- dentro de PostgreSQL, nunca en el teléfono.
  if v_juego.descuento_pct = 10 then
    if p_eleccion not between 1 and 6 then
      raise exception 'Elegí una de las seis parejas posibles.' using errcode = '22023';
    end if;
    v_objetivo := 1 + floor(random() * 6)::integer;
    v_gano := p_eleccion = v_objetivo;
  elsif v_juego.descuento_pct = 15 then
    if p_eleccion not between 1 and 3 then
      raise exception 'Elegí una de las tres cajas.' using errcode = '22023';
    end if;
    v_objetivo := 1 + floor(random() * 3)::integer;
    v_gano := p_eleccion = v_objetivo;
  elsif v_juego.descuento_pct = 20 then
    if p_eleccion is not null then
      raise exception 'La ruleta no recibe una elección.' using errcode = '22023';
    end if;
    v_objetivo := floor(random() * 8)::integer;
    v_gano := v_objetivo = 0;
  else
    raise exception 'El juego no tiene una mecánica habilitada.' using errcode = '22023';
  end if;

  v_descuento_antes := v_estadia.descuento_pct;
  insert into public.partidas(estadia_id, juego_id, intento_nro, gano)
  values (v_estadia.id, v_juego.id, v_intento, v_gano)
  returning id into v_partida;

  if v_gano and v_intento = 1 and v_descuento_antes = 0 then
    update public.estadias
    set descuento_pct = v_juego.descuento_pct
    where id = v_estadia.id and descuento_pct = 0
    returning descuento_pct into v_descuento_despues;
  end if;
  v_descuento_despues := coalesce(v_descuento_despues, v_descuento_antes);

  return jsonb_build_object(
    'partida_id', v_partida,
    'juego_id', v_juego.id,
    'intento_nro', v_intento,
    'gano', v_gano,
    'objetivo', v_objetivo,
    'descuento_juego', v_juego.descuento_pct,
    'descuento_aplicado', v_descuento_despues,
    'premio_otorgado', v_gano and v_intento = 1 and v_descuento_antes = 0
  );
end;
$$;

revoke execute on function public.hu15_jugar(smallint, integer) from public, anon;
grant execute on function public.hu15_jugar(smallint, integer) to authenticated;

commit;
