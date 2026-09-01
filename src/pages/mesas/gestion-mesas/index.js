// Listado de mesas (punto 4). Cualquier trabajador puede entrar a mirarlo;
// el botón "+" para dar de alta sólo aparece si el rol puede hacerlo
// (las policies de Supabase siguen siendo la barrera real, esto es sólo UI).
import './index.css';
import { crearBotonFlotante } from '../../../components/boton-flotante/boton-flotante.js';
import { ROLES } from '../../../config/constantes.js';
import { obtenerPermisosProductos } from '../../../services/auth.service.js';
import { listarMesas } from '../../../services/mesas.service.js';
import { navegarA } from '../../../router.js';

const ETIQUETAS_TIPO = {
  estandar: 'Estándar',
  vip: 'VIP',
  movilidad_reducida: 'Movilidad reducida',
};

const ETIQUETAS_ESTADO = {
  libre: 'Libre',
  ocupada: 'Ocupada',
};

// Arma el <li> de una mesa. Si todavía no tiene foto (dato viejo o alta
// incompleta) muestra un cartel en su lugar en vez de un <img> roto.
function tarjetaMesa(mesa) {
  const foto = mesa.foto_url
    ? `<img src="${mesa.foto_url}" alt="Foto de la mesa ${mesa.numero}">`
    : '<div class="gestion-mesas__foto-vacia" aria-hidden="true">Sin foto</div>';

  return `
    <li class="gestion-mesas__tarjeta">
      <div class="gestion-mesas__tarjeta-foto">${foto}</div>
      <div class="gestion-mesas__tarjeta-info">
        <h2>Mesa ${mesa.numero}</h2>
        <p>${ETIQUETAS_TIPO[mesa.tipo] ?? mesa.tipo} · ${mesa.cantidad_comensales} comensales</p>
        <span class="gestion-mesas__estado gestion-mesas__estado--${mesa.estado}">${ETIQUETAS_ESTADO[mesa.estado] ?? mesa.estado}</span>
      </div>
    </li>
  `;
}

export function render(container) {
  container.innerHTML = `
    <ion-page class="ion-page gestion-mesas">
      <ion-header>
        <ion-toolbar color="primary">
          <ion-title>Mesas</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-content>
        <main class="gestion-mesas__contenido">
          <div class="gestion-mesas__estado-carga">
            <ion-spinner name="crescent" aria-hidden="true"></ion-spinner>
            <span>Cargando mesas...</span>
          </div>
          <ul class="gestion-mesas__lista" hidden></ul>
          <p class="gestion-mesas__mensaje" role="status" aria-live="polite" hidden></p>
        </main>
      </ion-content>
    </ion-page>
  `;

  const estadoCarga = container.querySelector('.gestion-mesas__estado-carga');
  const lista = container.querySelector('.gestion-mesas__lista');
  const mensaje = container.querySelector('.gestion-mesas__mensaje');

  const botonFlotante = crearBotonFlotante({
    etiqueta: 'Agregar mesa',
    onClick: () => navegarA('/mesas/alta'),
  });
  container.querySelector('ion-content').append(botonFlotante.elemento);

  // El alta de mesa es sólo para dueño o supervisor (punto 4). El resto del
  // personal ve el listado igual, pero sin la posibilidad de agregar.
  obtenerPermisosProductos()
    .then(({ rol }) => {
      if (rol === ROLES.DUENO || rol === ROLES.SUPERVISOR) botonFlotante.mostrar();
    })
    .catch((error) => console.error('No se pudieron determinar los permisos para el alta de mesa.', error));

  listarMesas()
    .then((mesas) => {
      estadoCarga.hidden = true;

      if (mesas.length === 0) {
        mensaje.textContent = 'Todavía no hay mesas cargadas.';
        mensaje.hidden = false;
        return;
      }

      lista.innerHTML = mesas.map(tarjetaMesa).join('');
      lista.hidden = false;
    })
    .catch((error) => {
      estadoCarga.hidden = true;
      mensaje.textContent = `No se pudieron cargar las mesas: ${error.message ?? 'error desconocido'}`;
      mensaje.hidden = false;
    });
}
