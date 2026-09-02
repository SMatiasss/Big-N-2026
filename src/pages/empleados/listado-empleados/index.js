import './index.css';
import { navegarA } from '../../../router.js';
import { listarEmpleados } from '../../../services/perfiles.service.js';
import { ROLES, ESTADOS_PERFIL } from '../../../config/constantes.js';


/* =========================================================
   ETIQUETAS DE ROL
   ========================================================= */

const ETIQUETA_ROL = {
  [ROLES.DUENO]:      'Dueño',
  [ROLES.SUPERVISOR]: 'Supervisor',
  [ROLES.METRE]:      'Metre',
  [ROLES.MOZO]:       'Mozo',
  [ROLES.COCINERO]:   'Cocinero',
  [ROLES.CANTINERO]:  'Cantinero',
};


/* =========================================================
   RENDER
   ========================================================= */

export function render(container) {
  container.innerHTML = `
    <ion-page class="listado-empleados">

      <ion-content>

        <header class="listado-empleados__header">
          <div class="listado-empleados__header-contenido">
            <button
              class="listado-empleados__volver"
              type="button"
              aria-label="Volver"
            >
              ‹
            </button>

            <h1 class="listado-empleados__titulo">Empleados</h1>

            <button
              class="listado-empleados__boton-alta"
              type="button"
              aria-label="Agregar empleado"
            >
              +
            </button>
          </div>
        </header>

        <main class="listado-empleados__contenido">
          <ul class="listado-empleados__lista" aria-live="polite">
            <li class="listado-empleados__mensaje">Cargando empleados…</li>
          </ul>
        </main>

      </ion-content>

    </ion-page>
  `;


  /* =========================================================
     REFERENCIAS
     ========================================================= */

  const lista = container.querySelector('.listado-empleados__lista');


  /* =========================================================
     EVENTOS
     ========================================================= */

  container
    .querySelector('.listado-empleados__volver')
    .addEventListener('click', () => window.history.back());

  container
    .querySelector('.listado-empleados__boton-alta')
    .addEventListener('click', () => navegarA('/empleados/alta-empleado'));


  /* =========================================================
     CARGA DE DATOS
     ========================================================= */

  cargarEmpleados();

  async function cargarEmpleados() {
    try {
      const empleados = await listarEmpleados();

      if (!empleados.length) {
        lista.innerHTML = `
          <li class="listado-empleados__mensaje">No hay empleados registrados aún.</li>
        `;
        return;
      }

      lista.innerHTML = empleados.map(renderCardEmpleado).join('');

    } catch (error) {
      lista.innerHTML = `
        <li class="listado-empleados__mensaje">No se pudieron cargar los empleados: ${error.message}</li>
      `;
    }
  }
}


/* =========================================================
   CARD INDIVIDUAL
   ========================================================= */

function renderCardEmpleado(empleado) {
  const inicial = (empleado.apellidos?.[0] ?? '?').toUpperCase();
  const nombre = `${empleado.nombres ?? ''} ${empleado.apellidos ?? ''}`.trim();
  const rol = ETIQUETA_ROL[empleado.rol] ?? empleado.rol ?? '—';
  const activo = empleado.estado === ESTADOS_PERFIL.APROBADO;
  const estadoTexto = activo ? 'Activo' : 'Inactivo';
  const estadoClase = activo
    ? 'empleado-card__estado empleado-card__estado--activo'
    : 'empleado-card__estado';

  return `
    <li class="empleado-card">

      <div class="empleado-card__avatar" aria-hidden="true">
        ${inicial}
      </div>

      <div class="empleado-card__info">
        <p class="empleado-card__nombre">${nombre}</p>
        <p class="empleado-card__rol">${rol}</p>
      </div>

      <div class="${estadoClase}">
        ${activo ? '<span class="empleado-card__indicador" aria-hidden="true"></span>' : ''}
        <span>${estadoTexto}</span>
      </div>

    </li>
  `;
}