// Prueba del controlador con DOM mínimo, no reemplaza validación visual Android.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { validarMensaje, haySaltoEnHistorial } from '../src/utils/hu11.js';
import { crearActualizacionHu11 } from '../src/utils/actualizacion-hu11.js';

test('doble submit del controlador produce una sola llamada y bloquea el botón', async()=>{
  const nodo=()=>({hidden:false,disabled:false,value:'',textContent:'',children:[],
    scrollHeight:0,scrollTop:0,clientHeight:0,
    append(...h){this.children.push(...h);},replaceChildren(...h){this.children=h;}});
  const nodos=new Map();
  const raiz={isConnected:true,querySelector:s=>{
    if(!nodos.has(s))nodos.set(s,nodo());return nodos.get(s);
  }};
  const form=raiz.querySelector('form');
  form.elements={mensaje:nodo()};const boton=nodo();form.querySelector=()=>boton;
  let resolver, envios=0;
  const pendiente=new Promise(resolve=>{resolver=resolve;});
  const codigo=(await readFile(new URL('../src/pages/pedidos/consulta-mozo/index.js',import.meta.url),'utf8'))
    .replace(/^import .*;\r?$/gm,'').replace('export async function render','async function render');
  const render=vm.runInNewContext(`${codigo}\nrender`,{
    document:{createElement:nodo},crypto,validarMensaje,haySaltoEnHistorial,
    obtenerPerfilActual:async()=>({id:'cliente',rol:'cliente_registrado',estado:'aprobado',activo:true}),
    obtenerContextoMesa:async()=>({estadia_id:'visita',numero_mesa:7}),
    listarMensajes:async()=>[],crearBurbujaChat:nodo,navegarA:()=>{},
    enviarMensaje:async()=>{envios++;await pendiente;},
    suscribirseAMensajes:()=>()=>{},
    crearActualizacionHu11:(_r,fn,error)=>({alSalir:()=>{},actualizar:async()=>{try{await fn(()=>true);}catch(e){error(e);}}}),
  });
  await render({firstElementChild:raiz});
  form.elements.mensaje.value='Cubiertos';
  const envio=form.onsubmit({preventDefault(){}});
  await form.onsubmit({preventDefault(){}});
  assert.equal(envios,1);assert.equal(boton.disabled,true);
  resolver();await envio;
  assert.equal(boton.disabled,false);assert.equal(form.elements.mensaje.value,'');
});

test('actualización serializa eventos y limpia intervalo/listeners al salir', async t=>{
  const ventana=new EventTarget(), documento=new EventTarget();documento.hidden=false;
  globalThis.window=ventana;globalThis.document=documento;
  t.mock.timers.enable({apis:['setInterval']});
  try {
    let consultas=0,limpiezas=0,liberar,vigente;
    const pendiente=new Promise(resolve=>{liberar=resolve;});
    const refresco=crearActualizacionHu11({isConnected:true},async v=>{
      consultas++;vigente=v;await pendiente;
    },()=>assert.fail('error inesperado'));
    refresco.alSalir(()=>limpiezas++);
    const primera=refresco.actualizar();
    await refresco.actualizar();
    assert.equal(consultas,1);
    liberar();await primera;await Promise.resolve();
    assert.equal(consultas,2);
    ventana.dispatchEvent(new Event('hashchange'));
    assert.equal(limpiezas,1);assert.equal(vigente(),false);
    ventana.dispatchEvent(new Event('online'));
    documento.dispatchEvent(new Event('visibilitychange'));
    t.mock.timers.tick(60000);await refresco.actualizar();
    assert.equal(consultas,2);
  } finally {delete globalThis.window;delete globalThis.document;t.mock.timers.reset();}
});
