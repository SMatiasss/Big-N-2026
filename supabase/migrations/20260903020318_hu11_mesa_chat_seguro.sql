-- LOCAL / NO APLICADA. Revisar y probar antes del despliegue.
-- Reutiliza estadias (asignación del metre) y mensajes (conversación por visita).
begin;

-- Dependencia mínima HU06: limitar el alta, sin modificar su flujo de decisiones.
-- RESTRICTIVE agrega un AND, incluso si subsiste la policy permisiva original.
-- No basta comprobar el NOMBRE de una policy: se instala la condición efectiva.
-- Coordinar antes el alta de empleados: signUp no debe sustituir la sesión del jefe.
create policy hu11_perfiles_alta_segura on public.perfiles
as restrictive for insert to public with check (
  (
    (select public.es_jefe()) and exists (
      select 1 from public.perfiles actor where actor.id=(select auth.uid())
      and actor.activo and actor.estado='aprobado'
    )
  ) or (
    id=(select auth.uid()) and activo and resuelto_por is null and resuelto_en is null
    and (
      (rol='cliente_registrado' and estado='pendiente'
        and coalesce((select auth.jwt())->>'is_anonymous','false')='false')
      or (rol='cliente_anonimo' and estado='aprobado'
        and (select auth.jwt())->>'is_anonymous'='true')
    )
  ) or (
    (select public.mi_rol())='metre' and exists (
      select 1 from public.perfiles actor where actor.id=(select auth.uid())
      and actor.activo and actor.estado='aprobado'
    ) and rol='cliente_registrado' and estado='pendiente'
      and resuelto_por is null and resuelto_en is null
  )
);
-- es_jefe() ignora activo/estado: sin este AND un jefe deshabilitado podría
-- reactivarse o fabricar un mozo editando perfiles. No altera las transiciones HU06.
create policy hu11_perfiles_edicion_segura on public.perfiles
as restrictive for update to public
using (
  (select public.es_jefe()) and exists (
    select 1 from public.perfiles actor where actor.id=(select auth.uid())
      and actor.activo and actor.estado='aprobado'
  )
)
with check (
  (select public.es_jefe()) and exists (
    select 1 from public.perfiles actor where actor.id=(select auth.uid())
      and actor.activo and actor.estado='aprobado'
  )
);
-- TRUNCATE no obedece RLS; tampoco es necesario crear triggers desde la app.
revoke truncate, references, trigger on public.perfiles, public.estadias from public, anon, authenticated;

create schema if not exists hu11_privado;
revoke all on schema hu11_privado from public, anon;
grant usage on schema hu11_privado to authenticated;

-- Prueba persistente de validación. No se crea otra asignación ni conversación.
create table hu11_privado.accesos_mesa (
  estadia_id uuid primary key references public.estadias(id) on delete cascade,
  cliente_id uuid not null references public.perfiles(id),
  mesa_id uuid not null references public.mesas(id),
  validado_en timestamptz not null default now()
);
create index hu11_accesos_cliente on hu11_privado.accesos_mesa(cliente_id);
create index hu11_accesos_mesa on hu11_privado.accesos_mesa(mesa_id);
alter table hu11_privado.accesos_mesa enable row level security;
revoke all on hu11_privado.accesos_mesa from public, anon, authenticated;
-- Sin policies de escritura directa: sólo validar_qr, con auth.uid(), puede crearla.

create function hu11_privado.puede_chat(p_estadia_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.estadias e
    join public.mesas m on m.id=e.mesa_id
    join hu11_privado.accesos_mesa a on a.estadia_id=e.id
      and a.cliente_id=e.cliente_id and a.mesa_id=e.mesa_id
    join public.perfiles actor on actor.id=auth.uid()
    where e.id=p_estadia_id and e.estado<>'cerrada' and m.activa
      and actor.activo and (
        (actor.rol='mozo' and actor.estado='aprobado') or
        (actor.id=e.cliente_id and (actor.rol='cliente_anonimo' or
          (actor.rol='cliente_registrado' and actor.estado='aprobado')))
      )
  )
$$;

-- El UPDATE anterior de estadias permitía cambiar mesa_id conservando cliente_id.
-- Se protege esa relación; no se reimplementa la asignación/ocupación del metre.
create function hu11_privado.proteger_asignacion()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is not null and (
    new.id is distinct from old.id or new.cliente_id is distinct from old.cliente_id
    or new.mesa_id is distinct from old.mesa_id
    or new.asignada_por is distinct from old.asignada_por
    or new.lista_espera_id is distinct from old.lista_espera_id
    or (old.estado='cerrada' and new.estado<>'cerrada')
  ) then raise exception 'La asignación de la estadía no puede modificarse desde el cliente.' using errcode='42501'; end if;
  return new;
end $$;
create trigger hu11_asignacion_inmutable before update on public.estadias
for each row execute function hu11_privado.proteger_asignacion();

create function hu11_privado.contexto(p_estadia_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_estadia_id; v_resultado jsonb;
begin
  if v_id is null then
    select id into v_id from public.estadias where cliente_id=auth.uid() and estado<>'cerrada';
  end if;
  if not hu11_privado.puede_chat(v_id) then
    raise exception 'No tenés acceso a esta conversación. Necesitás tu mesa asignada y su QR validado.' using errcode='42501';
  end if;
  select jsonb_build_object('estadia_id',e.id,'mesa_id',e.mesa_id,'numero_mesa',m.numero,
    'cliente_id',e.cliente_id,'usuario_id',p.id,'rol',p.rol)
  into v_resultado from public.estadias e join public.mesas m on m.id=e.mesa_id
    join public.perfiles p on p.id=auth.uid() where e.id=v_id;
  return v_resultado;
end $$;

create function hu11_privado.validar_qr(p_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_estadia public.estadias%rowtype; v_numero integer; v_token uuid;
begin
  if not exists (select 1 from public.perfiles where id=auth.uid() and activo
    and (rol='cliente_anonimo' or (rol='cliente_registrado' and estado='aprobado'))) then
    raise exception 'Necesitás un perfil de cliente habilitado.' using errcode='42501';
  end if;
  -- El candado evita validar mientras se cierra o cambia la estadía.
  select * into v_estadia from public.estadias
    where cliente_id=auth.uid() and estado<>'cerrada' for update;
  if not found then raise exception 'Todavía no tenés mesa asignada por el metre.' using errcode='42501'; end if;
  if not exists (select 1 from public.perfiles where id=v_estadia.asignada_por
    and rol in ('metre','dueno','supervisor')) then
    raise exception 'La estadía no tiene una asignación válida del metre.' using errcode='42501';
  end if;
  select numero,qr_token into v_numero,v_token from public.mesas
    where id=v_estadia.mesa_id and activa and estado='ocupada';
  if not found then raise exception 'La mesa asignada no está disponible para ingresar.' using errcode='42501'; end if;
  if p_token is null or v_token<>p_token then
    raise exception 'Ese QR no corresponde a tu mesa. Tu mesa asignada es la %.',v_numero using errcode='42501';
  end if;
  insert into hu11_privado.accesos_mesa(estadia_id,cliente_id,mesa_id)
    values(v_estadia.id,auth.uid(),v_estadia.mesa_id) on conflict(estadia_id) do nothing;
  return hu11_privado.contexto(v_estadia.id);
end $$;

-- RLS real: cliente sólo su visita validada; mozos habilitados pueden verlas todas.
drop policy mensajes_lectura on public.mensajes;
drop policy mensajes_alta on public.mensajes;
create policy hu11_mensajes_lectura on public.mensajes for select to authenticated
using (hu11_privado.puede_chat(estadia_id));
revoke all on public.mensajes from public, anon, authenticated;
grant select on public.mensajes to authenticated;
-- Sólo la RPC escribe: impide falsificar autor, fecha, estadía o hacer UPDATE/DELETE.
create index hu11_mensajes_estadia_fecha on public.mensajes(estadia_id,creado_en,id);

create function hu11_privado.conversaciones()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.perfiles where id=auth.uid()
    and rol='mozo' and activo and estado='aprobado') then
    raise exception 'Sólo mozos habilitados pueden consultar las conversaciones.' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(f order by f.numero_mesa) from (
    select e.id as estadia_id,m.numero as numero_mesa,p.nombres,p.apellidos,
      (select max(creado_en) from public.mensajes where estadia_id=e.id) as ultimo_mensaje_en
    from public.estadias e join public.mesas m on m.id=e.mesa_id
      join public.perfiles p on p.id=e.cliente_id
    where e.estado<>'cerrada' and hu11_privado.puede_chat(e.id)
  ) f),'[]'::jsonb);
end $$;

create function hu11_privado.listar_mensajes(p_estadia_id uuid,p_antes timestamptz,p_antes_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform hu11_privado.contexto(p_estadia_id);
  if p_estadia_id is null then raise exception 'Seleccioná una conversación.'; end if;
  return coalesce((select jsonb_agg(f order by f.creado_en,f.id) from (
    select msg.id,msg.autor_id,msg.estadia_id,msg.cuerpo,msg.creado_en,
      p.nombres,p.apellidos,p.rol
    from public.mensajes msg join public.perfiles p on p.id=msg.autor_id
    where msg.estadia_id=p_estadia_id and (p_antes is null or
      (msg.creado_en,msg.id)<(p_antes,p_antes_id))
    order by msg.creado_en desc,msg.id desc limit 100
  ) f),'[]'::jsonb);
end $$;

create function hu11_privado.enviar(p_estadia_id uuid,p_cuerpo text,p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_msg public.mensajes%rowtype;
  v_cuerpo text := regexp_replace(p_cuerpo, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  v_contexto jsonb; v_rol public.rol_usuario;
begin
  if p_id is null or p_estadia_id is null or v_cuerpo is null or length(v_cuerpo) not between 1 and 1000 then
    raise exception 'El mensaje debe tener entre 1 y 1000 caracteres.' using errcode='22023';
  end if;
  -- Autorizar antes de bloquear: nadie debe poder tomar candados de otras mesas.
  perform hu11_privado.contexto(p_estadia_id);
  perform 1 from public.estadias where id=p_estadia_id for update;
  v_contexto := hu11_privado.contexto(p_estadia_id);
  insert into public.mensajes(id,autor_id,estadia_id,cuerpo,creado_en)
    values(p_id,auth.uid(),p_estadia_id,v_cuerpo,now()) on conflict(id) do nothing
    returning * into v_msg;
  if not found then
    select * into v_msg from public.mensajes where id=p_id and autor_id=auth.uid()
      and estadia_id=p_estadia_id and cuerpo=v_cuerpo;
    if not found then raise exception 'Identificador de envío inválido.' using errcode='42501'; end if;
    return to_jsonb(v_msg); -- Reintento: no duplica mensaje ni notificaciones.
  end if;
  select rol into v_rol from public.perfiles where id=auth.uid();
  -- Registro durable en la tabla existente, NO entrega push. El proveedor pendiente
  -- debe consumir estas notificaciones con reintentos sin divulgar el cuerpo del chat.
  insert into public.notificaciones(destinatario_id,titulo,cuerpo,tipo,datos)
    select p.id,
      case when v_rol='mozo' then 'Respuesta del mozo' else 'Nueva consulta' end
        || ' — Mesa ' || (v_contexto->>'numero_mesa'),
      'Abrí la conversación para ver el mensaje.',
      case when v_rol='mozo' then 'respuesta_mozo' else 'consulta_mozo' end,
      jsonb_build_object('estadia_id',p_estadia_id,'mensaje_id',p_id)
    from public.perfiles p where p.activo and (
      (v_rol='mozo' and p.id=(v_contexto->>'cliente_id')::uuid) or
      (v_rol<>'mozo' and p.rol='mozo' and p.estado='aprobado')
    );
  return to_jsonb(v_msg);
end $$;

-- Superficie RPC mínima. Los helpers privilegiados viven en un schema NO expuesto
-- por Data API; auth.uid() se comprueba allí en cada llamada y no viene del cliente.
create function public.hu11_contexto_mesa(p_estadia_id uuid default null) returns jsonb
language sql security invoker set search_path='' as $$ select hu11_privado.contexto(p_estadia_id) $$;
create function public.hu11_validar_qr_mesa(p_token uuid) returns jsonb
language sql security invoker set search_path='' as $$ select hu11_privado.validar_qr(p_token) $$;
create function public.hu11_conversaciones_mozo() returns jsonb
language sql security invoker set search_path='' as $$ select hu11_privado.conversaciones() $$;
create function public.hu11_listar_mensajes(p_estadia_id uuid,p_antes timestamptz default null,p_antes_id uuid default null) returns jsonb
language sql security invoker set search_path='' as $$ select hu11_privado.listar_mensajes(p_estadia_id,p_antes,p_antes_id) $$;
create function public.hu11_enviar_mensaje(p_estadia_id uuid,p_cuerpo text,p_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select hu11_privado.enviar(p_estadia_id,p_cuerpo,p_id) $$;

revoke all on all functions in schema hu11_privado from public, anon;
grant execute on all functions in schema hu11_privado to authenticated;
revoke execute on function hu11_privado.proteger_asignacion() from authenticated;
revoke execute on function public.hu11_contexto_mesa(uuid), public.hu11_validar_qr_mesa(uuid),
  public.hu11_conversaciones_mozo(), public.hu11_listar_mensajes(uuid,timestamptz,uuid),
  public.hu11_enviar_mensaje(uuid,text,uuid) from public, anon;
grant execute on function public.hu11_contexto_mesa(uuid), public.hu11_validar_qr_mesa(uuid),
  public.hu11_conversaciones_mozo(), public.hu11_listar_mensajes(uuid,timestamptz,uuid),
  public.hu11_enviar_mensaje(uuid,text,uuid) to authenticated;
-- mensajes ya pertenece a supabase_realtime; no se modifica la publicación.
commit;
