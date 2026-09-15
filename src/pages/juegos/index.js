import './index.css';
import { crearAppHeader } from '../../components/app-header/app-header.js';
import { ajustarVista } from '../../components/lista-ajustada/lista-ajustada.js';
import { navegarA } from '../../router.js';

const JUEGOS_DEMO = [
  {
    id: 1,
    clase: 'memotest',
    nombre: 'Memotest',
    descripcion: 'Elegí dos cartas y encontrá la pareja premiada.',
    porcentaje: 10,
    ilustracion: '<svg viewBox="0 0 110 90" aria-hidden="true"><rect x="15" y="14" width="34" height="48" rx="5"/><rect x="60" y="27" width="34" height="48" rx="5"/><path d="M25 31h14M32 24v14M70 44h14M77 37v14"/></svg>',
  },
  {
    id: 2,
    clase: 'raspadita',
    nombre: 'Caja premiada',
    descripcion: 'Elegí una de las tres cajas y descubrí el premio.',
    porcentaje: 15,
    ilustracion: '<svg viewBox="0 0 110 90" aria-hidden="true"><path d="M18 36h74v42H18zM12 27h86v15H12zM55 27v51M35 27c-12-4-10-18 0-18 9 0 20 18 20 18M75 27c12-4 10-18 0-18-9 0-20 18-20 18"/></svg>',
  },
  {
    id: 3,
    clase: 'ruleta',
    nombre: 'Rueda de la Fortuna',
    descripcion: 'Detené la rueda en la zona ganadora y obtené un 20% de descuento.',
    porcentaje: 20,
    ilustracion: '<svg viewBox="0 0 110 90" aria-hidden="true"><path d="M55 8l7 10H48z"/><circle cx="55" cy="48" r="32"/><path d="M55 16v64M23 48h64M32 25l46 46M78 25L32 71"/><circle cx="55" cy="48" r="6"/><path d="M43 80h24M48 80l-7 8M62 80l7 8"/></svg>',
  },
];

export function render(container) {
  container.innerHTML = `
    <ion-page class="juegos-hu15">
      <ion-content scroll-y="false">
        <div data-header></div>
        <main class="juegos-hu15__contenido">
          <section class="juegos-hu15__reglas" aria-labelledby="reglas-hu15">
            <span aria-hidden="true">%</span>
            <div>
              <h2 id="reglas-hu15">Un premio en tu cuenta</h2>
              <p>Ganalo en el primer intento. Es único y no acumulativo; después podés jugar todas las veces que quieras.</p>
            </div>
          </section>

          <section class="juegos-hu15__lista" aria-label="Juegos disponibles">
            ${JUEGOS_DEMO.map((juego) => `
              <article class="juegos-hu15__card juegos-hu15__card--${juego.clase}">
                <div class="juegos-hu15__ilustracion">${juego.ilustracion}</div>
                <div class="juegos-hu15__datos">
                  <h2>${juego.nombre}</h2>
                  <p>${juego.descripcion}</p>
                <button type="button" data-ruta="/juegos/${juego.id}">Jugar (${juego.porcentaje}%)</button>
                </div>
              </article>`).join('')}
          </section>

          <aside class="juegos-hu15__estado" aria-label="Estado del beneficio">
            <span aria-hidden="true">●</span>
            <p><strong>Sin descuento aplicado</strong> · Elegí un juego para comenzar.</p>
          </aside>
        </main>
      </ion-content>
    </ion-page>
  `;

  container.querySelector('[data-header]').append(crearAppHeader({
    titulo: 'Juegos y descuentos',
    etiquetaVolver: 'Volver al pedido aceptado',
    onVolver: () => navegarA('/pedidos/aceptado'),
  }));

  container.querySelectorAll('[data-ruta]').forEach((boton) => {
    boton.addEventListener('click', () => navegarA(boton.dataset.ruta));
  });

  const ajusteVista = ajustarVista(container.querySelector('.juegos-hu15__contenido'), {
    variable: '--jh-ajuste',
    minimo: 0.86,
    maximo: 1.18,
  });
  window.addEventListener('hashchange', () => ajusteVista.destruir(), { once: true });
}
