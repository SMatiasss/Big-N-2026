// Gestión de mesas adaptada al diseño temático de la aplicación:
// encabezado con botón volver y alta (+), leyenda de estados y cuadrícula de 3 columnas.
import './index.css';
import { puedeAltaMesa } from '../../../config/permisos.js';
import { obtenerPermisos } from '../../../services/auth.service.js';
import { listarMesas } from '../../../services/mesas.service.js';
import { navegarA } from '../../../router.js';

function tarjetaMesa(mesa) {
  const estado = mesa.estado ?? 'libre';
  const estadoClase = `mesa-card--${estado}`;
  const comensalesTexto = `${mesa.cantidad_comensales ?? 4} pers`;

  return `
    <article class="mesa-card ${estadoClase}" data-id="${mesa.id}" data-numero="${mesa.numero}">
      <span class="mesa-card__numero">${mesa.numero}</span>
      <span class="mesa-card__comensales">${comensalesTexto}</span>
    </article>
  `;
}

export function render(container) {
  container.innerHTML = `
    <ion-page class="gestion-mesas">
      <ion-content>
        <main class="gestion-mesas__contenido">
          <header class="gestion-mesas__header">
            <button class="gestion-mesas__volver" type="button" aria-label="Volver">‹</button>
            <h1 class="gestion-mesas__titulo">Mesas</h1>
            <button class="gestion-mesas__boton-alta" type="button" aria-label="Agregar mesa" hidden>+</button>
          </header>

          <!-- LEYENDA -->
          <div class="gestion-mesas__leyenda" aria-label="Referencias de estado">
            <span class="leyenda-item">
              <span class="leyenda-punto leyenda-punto--libre" aria-hidden="true"></span>
              <span>Libre</span>
            </span>
            <span class="leyenda-item">
              <span class="leyenda-punto leyenda-punto--ocupada" aria-hidden="true"></span>
              <span>Ocupada</span>
            </span>
            <span class="leyenda-item">
              <span class="leyenda-punto leyenda-punto--reservada" aria-hidden="true"></span>
              <span>Reservada</span>
            </span>
          </div>

          <!-- ESTADO DE CARGA -->
          <div class="gestion-mesas__estado-carga">
            <ion-spinner name="crescent" aria-hidden="true"></ion-spinner>
            <span>Cargando mesas...</span>
          </div>

          <!-- GRID DE MESAS -->
          <div class="gestion-mesas__grid" hidden></div>

          <!-- MENSAJE VACÍO O ERROR -->
          <p class="gestion-mesas__mensaje" role="status" aria-live="polite" hidden></p>
        </main>
      </ion-content>
    </ion-page>
  `;

  const estadoCarga = container.querySelector('.gestion-mesas__estado-carga');
  const grid = container.querySelector('.gestion-mesas__grid');
  const mensaje = container.querySelector('.gestion-mesas__mensaje');

  // Volver
  container.querySelector('.gestion-mesas__volver').addEventListener('click', () => {
    window.history.back();
  });

  // Agregar mesa (+): todo el staff puede ver el listado, pero el alta es de
  // dueño/supervisor y metre (policy mesas_admin, ver config/permisos.js).
  const botonAlta = container.querySelector('.gestion-mesas__boton-alta');
  botonAlta.addEventListener('click', () => {
    navegarA('/mesas/alta');
  });

  obtenerPermisos()
    .then((permisos) => { botonAlta.hidden = !puedeAltaMesa(permisos); })
    .catch((error) => console.error('No se pudieron cargar los permisos de mesas.', error));

  listarMesas()
    .then((mesas) => {
      estadoCarga.hidden = true;

      if (!mesas || mesas.length === 0) {
        mensaje.textContent = 'Todavía no hay mesas cargadas.';
        mensaje.hidden = false;
        return;
      }

      grid.innerHTML = mesas.map(tarjetaMesa).join('');
      grid.hidden = false;
    })
    .catch((error) => {
      estadoCarga.hidden = true;
      mensaje.textContent = `No se pudieron cargar las mesas: ${error.message ?? 'error desconocido'}`;
      mensaje.hidden = false;
    });
}
