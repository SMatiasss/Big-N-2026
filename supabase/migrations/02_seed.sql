-- ============================================================
-- TFI - Datos iniciales y simulación de cuatro semanas
-- Ejecutar DESPUÉS de 01_schema.sql
-- ============================================================
-- Los usuarios se crean directamente en auth.users. Esto sirve para
-- desarrollo y para la demo; en un entorno real se harían con la Auth API.
-- Clave de todos los usuarios de prueba: 111111
-- ============================================================

-- ------------------------------------------------------------
-- 1. USUARIOS DE INGRESO RÁPIDO
-- ------------------------------------------------------------

create or replace function crear_usuario_demo(
  p_email text, p_apellidos text, p_nombres text,
  p_dni text, p_cuil text, p_rol rol_usuario
) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token,
    email_change, email_change_token_new,
    email_change_token_current, phone_change,
    phone_change_token, reauthentication_token
  ) values (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    p_email, extensions.crypt('111111', extensions.gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object('provider','email','providers',array['email']),
    '{}'::jsonb,
    -- Supabase Auth espera string vacío en estas columnas, nunca NULL:
    -- si quedan en NULL, el login falla con "converting NULL to string
    -- is unsupported" (error real que apareció al probar el seed).
    '', '', '', '', '', '', '', ''
  );

  insert into perfiles (id, apellidos, nombres, dni, cuil, email, rol, estado, foto_url)
  values (v_id, p_apellidos, p_nombres, p_dni, p_cuil, p_email, p_rol, 'aprobado',
          'perfiles/' || p_rol::text || '.jpg');

  return v_id;
end $$;

select crear_usuario_demo('dueno@larosaria.com',      'Pereyra',  'Ricardo',  '20111222', '20-20111222-3', 'dueno');
select crear_usuario_demo('supervisor@larosaria.com', 'Gómez',    'Marcela',  '25333444', '27-25333444-1', 'supervisor');
select crear_usuario_demo('metre@larosaria.com',      'Sosa',     'Damián',   '30444555', '20-30444555-9', 'metre');
select crear_usuario_demo('mozo@larosaria.com',       'Quiroga',  'Lucía',    '32555666', '27-32555666-4', 'mozo');
select crear_usuario_demo('cocinero@larosaria.com',   'Benítez',  'Hernán',   '28666777', '20-28666777-2', 'cocinero');
select crear_usuario_demo('cantinero@larosaria.com',  'Ledesma',  'Paula',    '34777888', '27-34777888-6', 'cantinero');
select crear_usuario_demo('cliente@mail.com',         'Ferrari',  'Julián',   '38888999', null,            'cliente_registrado');


-- ------------------------------------------------------------
-- 2. CLIENTES HISTÓRICOS (para poblar las cuatro semanas)
-- ------------------------------------------------------------

do $$
declare
  v_apellidos text[] := array['Álvarez','Rodríguez','Molina','Ibarra','Suárez','Peralta','Cabrera','Ojeda'];
  v_nombres   text[] := array['Camila','Tomás','Valeria','Nicolás','Sofía','Matías','Agustina','Bruno'];
begin
  for i in 1..8 loop
    perform crear_usuario_demo(
      'cliente' || i || '@mail.com',
      v_apellidos[i], v_nombres[i],
      (40000000 + i * 137)::text, null, 'cliente_registrado'
    );
  end loop;
end $$;


-- ------------------------------------------------------------
-- 3. MESAS (punto 4)
-- ------------------------------------------------------------

insert into mesas (numero, cantidad_comensales, tipo, foto_url) values
  (1, 2, 'estandar',           'mesas/mesa-01.jpg'),
  (2, 4, 'estandar',           'mesas/mesa-02.jpg'),
  (3, 6, 'vip',                'mesas/mesa-03.jpg'),
  (4, 4, 'movilidad_reducida', 'mesas/mesa-04.jpg'),
  (5, 8, 'vip',                'mesas/mesa-05.jpg');


-- ------------------------------------------------------------
-- 4. CARTA (puntos 2 y 3)
-- ------------------------------------------------------------

with cocinero as (select id from perfiles where rol = 'cocinero' limit 1),
     cantinero as (select id from perfiles where rol = 'cantinero' limit 1)
insert into productos (nombre, descripcion, tiempo_elaboracion_min, precio, tipo, sector, creado_por)
select * from (values
  ('Milanesa napolitana', 'Milanesa de ternera con jamón, salsa de tomate y muzzarella, con papas fritas.', 25, 14500.00, 'plato'::tipo_producto,  'cocina'::sector_trabajo, (select id from cocinero)),
  ('Bife de chorizo',     'Bife de 400 gramos a la parrilla con guarnición de ensalada mixta.',             30, 21000.00, 'plato',  'cocina', (select id from cocinero)),
  ('Ñoquis a la bolognesa','Ñoquis de papa caseros con salsa bolognesa y queso rallado.',                   20, 11800.00, 'plato',  'cocina', (select id from cocinero)),
  ('Trucha al limón',     'Trucha patagónica al horno con manteca de limón y papas noisette.',              35, 19500.00, 'plato',  'cocina', (select id from cocinero)),
  ('Risotto de hongos',   'Risotto carnaroli con hongos de pino y queso parmesano.',                        28, 15200.00, 'plato',  'cocina', (select id from cocinero)),
  ('Flan casero',         'Flan de huevo con dulce de leche y crema batida.',                                5,  5200.00, 'postre', 'cocina', (select id from cocinero)),
  ('Volcán de chocolate', 'Bizcocho tibio de chocolate con centro líquido y helado de vainilla.',           15,  6800.00, 'postre', 'cocina', (select id from cocinero)),
  ('Vino Malbec copa',    'Copa de Malbec de Mendoza, cosecha reciente.',                                    3,  4800.00, 'bebida', 'bar',    (select id from cantinero)),
  ('Cerveza artesanal IPA','Pinta de cerveza artesanal India Pale Ale, tirada del día.',                     4,  5600.00, 'bebida', 'bar',    (select id from cantinero)),
  ('Limonada con jengibre','Limonada casera con jengibre fresco y menta.',                                   6,  3900.00, 'bebida', 'bar',    (select id from cantinero)),
  ('Agua mineral',        'Botella de agua mineral de 500 mililitros, con o sin gas.',                        1,  2400.00, 'bebida', 'bar',    (select id from cantinero)),
  ('Café cortado',        'Café espresso cortado con leche, servido en taza de loza.',                        4,  2900.00, 'bebida', 'bar',    (select id from cantinero))
) as t;

-- Tres fotos por producto (punto 2 y 3)
insert into producto_fotos (producto_id, url, orden)
select p.id,
       'productos/' || replace(lower(p.nombre), ' ', '-') || '-' || n || '.jpg',
       n
from productos p, generate_series(1, 3) as n;


-- ------------------------------------------------------------
-- 5. ENCUESTA (punto 20, con variedad de controles)
-- ------------------------------------------------------------

insert into encuestas (id, nombre) values (1, 'Encuesta de satisfacción');

insert into preguntas (encuesta_id, texto, control, opciones, orden) values
  (1, '¿Cómo calificarías la atención del mozo?',
      'rating',   '{"min":1,"max":5,"paso":1}',                                        1),
  (1, '¿Cómo calificarías la comida?',
      'radio',    '["Excelente","Muy buena","Buena","Regular","Mala"]',                2),
  (1, '¿Qué te gustó del local?',
      'checkbox', '["La música","La limpieza","La iluminación","Los precios","La rapidez"]', 3),
  (1, '¿Cuánto tiempo esperaste tu pedido, en minutos?',
      'slider',   '{"min":0,"max":60,"paso":5}',                                       4),
  (1, '¿Recomendarías el restaurante?',
      'switch',   null,                                                                5),
  (1, 'Dejanos un comentario',
      'texto',    null,                                                                6);


-- ------------------------------------------------------------
-- 6. CUATRO SEMANAS DE ACTIVIDAD SIMULADA
-- ------------------------------------------------------------

do $$
declare
  v_clientes    uuid[];
  v_mesas       uuid[];
  v_productos   uuid[];
  v_metre       uuid := (select id from perfiles where rol = 'metre'  limit 1);
  v_mozo        uuid := (select id from perfiles where rol = 'mozo'   limit 1);
  v_preguntas   record;
  v_dia         integer;
  v_visita      integer;
  v_inicio      timestamptz;
  v_estadia     uuid;
  v_pedido      uuid;
  v_respuesta   uuid;
  v_producto    uuid;
  v_cant        integer;
  v_subtotal    numeric(12,2);
  v_desc        numeric(5,2);
  v_nivel       smallint;
  v_opts_gusto  text[] := array['La música','La limpieza','La iluminación','Los precios','La rapidez'];
begin
  select array_agg(id) into v_clientes  from perfiles where email like 'cliente%@mail.com';
  select array_agg(id) into v_mesas     from mesas;
  select array_agg(id) into v_productos from productos;

  for v_dia in reverse 27..0 loop
    for v_visita in 1..(2 + floor(random() * 3)::int) loop

      v_inicio := (current_date - v_dia) + time '12:00' + (random() * interval '9 hours');

      -- Estadía ya cerrada
      insert into estadias (cliente_id, mesa_id, asignada_por, estado,
                            descuento_pct, iniciada_en, cerrada_en)
      values (
        v_clientes[1 + floor(random() * array_length(v_clientes, 1))::int],
        v_mesas[1 + floor(random() * array_length(v_mesas, 1))::int],
        v_metre, 'cerrada',
        (array[0, 0, 0, 10, 15, 20])[1 + floor(random() * 6)::int],
        v_inicio,
        v_inicio + interval '90 minutes'
      )
      returning id, descuento_pct into v_estadia, v_desc;

      -- Pedido entregado
      insert into pedidos (estadia_id, estado, mozo_id, creado_en,
                           confirmado_en, entregado_en, recibido_en)
      values (v_estadia, 'entregado', v_mozo, v_inicio + interval '10 minutes',
              v_inicio + interval '14 minutes',
              v_inicio + interval '45 minutes',
              v_inicio + interval '48 minutes')
      returning id into v_pedido;

      v_subtotal := 0;

      -- Entre dos y cuatro productos distintos
      for v_producto in
        select id from productos order by random() limit (2 + floor(random() * 3)::int)
      loop
        v_cant := 1 + floor(random() * 3)::int;
        insert into pedido_items (pedido_id, producto_id, cantidad,
                                  precio_unitario, sector, estado)
        select v_pedido, p.id, v_cant, p.precio, p.sector, 'entregado'
          from productos p where p.id = v_producto;

        v_subtotal := v_subtotal + v_cant * (select precio from productos where id = v_producto);
      end loop;

      -- Cuenta cerrada con propina
      v_nivel := 1 + floor(random() * 5)::int;
      insert into cuentas (estadia_id, subtotal, descuento_pct, nivel_propina_id,
                           propina_pct, estado, solicitada_en, pagada_en,
                           confirmada_por, confirmada_en)
      select v_estadia, v_subtotal, v_desc, np.id, np.porcentaje, 'confirmada',
             v_inicio + interval '75 minutes',
             v_inicio + interval '82 minutes',
             v_mozo,
             v_inicio + interval '85 minutes'
        from niveles_propina np where np.id = v_nivel;

      -- Encuesta (aproximadamente el 70 por ciento de las estadías)
      if random() < 0.7 then
        insert into respuestas (encuesta_id, estadia_id, cliente_id, creado_en)
        select 1, v_estadia, e.cliente_id, v_inicio + interval '70 minutes'
          from estadias e where e.id = v_estadia
        returning id into v_respuesta;

        for v_preguntas in select id, control from preguntas where encuesta_id = 1 order by orden loop
          insert into respuesta_items (respuesta_id, pregunta_id,
                                       valor_numerico, valor_texto, valor_opciones)
          values (
            v_respuesta, v_preguntas.id,
            case v_preguntas.control
              when 'rating' then 1 + floor(random() * 5)
              when 'slider' then floor(random() * 13) * 5
              else null end,
            case v_preguntas.control
              when 'radio'  then (array['Excelente','Muy buena','Buena','Regular','Mala'])[1 + floor(random() * 5)::int]
              when 'switch' then (array['Sí','No'])[1 + floor(random() * 2)::int]
              when 'texto'  then (array[
                                   'Volvería sin dudarlo.',
                                   'La comida estuvo muy rica pero tardó un poco.',
                                   'Excelente atención del personal.',
                                   'El lugar es muy lindo y tranquilo.',
                                   'Los precios me parecieron razonables.'
                                 ])[1 + floor(random() * 5)::int]
              else null end,
            case v_preguntas.control
              when 'checkbox' then (
                select coalesce(
                  array_agg(o) filter (where random() < 0.45),
                  array[v_opts_gusto[1 + floor(random() * array_length(v_opts_gusto,1))::int]]
                )
                from unnest(v_opts_gusto) o
              )
              else null end
          );
        end loop;
      end if;

      -- Partidas de juegos en algunas estadías
      if v_desc > 0 then
        insert into partidas (estadia_id, juego_id, intento_nro, gano, jugada_en)
        select v_estadia, j.id, 1, true, v_inicio + interval '50 minutes'
          from juegos j where j.descuento_pct = v_desc limit 1;
      end if;

    end loop;
  end loop;

  -- Todas las estadías históricas están cerradas: las mesas quedan libres
  update mesas set estado = 'libre';
end $$;


-- ------------------------------------------------------------
-- 7. VERIFICACIÓN RÁPIDA
-- ------------------------------------------------------------

select 'perfiles'   as tabla, count(*) from perfiles
union all select 'productos',  count(*) from productos
union all select 'mesas',      count(*) from mesas
union all select 'estadias',   count(*) from estadias
union all select 'pedidos',    count(*) from pedidos
union all select 'items',      count(*) from pedido_items
union all select 'respuestas', count(*) from respuestas
union all select 'cuentas',    count(*) from cuentas;

-- Los QR que necesitás para el README y las pantallas
select 'ingreso' as tipo, null::integer as ref, valor as token from configuracion where clave = 'qr_ingreso_token'
union all
select 'mesa', numero, qr_token::text from mesas
union all
select 'propina', porcentaje::integer, qr_token::text from niveles_propina
order by 1, 2;