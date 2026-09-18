import './index.css';
import { crearAppHeader } from '../../../components/app-header/app-header.js';
import { crearGraficoEncuesta } from '../../../components/grafico-encuesta/grafico-encuesta.js';
import { ajustarVista } from '../../../components/lista-ajustada/lista-ajustada.js';
import { navegarA } from '../../../router.js';
import { obtenerResultadosEncuestas } from '../../../services/encuestas.service.js';

export function render(container) {
  container.innerHTML = `<ion-page class="resultados-hu20"><ion-content scroll-y="false"><div data-header></div>
    <main class="resultados-hu20__contenido" aria-busy="true">
      <section class="resultados-hu20__carga" role="status"><ion-spinner name="crescent"></ion-spinner><p>Preparando los resultados…</p></section>
      <section class="resultados-hu20__panel" hidden>
        <header class="resultados-hu20__resumen"><span aria-hidden="true">↗</span><div><strong data-indice></strong><small>Resultados generales y anónimos</small></div></header>
        <div class="resultados-hu20__grafico" data-grafico></div>
        <footer class="resultados-hu20__acciones"><button type="button" data-anterior>Anterior</button><div data-puntos></div><button type="button" data-siguiente>Siguiente</button></footer>
      </section>
      <section class="resultados-hu20__vacio" hidden><span>▥</span><h2>Todavía no hay resultados</h2><p>Cuando los clientes completen la encuesta, los gráficos aparecerán en esta sección.</p><button type="button">Volver</button></section>
    </main></ion-content></ion-page>`;
  container.querySelector('[data-header]').append(crearAppHeader({ titulo: 'Resultados', etiquetaVolver: 'Volver', onVolver: () => window.history.back() }));
  const contenido = container.querySelector('.resultados-hu20__contenido'); const carga = container.querySelector('.resultados-hu20__carga');
  const panel = container.querySelector('.resultados-hu20__panel'); const vacio = container.querySelector('.resultados-hu20__vacio');
  const zona = container.querySelector('[data-grafico]'); const puntos = container.querySelector('[data-puntos]');
  const anterior = container.querySelector('[data-anterior]'); const siguiente = container.querySelector('[data-siguiente]');
  let resultados = []; let indice = 0;
  vacio.querySelector('button').addEventListener('click', () => navegarA('/lista-espera'));
  function pintar() {
    const actual = resultados[indice]; const totalRespuestas = actual.datos.reduce((suma, dato) => suma + dato.cantidad, 0);
    container.querySelector('[data-indice]').textContent = `Gráfico ${indice + 1} de ${resultados.length} · ${totalRespuestas} respuestas`;
    zona.replaceChildren(crearGraficoEncuesta(actual).elemento);
    puntos.innerHTML = resultados.map((_, posicion) => `<span class="${posicion === indice ? 'activo' : ''}"></span>`).join('');
    anterior.disabled = indice === 0; siguiente.disabled = indice === resultados.length - 1;
  }
  anterior.addEventListener('click', () => { if (indice > 0) { indice -= 1; pintar(); } });
  siguiente.addEventListener('click', () => { if (indice < resultados.length - 1) { indice += 1; pintar(); } });
  obtenerResultadosEncuestas().then((datos) => {
    if (!contenido.isConnected) return; resultados = datos; carga.hidden = true;
    if (!resultados.length) { vacio.hidden = false; return; } panel.hidden = false; pintar();
  }).catch((error) => { carga.querySelector('p').textContent = error.message ?? 'No se pudieron cargar los resultados.'; })
    .finally(() => contenido.setAttribute('aria-busy', 'false'));
  const ajuste = ajustarVista(contenido, { variable: '--rh-ajuste', minimo: 0.84, maximo: 1.18 }); window.addEventListener('hashchange', () => ajuste.destruir(), { once: true });
}
