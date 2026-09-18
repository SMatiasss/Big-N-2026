import './index.css';
import { crearAppHeader } from '../../../components/app-header/app-header.js';
import { ajustarVista } from '../../../components/lista-ajustada/lista-ajustada.js';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { mostrarToastNormal } from '../../../components/toast-normal/toast-normal.js';
import { navegarA } from '../../../router.js';
import { obtenerEncuestaActiva, obtenerEstadoEncuesta, responderEncuesta } from '../../../services/encuestas.service.js';

function opcionesDe(valor) { return Array.isArray(valor) ? valor : (valor && typeof valor === 'object' ? valor : {}); }

function crearOpcion(texto, tipo, nombre, seleccionada, onCambio) {
  const label = document.createElement('label');
  label.className = 'encuesta-hu20__opcion';
  const input = document.createElement('input');
  input.type = tipo; input.name = nombre; input.value = texto; input.checked = seleccionada;
  input.addEventListener('change', onCambio);
  const marca = document.createElement('span'); marca.className = 'encuesta-hu20__marca';
  const contenido = document.createElement('span'); contenido.textContent = texto;
  label.append(input, marca, contenido);
  return label;
}

function crearControl(pregunta, valorGuardado, onCambio) {
  const control = document.createElement('div');
  control.className = `encuesta-hu20__control encuesta-hu20__control--${pregunta.control}`;
  const opciones = opcionesDe(pregunta.opciones);
  if (pregunta.control === 'rating') {
    for (let valor = Number(opciones.min ?? 1); valor <= Number(opciones.max ?? 5); valor += Number(opciones.paso ?? 1)) {
      const boton = document.createElement('button');
      boton.type = 'button'; boton.className = 'encuesta-hu20__estrella'; boton.textContent = '★';
      boton.setAttribute('aria-label', `${valor} de ${opciones.max ?? 5}`);
      boton.classList.toggle('encuesta-hu20__estrella--activa', Number(valorGuardado) >= valor);
      boton.addEventListener('click', () => onCambio(valor, true)); control.append(boton);
    }
  } else if (pregunta.control === 'radio' || pregunta.control === 'select' || pregunta.control === 'switch') {
    const lista = pregunta.control === 'switch' ? ['Sí', 'No'] : opciones;
    lista.forEach((opcion) => control.append(crearOpcion(opcion, 'radio', `p-${pregunta.id}`, valorGuardado === opcion, () => onCambio(opcion))));
  } else if (pregunta.control === 'checkbox') {
    const elegidas = new Set(Array.isArray(valorGuardado) ? valorGuardado : []);
    opciones.forEach((opcion) => control.append(crearOpcion(opcion, 'checkbox', `p-${pregunta.id}`, elegidas.has(opcion), (evento) => {
      if (evento.target.checked) elegidas.add(opcion); else elegidas.delete(opcion); onCambio([...elegidas]);
    })));
  } else if (pregunta.control === 'slider') {
    const min = Number(opciones.min ?? 0); const valor = valorGuardado ?? min;
    const salida = document.createElement('output'); salida.textContent = `${valor} min`;
    const input = document.createElement('input'); input.type = 'range'; input.min = String(min);
    input.max = String(opciones.max ?? 60); input.step = String(opciones.paso ?? 1); input.value = String(valor);
    input.addEventListener('input', () => { salida.textContent = `${input.value} min`; onCambio(Number(input.value)); });
    control.append(salida, input); queueMicrotask(() => onCambio(Number(valor)));
  } else {
    const textarea = document.createElement('textarea'); textarea.rows = 4; textarea.maxLength = 400;
    textarea.placeholder = 'Escribí tu opinión…'; textarea.value = valorGuardado ?? '';
    textarea.addEventListener('input', () => onCambio(textarea.value)); control.append(textarea);
  }
  return control;
}

function completa(pregunta, valor) {
  if (!pregunta.obligatoria) return true;
  return Array.isArray(valor) ? valor.length > 0 : valor !== undefined && valor !== null && String(valor).trim() !== '';
}
function serializar(pregunta, valor) {
  const base = { pregunta_id: pregunta.id };
  if (['rating', 'slider'].includes(pregunta.control)) return { ...base, valor_numerico: Number(valor) };
  if (pregunta.control === 'checkbox') return { ...base, valor_opciones: valor };
  return { ...base, valor_texto: String(valor).trim() };
}

export function render(container) {
  container.innerHTML = `<ion-page class="encuesta-hu20"><ion-content scroll-y="false"><div data-header></div>
    <main class="encuesta-hu20__contenido" aria-busy="true">
      <section class="encuesta-hu20__carga" role="status"><ion-spinner name="crescent"></ion-spinner><p>Preparando tu encuesta…</p></section>
      <section class="encuesta-hu20__panel" hidden>
        <header class="encuesta-hu20__progreso"><span class="encuesta-hu20__icono">✓</span><div><strong data-progreso></strong><span data-nombre></span></div></header>
        <div class="encuesta-hu20__barra"><span data-barra></span></div>
        <article class="encuesta-hu20__pregunta"><p data-obligatoria></p><h2 data-pregunta></h2><div data-control></div><p class="encuesta-hu20__ayuda" data-ayuda></p></article>
        <footer class="encuesta-hu20__acciones"><button type="button" class="encuesta-hu20__anterior">Anterior</button><button type="button" class="encuesta-hu20__siguiente">Siguiente</button></footer>
      </section>
      <section class="encuesta-hu20__bloqueo" hidden><span>✓</span><h2 data-bloqueo-titulo></h2><p data-bloqueo-texto></p><button type="button" data-resultados>Ver resultados</button></section>
    </main></ion-content></ion-page>`;
  container.querySelector('[data-header]').append(crearAppHeader({ titulo: 'Encuesta', etiquetaVolver: 'Volver al pedido', onVolver: () => navegarA('/pedidos/estado') }));
  const contenido = container.querySelector('.encuesta-hu20__contenido'); const carga = container.querySelector('.encuesta-hu20__carga');
  const panel = container.querySelector('.encuesta-hu20__panel'); const bloqueo = container.querySelector('.encuesta-hu20__bloqueo');
  const anterior = container.querySelector('.encuesta-hu20__anterior'); const siguiente = container.querySelector('.encuesta-hu20__siguiente');
  const respuestas = new Map(); let encuesta; let indice = 0; let enviando = false;
  container.querySelector('[data-resultados]').addEventListener('click', () => navegarA('/encuesta/resultados'));
  function bloquear(titulo, texto) { carga.hidden = true; panel.hidden = true; bloqueo.hidden = false; bloqueo.querySelector('[data-bloqueo-titulo]').textContent = titulo; bloqueo.querySelector('[data-bloqueo-texto]').textContent = texto; }
  function pintar() {
    const pregunta = encuesta.preguntas[indice]; const total = encuesta.preguntas.length;
    container.querySelector('[data-progreso]').textContent = `Pregunta ${indice + 1} de ${total}`; container.querySelector('[data-nombre]').textContent = encuesta.nombre;
    container.querySelector('[data-barra]').style.width = `${((indice + 1) / total) * 100}%`; container.querySelector('[data-obligatoria]').textContent = pregunta.obligatoria ? 'RESPUESTA OBLIGATORIA' : 'OPCIONAL';
    container.querySelector('[data-pregunta]').textContent = pregunta.texto;
    const zona = container.querySelector('[data-control]'); zona.replaceChildren(crearControl(pregunta, respuestas.get(pregunta.id), (valor, repintar = false) => { respuestas.set(pregunta.id, valor); if (repintar) pintar(); }));
    container.querySelector('[data-ayuda]').textContent = pregunta.control === 'checkbox' ? 'Podés elegir más de una opción.' : pregunta.control === 'texto' ? 'Máximo 400 caracteres.' : 'Elegí la opción que mejor represente tu experiencia.';
    anterior.disabled = indice === 0; siguiente.textContent = indice === total - 1 ? 'Enviar encuesta' : 'Siguiente';
  }
  anterior.addEventListener('click', () => { if (indice > 0) { indice -= 1; pintar(); } });
  siguiente.addEventListener('click', async () => {
    if (enviando) return; const pregunta = encuesta.preguntas[indice];
    if (!completa(pregunta, respuestas.get(pregunta.id))) { mostrarToastError('Completá esta pregunta para continuar.'); return; }
    if (indice < encuesta.preguntas.length - 1) { indice += 1; pintar(); return; }
    const faltante = encuesta.preguntas.find((item) => !completa(item, respuestas.get(item.id)));
    if (faltante) { indice = encuesta.preguntas.indexOf(faltante); pintar(); mostrarToastError('Completá las preguntas obligatorias.'); return; }
    enviando = true; siguiente.disabled = true; siguiente.textContent = 'Enviando…';
    try {
      const payload = encuesta.preguntas.filter((item) => respuestas.has(item.id) && (Array.isArray(respuestas.get(item.id)) || String(respuestas.get(item.id)).trim() !== '')).map((item) => serializar(item, respuestas.get(item.id)));
      await responderEncuesta(encuesta.id, payload); mostrarToastNormal('¡Gracias! Tu opinión fue registrada.');
      bloquear('Encuesta completada', 'Tu respuesta quedó guardada para esta estadía. Ahora podés consultar los resultados generales.');
    } catch (error) { mostrarToastError(error.message ?? 'No se pudo enviar la encuesta.'); siguiente.disabled = false; siguiente.textContent = 'Enviar encuesta'; } finally { enviando = false; }
  });
  obtenerEncuestaActiva().then(async (activa) => {
    if (!contenido.isConnected) return; if (!activa?.preguntas?.length) { bloquear('Encuesta no disponible', 'Todavía no hay una encuesta activa.'); return; }
    encuesta = activa; const estado = await obtenerEstadoEncuesta(encuesta.id); if (!contenido.isConnected) return;
    if (estado.respondida) { bloquear('Ya participaste', 'Se permite una sola respuesta por estadía. Tus respuestas no se pueden modificar.'); return; }
    if (!estado.habilitada) { bloquear('Disponible después de recibir tu pedido', 'Confirmá la recepción del pedido para compartir tu experiencia.'); return; }
    carga.hidden = true; panel.hidden = false; pintar();
  }).catch((error) => bloquear('No pudimos cargar la encuesta', error.message ?? 'Intentá nuevamente.')).finally(() => contenido.setAttribute('aria-busy', 'false'));
  const ajuste = ajustarVista(contenido, { variable: '--eh-ajuste', minimo: 0.82, maximo: 1.16 }); window.addEventListener('hashchange', () => ajuste.destruir(), { once: true });
}
