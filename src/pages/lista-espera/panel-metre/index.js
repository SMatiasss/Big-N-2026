// Panel del metre: lista de espera en tiempo real + asignación de mesa
// (puntos 9 y 10).
import './index.css';
import { ajustarLista } from '../../../components/lista-ajustada/lista-ajustada.js';
import { crearAppHeader } from '../../../components/app-header/app-header.js';
import { crearModalConfirmacion } from '../../../components/modal-confirmacion/modal-confirmacion.js';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { ETIQUETAS_TIPO_MESA, ROLES } from '../../../config/constantes.js';
import { puedeAsignarMesa } from '../../../config/permisos.js';
import { obtenerPermisos } from '../../../services/auth.service.js';
import { asignarMesa } from '../../../services/estadias.service.js';
import { listarEsperando, rechazarEspera, suscribirseAListaEspera } from '../../../services/lista-espera.service.js';
import { listarMesasLibres } from '../../../services/mesas.service.js';
import { avisarMesaAsignada } from '../../../services/notificaciones.service.js';
import { navegarA } from '../../../router.js';

function filaCliente(entrada) {
  const cliente = entrada.cliente ?? {};
  const esAnonimo = cliente.rol === ROLES.CLIENTE_ANONIMO;
  const nombre = cliente.nombres ?? 'Cliente';
  const foto = cliente.foto_url
    ? `<img src="${cliente.foto_url}" alt="Foto de ${nombre}">`
    : '<div class="panel-metre__foto-vacia" aria-hidden="true">Sin foto</div>';

  return `
    <li class="panel-metre__fila" data-id="${entrada.id}" data-nombre="${nombre}">
      <button class="panel-metre__rechazar" type="button" aria-label="Rechazar la espera de ${nombre}">✕</button>
      <div class="panel-metre__foto">${foto}</div>
      <div class="panel-metre__info">
        <p class="panel-metre__nombre">
          ${nombre}
          ${esAnonimo ? '<ion-badge>Anónimo</ion-badge>' : ''}
        </p>
      </div>
      <ion-select class="panel-metre__select-mesa" placeholder="Elegí una mesa" interface="popover" aria-label="Mesa a asignar"></ion-select>
      <ion-button class="panel-metre__asignar" disabled>Asignar mesa</ion-button>
    </li>
  `;
}

export function render(container) {
  container.innerHTML = `
    <ion-page class="panel-metre">
      <ion-content class="pantalla-lista" scroll-y="false">
        <div data-header></div>
        <main class="panel-metre__contenido pantalla-lista__cuerpo">

          <div class="panel-metre__estado-carga">
            <ion-spinner name="crescent" aria-hidden="true"></ion-spinner>
            <span>Cargando...</span>
          </div>
          <ul class="panel-metre__lista lista-ajustada" hidden></ul>
          <section class="panel-metre__mensaje" hidden>
            <span class="panel-metre__mensaje-icono" aria-hidden="true">◷</span>
            <strong>Lista despejada</strong>
            <p>No hay clientes esperando en este momento.</p>
            <small>Las nuevas solicitudes aparecerán automáticamente.</small>
          </section>
        </main>
      </ion-content>
    </ion-page>
  `;

  const estadoCarga = container.querySelector('.panel-metre__estado-carga');
  const lista = container.querySelector('.panel-metre__lista');
  const mensaje = container.querySelector('.panel-metre__mensaje');

  const ajusteLista = ajustarLista(lista);

  /* — Header — */
  const header = crearAppHeader({
    titulo: 'Lista de espera',
    etiquetaVolver: 'Volver al inicio',
    onVolver: () => navegarA('/home'),
  });
  container.querySelector('[data-header]').append(header);

  // Se refresca junto con el listado completo en cada carga; no hace falta
  // que esté perfectamente al día entre medio: si dos metres asignan la
  // misma mesa casi a la vez, uq_estadia_activa_mesa hace fallar el segundo
  // insert (código 23505) y ese caso se atrapa en confirmarAsignacion.
  let mesasLibres = [];
  let puedeAsignar = false;
  let confirmacion;

  function opcionesMesas() {
    return mesasLibres
      .map((mesa) => `<ion-select-option value="${mesa.id}">Mesa ${mesa.numero} · ${ETIQUETAS_TIPO_MESA[mesa.tipo] ?? mesa.tipo}</ion-select-option>`)
      .join('');
  }

  async function confirmarAsignacion(fila, entrada) {
    const select = fila.querySelector('.panel-metre__select-mesa');
    const mesa = mesasLibres.find((m) => m.id === select.value);
    if (!mesa) return;

    const modal = crearModalConfirmacion({
      variante: 'exito',
      titulo: 'Confirmar asignación',
      subtitulo: fila.dataset.nombre,
      mensaje: `¿Asignar a la mesa ${mesa.numero}?`,
      botones: [
        { texto: 'No', rol: 'cancel' },
        { texto: 'Sí', rol: 'confirm', destacado: true },
      ],
    });
    confirmacion = modal;
    let rol;
    try {
      rol = await modal.presentar();
    } finally {
      confirmacion = undefined;
    }
    if (rol !== 'confirm') return;

    const boton = fila.querySelector('.panel-metre__asignar');
    boton.disabled = true;

    try {
      const estadia = await asignarMesa({
        clienteId: entrada.cliente_id,
        mesaId: mesa.id,
        listaEsperaId: entrada.id,
      });

      try {
        // HU10: cubre el caso de que el cliente tenga la app en segundo
        // plano y el realtime no le llegue en el momento. La asignación
        // real (mesa ocupada + lista_espera 'asignado') ya la hizo el
        // trigger; esto es sólo el aviso push.
        await avisarMesaAsignada(estadia.id);
      } catch (errorNotif) {
        console.error('No se pudo enviar el aviso push de mesa asignada.', errorNotif);
      }
      // La fila desaparece sola por la suscripción realtime.
    } catch (error) {
      boton.disabled = false;
      if (error.code === '23505') {
        mostrarToastError('Esa mesa ya fue asignada, elegí otra.');
      } else {
        console.error('No se pudo asignar la mesa.', error);
        mostrarToastError(`No se pudo asignar la mesa: ${error.message ?? 'error desconocido'}`);
      }
    }
  }

  async function confirmarRechazo(fila, entrada) {
    const modal = crearModalConfirmacion({
      variante: 'error',
      titulo: '¿Rechazar esta espera?',
      subtitulo: fila.dataset.nombre,
      mensaje: 'Se le va a avisar que su solicitud fue rechazada y va a salir de la lista de espera.',
      botones: [
        { texto: 'Cancelar', rol: 'cancel' },
        { texto: 'Sí, rechazar', rol: 'confirm', destacado: true },
      ],
    });
    confirmacion = modal;
    let rol;
    try {
      rol = await modal.presentar();
    } finally {
      confirmacion = undefined;
    }
    if (rol !== 'confirm') return;

    const botonRechazar = fila.querySelector('.panel-metre__rechazar');
    botonRechazar.disabled = true;

    try {
      await rechazarEspera(entrada.id);
      // La fila desaparece sola por la suscripción realtime; el cliente se
      // entera y se lo redirige porque su pantalla escucha el UPDATE de su
      // propia fila (ver suscribirseAMiEspera en anuncio-cliente).
    } catch (error) {
      botonRechazar.disabled = false;
      console.error('No se pudo rechazar la espera.', error);
      mostrarToastError(`No se pudo rechazar la espera: ${error.message ?? 'error desconocido'}`);
    }
  }

  async function cargarListado() {
    try {
      const [entradas, libres] = await Promise.all([listarEsperando(), listarMesasLibres()]);
      mesasLibres = libres;
      estadoCarga.hidden = true;

      if (entradas.length === 0) {
        lista.hidden = true;
        lista.innerHTML = '';
        mensaje.hidden = false;
        return;
      }

      mensaje.hidden = true;
      lista.innerHTML = entradas.map(filaCliente).join('');
      lista.hidden = false;

      entradas.forEach((entrada) => {
        const fila = lista.querySelector(`[data-id="${entrada.id}"]`);
        const select = fila.querySelector('.panel-metre__select-mesa');
        const boton = fila.querySelector('.panel-metre__asignar');
        const botonRechazar = fila.querySelector('.panel-metre__rechazar');

        // El resto del staff puede mirar quién está esperando, pero asignar
        // una mesa (policy estadias_alta) o rechazar la espera (policy
        // espera_gestion) es sólo del metre o de un jefe. Sin esto el
        // insert/update fallaría recién contra la base.
        if (!puedeAsignar) {
          select.hidden = true;
          boton.hidden = true;
          botonRechazar.hidden = true;
          // Sin controles la fila sobra dos filas del grid (y sus gaps), así
          // que pasa a ser una tarjeta simple de foto + datos.
          fila.classList.add('panel-metre__fila--solo-lectura');
          return;
        }

        select.innerHTML = opcionesMesas();
        // El popover de Ionic se monta fuera de la página, así que su tema se
        // pide por cssClass en vez de heredarlo del CSS de esta pantalla.
        select.interfaceOptions = { cssClass: 'panel-metre-popover' };
        select.addEventListener('ionChange', () => {
          boton.disabled = !select.value;
        });
        boton.addEventListener('click', () => confirmarAsignacion(fila, entrada));
        botonRechazar.addEventListener('click', () => confirmarRechazo(fila, entrada));
      });
    } catch (error) {
      console.error('No se pudo cargar la lista de espera.', error);
      estadoCarga.hidden = true;
      mensaje.textContent = `No se pudo cargar la lista de espera: ${error.message ?? 'error desconocido'}`;
      mensaje.hidden = false;
    }
  }

  // Los permisos se resuelven antes del primer dibujo para no llegar a mostrar
  // los controles de asignación a quien no puede usarlos. Las recargas por
  // realtime ya reutilizan la bandera.
  obtenerPermisos()
    .then((permisos) => { puedeAsignar = puedeAsignarMesa(permisos); })
    .catch((error) => console.error('No se pudieron cargar los permisos de asignación.', error))
    .finally(() => cargarListado());

  // Nuevos clientes en espera aparecen y los asignados desaparecen solos.
  const cancelarSuscripcion = suscribirseAListaEspera(() => cargarListado());

  window.addEventListener('hashchange', () => {
    cancelarSuscripcion();
    ajusteLista.destruir();
    confirmacion?.cerrar('cancel');
  }, { once: true });
}
