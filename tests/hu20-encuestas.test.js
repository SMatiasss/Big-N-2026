import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let rpcResultado;
let llamadas;
const cliente = {
  rpc: async (nombre, parametros) => {
    llamadas.push({ nombre, parametros });
    return rpcResultado;
  },
};

mock.module('../src/services/supabase.client.js', {
  namedExports: { getSupabase: () => cliente },
});

const servicio = await import('../src/services/encuestas.service.js');

beforeEach(() => {
  llamadas = [];
  rpcResultado = { data: null, error: null };
});

test('envía cabecera e ítems mediante una única RPC transaccional', async () => {
  rpcResultado = { data: 'respuesta-id', error: null };
  const respuestas = [{ pregunta_id: 'pregunta-id', valor_numerico: 5 }];
  assert.equal(await servicio.responderEncuesta(1, respuestas), 'respuesta-id');
  assert.deepEqual(llamadas, [{
    nombre: 'enviar_encuesta',
    parametros: { p_encuesta_id: 1, p_respuestas: respuestas },
  }]);
});

test('agrupa resultados anónimos por pregunta para mostrar un gráfico por pantalla', async () => {
  rpcResultado = { data: [
    { encuesta_id: 1, pregunta_id: 'p1', pregunta: 'Comida', control: 'radio', valor: 'Buena', cantidad: 3, porcentaje: 75 },
    { encuesta_id: 1, pregunta_id: 'p1', pregunta: 'Comida', control: 'radio', valor: 'Regular', cantidad: 1, porcentaje: 25 },
    { encuesta_id: 1, pregunta_id: 'p2', pregunta: 'Atención', control: 'rating', valor: '5', cantidad: 2, porcentaje: 100 },
  ], error: null };
  const resultado = await servicio.obtenerResultadosEncuestas();
  assert.equal(resultado.length, 2);
  assert.equal(resultado[0].datos.length, 2);
  assert.deepEqual(resultado[0].datos[0], { valor: 'Buena', cantidad: 3, porcentaje: 75 });
  assert.equal(llamadas[0].nombre, 'obtener_resultados_encuestas');
});

test('la migración aplica unicidad, validación de pedido y no publica comentarios', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260918033048_hu20_encuestas_seguras.sql', import.meta.url), 'utf8');
  assert.match(sql, /p\.estado = 'entregado'/);
  assert.match(sql, /Ya respondiste la encuesta durante esta estadía/);
  assert.match(sql, /where p\.control <> 'texto'/);
  assert.match(sql, /revoke all on function public\.enviar_encuesta/);
});

test('las pantallas usan navegación individual y acceso histórico desde la espera', async () => {
  const resultados = await readFile(new URL('../src/pages/encuesta/resultados-encuesta/index.js', import.meta.url), 'utf8');
  const espera = await readFile(new URL('../src/pages/lista-espera/anuncio-cliente/index.js', import.meta.url), 'utf8');
  assert.match(resultados, /Gráfico \$\{indice \+ 1\} de/);
  assert.match(resultados, /replaceChildren\(crearGraficoEncuesta\(actual\)\.elemento\)/);
  assert.match(espera, /Resultados de satisfacción/);
  assert.match(espera, /\/encuesta\/resultados/);
});

test('el entorno de demostración genera encuestas durante al menos cuatro semanas', async () => {
  const seed = await readFile(new URL('../supabase/migrations/02_seed.sql', import.meta.url), 'utf8');
  assert.match(seed, /for v_dia in reverse 27\.\.0 loop/);
  assert.match(seed, /insert into respuestas \(encuesta_id, estadia_id, cliente_id, creado_en\)/);
  assert.match(seed, /v_inicio \+ interval '70 minutes'/);
  assert.match(seed, /update mesas set estado = 'libre'/);
});

test('los reportes diferencian categorías, explican cantidades y muestran el eje Y', async () => {
  const grafico = await readFile(new URL('../src/components/grafico-encuesta/grafico-encuesta.js', import.meta.url), 'utf8');
  const carta = await readFile(new URL('../src/pages/productos/carta/index.js', import.meta.url), 'utf8');
  assert.match(grafico, /#dda15e.*#fefae0.*#91a35b.*#bc6c25.*#283618/);
  assert.match(grafico, /Respuestas: \$\{d\.cantidad\}/);
  assert.match(grafico, /Math\.min\(100, porcentajeInformado\)/);
  assert.match(grafico, /grafico-encuesta__eje-y/);
  assert.match(grafico, />Cantidad de Respuestas<\/text>/);
  assert.match(grafico, /control === 'slider' \? 'Minutos' : 'Valoración'/);
  assert.match(grafico, /alto - margen\.abajo \+ 15/);
  assert.doesNotMatch(carta, /Probar juegos HU15/);
});
