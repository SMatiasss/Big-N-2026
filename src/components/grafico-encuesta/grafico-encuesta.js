import './grafico-encuesta.css';

// Sin librería externa (evita sumar peso/dependencias de red para algo que
// se resuelve con SVG a mano, mismo criterio que se usó para el ícono del
// botón flotante). Recibe filas ya agregadas de v_resultados_encuestas
// (pregunta_id, pregunta, control, valor, cantidad) para UNA pregunta.

const PALETA = ['#7a3b2e', '#3e6259', '#c98a3e', '#5b7fa6', '#8a5a8f', '#4a8f5c'];

// El PDF pide variedad de gráficos según el tipo de pregunta, no todos
// iguales. No hay una columna que diga explícitamente qué gráfico usar, así
// que se deriva del tipo de control de la pregunta:
// radio/select/switch (opción única) -> torta, checkbox (multi-opción) -> barra,
// rating/slider (escala numérica) -> lineal, texto libre -> lista simple.
const TIPO_POR_CONTROL = {
  radio: 'torta',
  select: 'torta',
  switch: 'torta',
  checkbox: 'barra',
  rating: 'lineal',
  slider: 'lineal',
  texto: 'lista',
};

function crearGraficoTorta(datos) {
  const total = datos.reduce((acc, d) => acc + Number(d.cantidad), 0);
  if (total === 0) return '<p class="grafico-encuesta__vacio">Sin respuestas todavía.</p>';

  const radio = 70;
  const cx = 80;
  const cy = 80;
  let anguloActual = -90;

  const slices = datos.map((d, indice) => {
    const porcentaje = Number(d.cantidad) / total;
    const color = PALETA[indice % PALETA.length];

    if (porcentaje >= 0.9999) {
      return `<circle cx="${cx}" cy="${cy}" r="${radio}" fill="${color}" />`;
    }

    const anguloInicio = anguloActual;
    anguloActual += porcentaje * 360;
    const anguloFin = anguloActual;
    const x1 = cx + radio * Math.cos((Math.PI / 180) * anguloInicio);
    const y1 = cy + radio * Math.sin((Math.PI / 180) * anguloInicio);
    const x2 = cx + radio * Math.cos((Math.PI / 180) * anguloFin);
    const y2 = cy + radio * Math.sin((Math.PI / 180) * anguloFin);
    const arcoLargo = anguloFin - anguloInicio > 180 ? 1 : 0;

    return `<path d="M${cx},${cy} L${x1},${y1} A${radio},${radio} 0 ${arcoLargo},1 ${x2},${y2} Z" fill="${color}" />`;
  }).join('');

  const referencias = datos.map((d, indice) => `
    <li><span class="grafico-encuesta__punto" style="background:${PALETA[indice % PALETA.length]}"></span>${d.valor} (${d.cantidad})</li>
  `).join('');

  return `
    <svg viewBox="0 0 160 160" role="img" aria-label="Gráfico de torta">${slices}</svg>
    <ul class="grafico-encuesta__referencias">${referencias}</ul>
  `;
}

function crearGraficoBarra(datos) {
  const max = Math.max(...datos.map((d) => Number(d.cantidad)), 1);

  const filas = datos.map((d, indice) => {
    const porcentaje = (Number(d.cantidad) / max) * 100;
    const color = PALETA[indice % PALETA.length];
    return `
      <li class="grafico-encuesta__fila-barra">
        <span class="grafico-encuesta__etiqueta-barra">${d.valor}</span>
        <span class="grafico-encuesta__pista-barra">
          <span class="grafico-encuesta__barra" style="width:${porcentaje}%;background:${color}"></span>
        </span>
        <span class="grafico-encuesta__cantidad-barra">${d.cantidad}</span>
      </li>
    `;
  }).join('');

  return `<ul class="grafico-encuesta__lista-barras">${filas}</ul>`;
}

function crearGraficoLineal(datos) {
  const ordenado = [...datos].sort((a, b) => Number(a.valor) - Number(b.valor));
  const max = Math.max(...ordenado.map((d) => Number(d.cantidad)), 1);
  const ancho = 220;
  const alto = 120;
  const paso = ordenado.length > 1 ? ancho / (ordenado.length - 1) : 0;

  const puntos = ordenado.map((d, indice) => ({
    x: ordenado.length > 1 ? indice * paso : ancho / 2,
    y: alto - (Number(d.cantidad) / max) * (alto - 24) - 14,
    valor: d.valor,
  }));

  const puntosLinea = puntos.map((p) => `${p.x},${p.y}`).join(' ');
  const circulos = puntos.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#7a3b2e" />`).join('');

  // Con muchos valores distintos (por ejemplo minutos de espera en un slider
  // de rango amplio) escribir una etiqueta por punto las amontona y se
  // vuelven ilegibles; se muestra como máximo una decena, salteando el resto.
  const cadaCuantos = Math.max(1, Math.ceil(puntos.length / 10));
  const etiquetas = puntos
    .filter((_, indice) => indice % cadaCuantos === 0 || indice === puntos.length - 1)
    .map((p) => `<text x="${p.x}" y="${alto - 2}" font-size="10" text-anchor="middle">${p.valor}</text>`)
    .join('');

  return `
    <svg viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Gráfico lineal">
      <polyline points="${puntosLinea}" fill="none" stroke="#7a3b2e" stroke-width="2" />
      ${circulos}
      ${etiquetas}
    </svg>
  `;
}

function crearListaTexto(datos) {
  const filas = datos.map((d) => `<li>${d.valor} <span>(${d.cantidad})</span></li>`).join('');
  return `<ul class="grafico-encuesta__lista-texto">${filas}</ul>`;
}

// pregunta: texto de la pregunta. control: tipo_control de la pregunta
// (define qué gráfico se dibuja). datos: [{ valor, cantidad }] ya agregados.
export function crearGraficoEncuesta({ pregunta, control, datos = [] }) {
  const elemento = document.createElement('article');
  elemento.className = 'grafico-encuesta';

  const tipo = TIPO_POR_CONTROL[control] ?? 'barra';
  const cuerpo = {
    torta: crearGraficoTorta,
    lineal: crearGraficoLineal,
    lista: crearListaTexto,
    barra: crearGraficoBarra,
  }[tipo](datos);

  elemento.innerHTML = `
    <h3 class="grafico-encuesta__titulo">${pregunta}</h3>
    <div class="grafico-encuesta__cuerpo grafico-encuesta__cuerpo--${tipo}">${cuerpo}</div>
  `;

  return { elemento };
}
