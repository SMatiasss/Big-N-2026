import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let llamadas = [];
const cliente = {
  auth: {
    getUser: async () => ({data:{user:{id:'propio'}},error:null}),
    getSession: async () => ({data:{session:{user:{id:'propio'}}},error:null}),
  },
  from(tabla) {
    llamadas.push(['from',tabla]);
    const q = {
      upsert: (...args) => { llamadas.push(['upsert',...args]); return q; },
      select: v=>{llamadas.push(['select',v]);return q;},
      eq: (...v)=>{llamadas.push(['eq',...v]);return q;},
      order: async (...v)=>{llamadas.push(['order',...v]);return {data:[],error:null};},
      single: async ()=>({data:{id:'fila',usuario_id:'propio',plataforma:'android',creado_en:'ahora'},error:null}),
    }; return q;
  },
};
globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
mock.module('@capacitor/core',{namedExports:{Capacitor:{getPlatform:()=> 'web'}}});
mock.module('@capacitor/push-notifications',{namedExports:{PushNotifications:{}}});
mock.module('../src/router.js',{namedExports:{navegarA:()=>{}}});
mock.module('../src/services/supabase.client.js',{namedExports:{getSupabase:()=>cliente}});
const servicio=await import('../src/services/notificaciones.service.js');
test('token exige propietario y plataforma; contrato usa columnas reales', async()=>{
  llamadas=[];
  await assert.rejects(servicio.guardarPushToken('propio',''),/inválido/);
  await assert.rejects(servicio.guardarPushToken('ajeno','ficticio','android'),/propio/);
  assert.equal(llamadas.length,0);
  assert.equal((await servicio.guardarPushToken('propio','ficticio','android')).usuario_id,'propio');
  assert.deepEqual(llamadas[1],['upsert',{usuario_id:'propio',token:'ficticio',plataforma:'android'},{onConflict:'token'}]);
});
test('listado de avisos filtra destinatario propio y fecha real', async()=>{
  llamadas=[];
  await servicio.listarNotificaciones('propio');
  assert.deepEqual(llamadas.find(c=>c[0]==='eq'),['eq','destinatario_id','propio']);
  assert.equal(llamadas.find(c=>c[0]==='order')[1],'creado_en');
});
test('Edge Function resuelve destinatarios en backend y usa Firebase privado', async()=>{
  const codigo=await readFile(new URL('../supabase/functions/enviar-push/index.ts',import.meta.url),'utf8');
  assert.match(codigo,/FIREBASE_SERVICE_ACCOUNT/);
  assert.match(codigo,/rol=in\.\(dueno,supervisor\)/);
  assert.doesNotMatch(codigo,/destinatarios?\s*=\s*body/i);
});
