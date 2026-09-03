import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

let llamadas = [];
const cliente = {
  auth: { getUser: async () => ({data:{user:{id:'propio'}},error:null}) },
  from(tabla) {
    llamadas.push(['from',tabla]);
    const q = {
      upsert: async (...args) => { llamadas.push(['upsert',...args]); return {error:null}; },
      select: v=>{llamadas.push(['select',v]);return q;},
      eq: (...v)=>{llamadas.push(['eq',...v]);return q;},
      order: async (...v)=>{llamadas.push(['order',...v]);return {data:[],error:null};},
    }; return q;
  },
};
mock.module('../src/services/supabase.client.js',{namedExports:{getSupabase:()=>cliente}});
const servicio=await import('../src/services/notificaciones.service.js');
test('token exige propietario y plataforma; contrato usa columnas reales', async()=>{
  llamadas=[];
  await assert.rejects(servicio.guardarPushToken('propio','ficticio'),/plataforma/);
  await assert.rejects(servicio.guardarPushToken('ajeno','ficticio','android'),/propias/);
  assert.equal(llamadas.length,0);
  assert.deepEqual(await servicio.guardarPushToken('propio','ficticio','android'),{registrado:true});
  assert.deepEqual(llamadas[1],['upsert',{usuario_id:'propio',token:'ficticio',plataforma:'android'},{onConflict:'token'}]);
});
test('listado de avisos filtra destinatario propio y fecha real', async()=>{
  llamadas=[];
  await servicio.listarNotificaciones('propio');
  assert.deepEqual(llamadas.find(c=>c[0]==='eq'),['eq','destinatario_id','propio']);
  assert.equal(llamadas.find(c=>c[0]==='order')[1],'creado_en');
});
test('Edge Function sin proveedor devuelve 503, nunca éxito ficticio', async()=>{
  let handler;
  vm.runInNewContext(await readFile(new URL('../supabase/functions/enviar-push/index.ts',import.meta.url),'utf8'),{
    Deno:{serve:fn=>{handler=fn;}}, Response, JSON,
  });
  const r=handler();
  assert.equal(r.status,503);
  assert.deepEqual(await r.json(),{ok:false,enviado:false,error:'PUSH_NO_CONFIGURADO'});
});
