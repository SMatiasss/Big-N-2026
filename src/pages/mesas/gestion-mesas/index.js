// Gestión de mesas adaptada al diseño temático de la aplicación:
// encabezado con botón volver y alta (+), leyenda de estados y cuadrícula de 3 columnas.
import './index.css';
import { ajustarGrilla } from '../../../components/lista-ajustada/lista-ajustada.js';
import { crearAppHeader } from '../../../components/app-header/app-header.js';
import { puedeAltaMesa } from '../../../config/permisos.js';
import { obtenerPermisos } from '../../../services/auth.service.js';
import { listarMesas } from '../../../services/mesas.service.js';
import { navegarA } from '../../../router.js';
import { reintentarUnaVez } from '../../../utils/reintentar.js';

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
      <ion-content class="pantalla-lista" scroll-y="false">
        <div data-header></div>
        <main class="gestion-mesas__contenido pantalla-lista__cuerpo">

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
          <div class="gestion-mesas__grid grilla-ajustada" hidden></div>

          <!-- MENSAJE VACÍO O ERROR -->
          <p class="gestion-mesas__mensaje" role="status" aria-live="polite" hidden></p>
        </main>
      </ion-content>
    </ion-page>
  `;

  const estadoCarga = container.querySelector('.gestion-mesas__estado-carga');
  const grid = container.querySelector('.gestion-mesas__grid');
  const mensaje = container.querySelector('.gestion-mesas__mensaje');

  // Calcula el lado de las mesas para que entre un número entero de filas
  // en el alto disponible, manteniéndolas cuadradas.
  ajustarGrilla(grid, { columnas: 3 });

  /* — Header — */
  const header = crearAppHeader({
    titulo: 'Mesas',
    etiquetaVolver: 'Volver al inicio',
    onVolver: () => navegarA('/home'),
    accion: {
      texto: '+',
      etiqueta: 'Agregar mesa',
      onClick: () => navegarA('/mesas/alta'),
    },
  });
  container.querySelector('[data-header]').append(header);
  const botonAlta = header.querySelector('.app-header__accion');
  botonAlta.hidden = true;

  reintentarUnaVez(obtenerPermisos)
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
