import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { puedeAccederRuta } from '../src/config/navegacion.js';
import { anguloFinalRuleta, revelarMemotest } from '../src/utils/juegos.js';

test('HU15 restringe catálogo y juegos al cliente registrado', () => {
  assert.equal(puedeAccederRuta('/juegos', 'cliente_registrado'), true);
  assert.equal(puedeAccederRuta('/pedidos/aceptado', 'cliente_registrado'), true);
  assert.equal(puedeAccederRuta('/juegos', 'cliente_anonimo'), false);
  assert.equal(puedeAccederRuta('/juegos', 'mozo'), false);
});

test('el catálogo comunica las tres reglas y porcentajes de HU15', async () => {
  const codigo = await readFile(new URL('../src/pages/juegos/index.js', import.meta.url), 'utf8');
  assert.match(codigo, /primer intento/);
  assert.match(codigo, /no acumulativo/);
  assert.match(codigo, /todas las veces que quieras/);
  assert.match(codigo, /porcentaje: 10/);
  assert.match(codigo, /porcentaje: 15/);
  assert.match(codigo, /porcentaje: 20/);
});

test('el acceso desde la carta no escribe partidas ni descuentos por sí mismo', async () => {
  const carta = await readFile(new URL('../src/pages/productos/carta/index.js', import.meta.url), 'utf8');
  const aceptado = await readFile(new URL('../src/pages/pedidos/pedido-aceptado/index.js', import.meta.url), 'utf8');
  assert.match(carta, /contexto\.rol === 'cliente_registrado'/);
  assert.match(carta, /Probar juegos HU15/);
  assert.doesNotMatch(aceptado, /registrarPartida|aplicarDescuento|\.from\(/);
});

test('el servicio no permite indicar un porcentaje de descuento desde el cliente', async () => {
  const servicio = await readFile(new URL('../src/services/juegos.service.js', import.meta.url), 'utf8');
  assert.doesNotMatch(servicio, /export async function aplicarDescuento/);
  assert.doesNotMatch(servicio, /\.update\(\{\s*descuento/);
  assert.match(servicio, /rpc\('hu15_jugar'/);
  assert.doesNotMatch(servicio, /p_gano|gano:/);
});

test('los tres juegos reales invocan el resultado transaccional', async () => {
  for (const numero of [1, 2, 3]) {
    const codigo = await readFile(new URL(`../src/pages/juegos/juego-${numero}/index.js`, import.meta.url), 'utf8');
    assert.match(codigo, /await jugar\(/);
    assert.doesNotMatch(codigo, /Math\.random/);
  }
});

test('memotest normaliza el orden de las dos cartas seleccionadas', async () => {
  const codigo = await readFile(new URL('../src/pages/juegos/juego-1/index.js', import.meta.url), 'utf8');
  assert.match(codigo, /\.sort\(\(a, b\) => a - b\)/);
});

test('memotest revela exactamente dos pares de símbolos', () => {
  for (let objetivo = 1; objetivo <= 6; objetivo += 1) {
    const simbolos = revelarMemotest(objetivo);
    assert.equal(simbolos.length, 4);
    assert.deepEqual([...new Set(simbolos)].sort(), ['🍴', '🍰'].sort());
    assert.equal(simbolos.filter(s => s === '🍴').length, 2);
    assert.equal(simbolos.filter(s => s === '🍰').length, 2);
  }
});

test('la ruleta calcula un ángulo distinto y válido para cada sector', () => {
  const angulos = Array.from({ length: 8 }, (_, sector) => anguloFinalRuleta(sector));
  assert.equal(new Set(angulos).size, 8);
  assert.deepEqual(angulos, [1057.5, 1012.5, 967.5, 922.5, 877.5, 832.5, 787.5, 742.5]);
});

test('el juego del 20% se presenta como Rueda de la Fortuna', async () => {
  const catalogo = await readFile(new URL('../src/pages/juegos/index.js', import.meta.url), 'utf8');
  const pantalla = await readFile(new URL('../src/pages/juegos/juego-3/index.js', import.meta.url), 'utf8');
  assert.match(catalogo, /nombre: 'Rueda de la Fortuna'/);
  assert.match(pantalla, /titulo: 'Rueda de la Fortuna'/);
  assert.doesNotMatch(catalogo, /nombre: 'Ruleta'/);
});

test('caja premiada revela hamburguesa y ruleta conserva geometría circular', async () => {
  const caja = await readFile(new URL('../src/pages/juegos/juego-2/index.js', import.meta.url), 'utf8');
  const estilos = await readFile(new URL('../src/pages/juegos/juego.css', import.meta.url), 'utf8');
  assert.match(caja, /🍔/);
  assert.match(estilos, /aspect-ratio:\s*1 \/ 1/);
  assert.match(estilos, /border-radius:\s*50%/);
  assert.match(estilos, /\.ruleta-svg/);
  assert.match(estilos, /juego-hu15__marcador/);
  const ruleta = await readFile(new URL('../src/pages/juegos/juego-3/index.js', import.meta.url), 'utf8');
  assert.match(ruleta, /viewBox="0 0 300 300"/);
  assert.match(ruleta, /20% de descuento/);
  assert.match(ruleta, /Sin premio/);
  assert.match(ruleta, /indice % 2 === 0/);
});

test('la migración protege primer intento, descuento único y cliente registrado', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260915042740_hu15_juegos_descuentos_seguros.sql', import.meta.url), 'utf8');
  assert.match(sql, /v_intento = 1/);
  assert.match(sql, /descuento_pct = 0/);
  assert.match(sql, /cliente_registrado/);
  assert.match(sql, /revoke insert, update, delete on public\.partidas/);
  assert.match(sql, /security definer\s+set search_path = ''/);
  assert.match(sql, /revoke execute on function public\.hu15_jugar.*from public, anon/);
});
