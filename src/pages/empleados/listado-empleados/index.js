import './index.css';
import { navegarA } from '../../../router.js';
import { listarEmpleados } from '../../../services/perfiles.service.js';
import { obtenerPermisos } from '../../../services/auth.service.js';
import { ROLES, ESTADOS_PERFIL } from '../../../config/constantes.js';
import { puedeAltaEmpleado } from '../../../config/permisos.js';
import { crearAppHeader } from '../../../components/app-header/app-header.js';


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

        <div data-header></div>

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

  // Todo el staff puede ver el listado (perfiles_staff_lee usa es_empleado()),
  // pero el alta de empleados es de dueño/supervisor (ver config/permisos.js).
  const header = crearAppHeader({
    titulo: 'Empleados',
    etiquetaVolver: 'Volver al inicio',
    onVolver: () => navegarA('/home'),
    accion: { texto: '+', etiqueta: 'Agregar empleado', onClick: () => navegarA('/empleados/alta-empleado') },
  });
  container.querySelector('[data-header]').append(header);
  const botonAlta = header.querySelector('.app-header__accion');
  botonAlta.hidden = true;

  obtenerPermisos()
    .then((permisos) => { botonAlta.hidden = !puedeAltaEmpleado(permisos); })
    .catch((error) => console.error('No se pudieron cargar los permisos de empleados.', error));


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

      lista.replaceChildren(...empleados.map(crearCardEmpleado));

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

function crearCardEmpleado(empleado) {
  const iniciales = `${empleado.nombres?.[0] ?? ''}${empleado.apellidos?.[0] ?? ''}`.toUpperCase() || '?';
  const nombre = `${empleado.nombres ?? ''} ${empleado.apellidos ?? ''}`.trim();
  const rol = ETIQUETA_ROL[empleado.rol] ?? empleado.rol ?? '—';
  const activo = empleado.estado === ESTADOS_PERFIL.APROBADO;
  const estadoTexto = activo ? 'Activo' : 'Inactivo';
  const card = document.createElement('li');
  card.className = 'empleado-card';
  const avatar = document.createElement('div');
  avatar.className = 'empleado-card__avatar';
  avatar.textContent = iniciales;
  avatar.setAttribute('aria-label', `Sin foto de ${nombre}`);
  try {
    const url = new URL(empleado.foto_url);
    if (['https:', 'http:'].includes(url.protocol)) {
      const imagen = document.createElement('img');
      imagen.src = url.href;
      imagen.alt = `Foto de ${nombre}`;
      imagen.loading = 'lazy';
      imagen.addEventListener('error', () => {
        avatar.replaceChildren(iniciales);
        avatar.setAttribute('aria-label', `Sin foto de ${nombre}`);
      }, { once: true });
      avatar.replaceChildren(imagen);
      avatar.removeAttribute('aria-label');
    }
  } catch { /* Las iniciales quedan como respaldo. */ }
  const info = document.createElement('div');
  info.className = 'empleado-card__info';
  const nombreNodo = document.createElement('p');
  nombreNodo.className = 'empleado-card__nombre';
  nombreNodo.textContent = nombre;
  const rolNodo = document.createElement('p');
  rolNodo.className = 'empleado-card__rol';
  rolNodo.textContent = rol;
  info.append(nombreNodo, rolNodo);
  const estado = document.createElement('div');
  estado.className = activo ? 'empleado-card__estado empleado-card__estado--activo' : 'empleado-card__estado';
  if (activo) {
    const punto = document.createElement('span');
    punto.className = 'empleado-card__indicador';
    punto.setAttribute('aria-hidden', 'true');
    estado.append(punto);
  }
  const texto = document.createElement('span');
  texto.textContent = estadoTexto;
  estado.append(texto);
  card.append(avatar, info, estado);
  return card;
}
