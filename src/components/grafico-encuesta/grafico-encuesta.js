import './grafico-encuesta.css';

// Sin librería externa (evita sumar peso/dependencias de red para algo que
// se resuelve con SVG a mano, mismo criterio que se usó para el ícono del
// botón flotante). Recibe filas ya agregadas de v_resultados_encuestas
// (pregunta_id, pregunta, control, valor, cantidad) para UNA pregunta.

// Tonos de la identidad Big N, alternados por luminosidad para que categorías
// contiguas (Excelente/Muy buena y Buena/Regular) no se confundan.
const PALETA = ['#dda15e', '#fefae0', '#91a35b', '#bc6c25', '#283618', '#f0bf78'];

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
      return `<circle cx="${cx}" cy="${cy}" r="${radio}" fill="${color}" stroke="#4a572c" stroke-width="2" />`;
    }

    const anguloInicio = anguloActual;
    anguloActual += porcentaje * 360;
    const anguloFin = anguloActual;
    const x1 = cx + radio * Math.cos((Math.PI / 180) * anguloInicio);
    const y1 = cy + radio * Math.sin((Math.PI / 180) * anguloInicio);
    const x2 = cx + radio * Math.cos((Math.PI / 180) * anguloFin);
    const y2 = cy + radio * Math.sin((Math.PI / 180) * anguloFin);
    const arcoLargo = anguloFin - anguloInicio > 180 ? 1 : 0;

    return `<path d="M${cx},${cy} L${x1},${y1} A${radio},${radio} 0 ${arcoLargo},1 ${x2},${y2} Z" fill="${color}" stroke="#4a572c" stroke-width="2" />`;
  }).join('');

  const referencias = datos.map((d, indice) => `
    <li><span class="grafico-encuesta__punto" style="background:${PALETA[indice % PALETA.length]}"></span><span>${d.valor}</span><strong>${d.porcentaje ?? Math.round(Number(d.cantidad) * 100 / total)}%</strong></li>
  `).join('');

  return `
    <svg viewBox="0 0 160 160" role="img" aria-label="Gráfico de torta">${slices}</svg>
    <ul class="grafico-encuesta__referencias">${referencias}</ul>
  `;
}

function crearGraficoBarra(datos) {
  const filas = datos.map((d) => {
    const porcentajeInformado = Number(String(d.porcentaje ?? '').replace(',', '.'));
    const porcentaje = Number.isFinite(porcentajeInformado)
      ? Math.max(0, Math.min(100, porcentajeInformado))
      : 0;
    return `
      <li class="grafico-encuesta__fila-barra">
        <span class="grafico-encuesta__etiqueta-barra">${d.valor}</span>
        <span class="grafico-encuesta__pista-barra" role="img" aria-label="${d.valor}: ${d.cantidad} respuestas, ${d.porcentaje ?? 0}%">
          <span class="grafico-encuesta__barra" style="width:${porcentaje}%"></span>
        </span>
        <span class="grafico-encuesta__cantidad-barra">Respuestas: ${d.cantidad} · ${d.porcentaje ?? ''}%</span>
      </li>
    `;
  }).join('');

  return `<ul class="grafico-encuesta__lista-barras">${filas}</ul>`;
}

function crearGraficoLineal(datos, etiquetaX) {
  const ordenado = [...datos].sort((a, b) => Number(a.valor) - Number(b.valor));
  const max = Math.max(...ordenado.map((d) => Number(d.cantidad)), 1);
  const ancho = 280;
  const alto = 170;
  const margen = { izquierda: 58, derecha: 10, arriba: 12, abajo: 42 };
  const anchoUtil = ancho - margen.izquierda - margen.derecha;
  const altoUtil = alto - margen.arriba - margen.abajo;
  const paso = ordenado.length > 1 ? anchoUtil / (ordenado.length - 1) : 0;

  const puntos = ordenado.map((d, indice) => ({
    x: ordenado.length > 1 ? margen.izquierda + indice * paso : margen.izquierda + anchoUtil / 2,
    y: margen.arriba + altoUtil - (Number(d.cantidad) / max) * altoUtil,
    valor: d.valor,
    cantidad: Number(d.cantidad),
  }));

  const puntosLinea = puntos.map((p) => `${p.x},${p.y}`).join(' ');
  const circulos = puntos.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="5" fill="#dda15e"><title>${p.cantidad} respuestas</title></circle>`).join('');

  const cantidadMarcas = Math.min(5, max);
  const marcasY = Array.from({ length: cantidadMarcas + 1 }, (_, indice) => {
    const valor = Math.round((max * indice) / cantidadMarcas);
    const y = margen.arriba + altoUtil - (valor / max) * altoUtil;
    return `<line x1="${margen.izquierda}" y1="${y}" x2="${ancho - margen.derecha}" y2="${y}" class="grafico-encuesta__grilla" />
      <text x="${margen.izquierda - 8}" y="${y + 4}" text-anchor="end" class="grafico-encuesta__eje-y">${valor}</text>`;
  }).join('');

  // Con muchos valores distintos (por ejemplo minutos de espera en un slider
  // de rango amplio) escribir una etiqueta por punto las amontona y se
  // vuelven ilegibles; se muestra como máximo una decena, salteando el resto.
  const cadaCuantos = Math.max(1, Math.ceil(puntos.length / 10));
  const etiquetas = puntos
    .filter((_, indice) => indice % cadaCuantos === 0 || indice === puntos.length - 1)
    .map((p) => `<text x="${p.x}" y="${alto - margen.abajo + 15}" font-size="10" text-anchor="middle">${p.valor}</text>`)
    .join('');

  return `
    <svg viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Gráfico lineal">
      ${marcasY}
      <line x1="${margen.izquierda}" y1="${margen.arriba}" x2="${margen.izquierda}" y2="${alto - margen.abajo}" class="grafico-encuesta__eje" />
      <line x1="${margen.izquierda}" y1="${alto - margen.abajo}" x2="${ancho - margen.derecha}" y2="${alto - margen.abajo}" class="grafico-encuesta__eje" />
      <text x="14" y="${margen.arriba + altoUtil / 2}" text-anchor="middle" transform="rotate(-90 14 ${margen.arriba + altoUtil / 2})" class="grafico-encuesta__titulo-eje">Cantidad de Respuestas</text>
      <text x="${margen.izquierda + anchoUtil / 2}" y="${alto - 4}" text-anchor="middle" class="grafico-encuesta__titulo-eje">${etiquetaX}</text>
      <polyline points="${puntosLinea}" fill="none" stroke="#dda15e" stroke-width="3" />
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
  const cuerpo = tipo === 'lineal'
    ? crearGraficoLineal(datos, control === 'slider' ? 'Minutos' : 'Valoración')
    : {
      torta: crearGraficoTorta,
      lista: crearListaTexto,
      barra: crearGraficoBarra,
    }[tipo](datos);

  elemento.innerHTML = `
    <h3 class="grafico-encuesta__titulo">${pregunta}</h3>
    <div class="grafico-encuesta__cuerpo grafico-encuesta__cuerpo--${tipo}">${cuerpo}</div>
  `;

  return { elemento };
}
