// PostgreSQL WASM en memoria: no abre conexiones, no usa .env ni copia usuarios.
// Reproduce roles Auth mediante claims ficticios; NO prueba GoTrue/PostgREST/Realtime.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const migracion = await readFile(new URL('../../supabase/migrations/20260903020318_hu11_mesa_chat_seguro.sql', import.meta.url), 'utf8');

test('HU11: migración y autorización en PostgreSQL aislado', async t => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
      grant usage on schema auth to anon,authenticated;
      create publication supabase_realtime;`);
    await db.exec(await readFile(new URL('../../supabase/migrations/01_schema.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../../supabase/migrations/03_baja_logica.sql', import.meta.url), 'utf8'));
    // Diferencia real del remoto: apellidos nullable sólo para cliente anónimo.
    await db.exec(`alter table perfiles alter column apellidos drop not null;
      alter table perfiles add constraint ck_apellidos_requerido check(rol='cliente_anonimo' or apellidos is not null);
      grant usage on schema public to anon,authenticated;
      grant all on all tables in schema public to anon,authenticated;
      revoke delete on perfiles,estadias from anon,authenticated;`);
    for (let n = 1; n <= 40; n++) await db.query('insert into auth.users(id) values($1)', [id(n)]);
    const roles = ['cliente_registrado','cliente_registrado','cliente_registrado','mozo','mozo','metre','cocinero','cantinero','dueno','supervisor','cliente_anonimo','mozo','cliente_registrado'];
    for (const [i, rol] of roles.entries()) {
      await db.query(`insert into perfiles(id,nombres,apellidos,dni,cuil,rol,activo,estado)
        values($1,'Prueba','Local',$2,$2,$3,$4,$5)`, [id(i+1),`ficticio-${i+1}`,rol,i!==11,i===12?'pendiente':'aprobado']);
    }
    for (const [n, cliente] of [[7,1],[8,2],[9,11]]) {
      await db.query('insert into mesas(id,numero,cantidad_comensales,qr_token) values($1,$2,2,$3)', [id(94+n),n,id(194+n)]);
      await db.query('insert into estadias(id,cliente_id,mesa_id,asignada_por) values($1,$2,$3,$4)', [id(294+n),id(cliente),id(94+n),id(6)]);
    }
    async function como(n, sql, args = [], { anonimo = false, rollback = false } = {}) {
      await db.exec('begin');
      try {
        await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({sub:n?id(n):null,is_anonymous:anonimo})]);
        await db.exec(`set local role ${n ? 'authenticated' : 'anon'}`);
        const resultado = await db.query(sql, args);
        await db.exec(rollback ? 'rollback' : 'commit');
        return resultado.rows;
      } catch (error) { await db.exec('rollback'); throw error; }
    }
    const rpc = (n, funcion, args = [], opciones) => como(n,
      `select public.${funcion}(${args.map((_,i)=>`$${i+1}`).join(',')}) as resultado`, args, opciones);
    const alta = rol => `insert into perfiles(id,nombres,apellidos,dni,cuil,rol) values('${id(14)}','Prueba','Alta','nuevo','nuevo','${rol}') returning rol`;
    const negar = promesa => assert.rejects(promesa, error => error.code === '42501');

    await t.test('reproduce autoasignación original de los seis roles sin persistirla', async () => {
      for (const rol of ['dueno','supervisor','metre','mozo','cocinero','cantinero']) {
        assert.equal((await como(14,alta(rol),[],{rollback:true}))[0].rol,rol);
      }
    });
    await t.test('aplica migración completa; rollback transaccional no deja objetos', async () => {
      await db.exec(migracion.replace(/commit;\s*$/, 'rollback;'));
      assert.equal((await db.query("select to_regprocedure('public.hu11_contexto_mesa(uuid)') as f")).rows[0].f,null);
      await db.exec(migracion);
    });
    await t.test('autoasignación de empleado bloqueada después de la corrección', async () => {
      for (const rol of ['dueno','supervisor','metre','mozo','cocinero','cantinero']) await negar(como(14,alta(rol)));
    });
    await t.test('alta propia registrada exige pendiente; anónima exige claim de Auth', async () => {
      await negar(como(14,alta('cliente_registrado')));
      await negar(como(14,alta('cliente_anonimo')));
      assert.equal((await como(14,alta('cliente_anonimo'),[],{anonimo:true,rollback:true}))[0].rol,'cliente_anonimo');
      await como(14,`insert into perfiles(id,nombres,apellidos,dni,rol,estado) values($1,'Test','Test','nuevo','cliente_registrado','pendiente')`,[id(14)],{rollback:true});
    });
    await t.test('jefe habilitado conserva alta administrativa; metre no crea empleados', async () => {
      await como(9,alta('mozo'),[],{rollback:true});
      assert.equal((await como(9,"update perfiles set estado='aprobado' where id=$1 returning id",[id(13)],{rollback:true})).length,1);
      await negar(como(6,alta('mozo')));
      await db.query('update perfiles set activo=false where id=$1',[id(9)]);
      assert.deepEqual(await como(9,'update perfiles set activo=true where id=$1 returning id',[id(9)]),[]);
      await db.query('update perfiles set activo=true where id=$1',[id(9)]);
    });
    await t.test('sin mesa o sin QR no puede abrir chat ni enviar', async () => {
      await negar(rpc(3,'hu11_contexto_mesa'));
      await negar(rpc(3,'hu11_enviar_mensaje',[id(301),'Hola',id(401)]));
      await negar(rpc(1,'hu11_contexto_mesa'));
    });
    await t.test('QR incorrecto informa mesa propia y no reasigna', async () => {
      await assert.rejects(rpc(1,'hu11_validar_qr_mesa',[id(202)]), /mesa asignada es la 7/);
      assert.equal((await db.query('select mesa_id from estadias where id=$1',[id(301)])).rows[0].mesa_id,id(101));
    });
    await t.test('QR correcto habilita sólo la visita propia', async () => {
      assert.equal((await rpc(1,'hu11_validar_qr_mesa',[id(201)]))[0].resultado.numero_mesa,7);
      await rpc(2,'hu11_validar_qr_mesa',[id(202)]);
    });
    await t.test('cliente persiste consulta con autor/fecha y fan-out a dos mozos', async () => {
      const msg=(await rpc(1,'hu11_enviar_mensaje',[id(301),'Cubiertos',id(401)]))[0].resultado;
      assert.equal(msg.autor_id,id(1)); assert.ok(msg.creado_en);
      assert.deepEqual((await db.query('select destinatario_id from notificaciones order by destinatario_id')).rows.map(r=>r.destinatario_id),[id(4),id(5)]);
    });
    await t.test('reintento conserva una fila y no duplica notificaciones', async () => {
      await rpc(1,'hu11_enviar_mensaje',[id(301),'Cubiertos',id(401)]);
      assert.equal((await db.query('select count(*)::int as n from mensajes')).rows[0].n,1);
      assert.equal((await db.query('select count(*)::int as n from notificaciones')).rows[0].n,2);
    });
    await t.test('cliente no lee ni escribe conversación ajena por RPC o SELECT', async () => {
      await negar(rpc(2,'hu11_listar_mensajes',[id(301)]));
      await negar(rpc(2,'hu11_enviar_mensaje',[id(301),'Ajeno',id(402)]));
      assert.deepEqual(await como(2,'select * from mensajes where estadia_id=$1',[id(301)]),[]);
      assert.equal((await como(1,'select * from mensajes')).length,1);
    });
    await t.test('dos mozos ven consulta; respuesta llega sólo al cliente', async () => {
      for (const n of [4,5]) assert.equal((await rpc(n,'hu11_listar_mensajes',[id(301)]))[0].resultado.length,1);
      await rpc(4,'hu11_enviar_mensaje',[id(301),'Ya vamos',id(402)]);
      const mensajes=(await rpc(1,'hu11_listar_mensajes',[id(301)]))[0].resultado;
      assert.equal(mensajes.length,2); assert.equal(mensajes[1].rol,'mozo'); assert.equal(mensajes[1].autor_id,id(4));
      assert.deepEqual((await db.query("select destinatario_id from notificaciones where tipo='respuesta_mozo'")).rows.map(r=>r.destinatario_id),[id(1)]);
    });
    await t.test('roles ajenos al chat y mozo inactivo rechazados', async () => {
      for (const n of [6,7,8,9,10,12,13]) {
        await negar(rpc(n,'hu11_listar_mensajes',[id(301)]));
        await negar(rpc(n,'hu11_enviar_mensaje',[id(301),'No autorizado',id(403)]));
        assert.deepEqual(await como(n,'select * from mensajes'),[]);
      }
    });
    await t.test('anon sin sesión bloqueado; invitado Auth sólo su propia visita', async () => {
      await negar(rpc(0,'hu11_listar_mensajes',[id(301)]));
      await negar(como(0,'select * from mensajes'));
      await rpc(11,'hu11_validar_qr_mesa',[id(203)],{anonimo:true});
      await negar(rpc(11,'hu11_listar_mensajes',[id(301)],{anonimo:true}));
      await rpc(11,'hu11_enviar_mensaje',[id(303),'Agua',id(403)],{anonimo:true});
    });
    await t.test('vacío y exceso se rechazan también en SQL', async () => {
      for (const cuerpo of ['', ' \n\t ', 'a'.repeat(1001)]) await assert.rejects(rpc(1,'hu11_enviar_mensaje',[id(301),cuerpo,id(404)]), e=>e.code==='22023');
    });
    await t.test('cliente/mozo no alteran identidad, mesa o asignador; INSERT directo bloqueado', async () => {
      for (const n of [1,4]) for (const col of ['mesa_id','cliente_id','asignada_por','lista_espera_id','id']) {
        await negar(como(n,`update estadias set ${col}=$1 where id=$2`,[id(40),id(301)]));
      }
      await negar(como(1,'insert into mensajes(autor_id,estadia_id,cuerpo) values($1,$2,$3)',[id(1),id(301),'Falso']));
      await negar(como(1,'truncate estadias cascade'));
    });
    await t.test('cierre bloquea nuevas lecturas/envíos y reapertura', async () => {
      await como(4,"update estadias set estado='cerrada' where id=$1",[id(301)]);
      await negar(rpc(1,'hu11_listar_mensajes',[id(301)]));
      await negar(rpc(4,'hu11_enviar_mensaje',[id(301),'Cerrada',id(404)]));
      await negar(como(1,"update estadias set estado='abierta' where id=$1",[id(301)]));
    });
    await t.test('privilegios, índices y search_path restringidos', async () => {
      assert.equal((await db.query("select has_table_privilege('authenticated','hu11_privado.accesos_mesa','INSERT') as p")).rows[0].p,false);
      assert.equal((await db.query("select has_function_privilege('anon','public.hu11_enviar_mensaje(uuid,text,uuid)','EXECUTE') as p")).rows[0].p,false);
      const funciones=(await db.query("select p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner) as owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='hu11_privado' and p.prosecdef")).rows;
      assert.ok(funciones.length); funciones.forEach(f=>{assert.ok(f.proconfig.some(v=>v.startsWith('search_path=')));assert.equal(f.owner,'postgres');});
      assert.equal((await db.query("select count(*)::int as n from pg_indexes where indexname='hu11_mensajes_estadia_fecha'")).rows[0].n,1);
    });
  } finally { await db.close(); }
});
