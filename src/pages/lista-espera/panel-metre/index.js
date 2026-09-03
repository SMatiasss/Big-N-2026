// Panel del metre: lista de espera en tiempo real + asignación de mesa
// (puntos 9 y 10).
import './index.css';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { ROLES } from '../../../config/constantes.js';
import { puedeAsignarMesa } from '../../../config/permisos.js';
import { obtenerPermisos } from '../../../services/auth.service.js';
import { asignarMesa } from '../../../services/estadias.service.js';
import { listarEsperando, suscribirseAListaEspera } from '../../../services/lista-espera.service.js';
import { listarMesasLibres } from '../../../services/mesas.service.js';
import { enviarNotificacion } from '../../../services/notificaciones.service.js';

const ETIQUETAS_TIPO_MESA = {
  estandar: 'Estándar',
  vip: 'VIP',
  movilidad_reducida: 'Movilidad reducida',
};

function filaCliente(entrada) {
  const cliente = entrada.cliente ?? {};
  const esAnonimo = cliente.rol === ROLES.CLIENTE_ANONIMO;
  const nombre = cliente.nombres ?? 'Cliente';
  const foto = cliente.foto_url
    ? `<img src="${cliente.foto_url}" alt="Foto de ${nombre}">`
    : '<div class="panel-metre__foto-vacia" aria-hidden="true">Sin foto</div>';

  return `
    <li class="panel-metre__fila" data-id="${entrada.id}" data-nombre="${nombre}">
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
      <ion-content>
        <main class="panel-metre__contenido">
          <header class="panel-metre__header">
            <button class="panel-metre__volver" type="button" aria-label="Volver">‹</button>
            <h1 class="panel-metre__titulo">Lista de espera</h1>
          </header>

          <div class="panel-metre__estado-carga">
            <ion-spinner name="crescent" aria-hidden="true"></ion-spinner>
            <span>Cargando...</span>
          </div>
          <ul class="panel-metre__lista" hidden></ul>
          <p class="panel-metre__mensaje" hidden>No hay clientes esperando.</p>
        </main>
      </ion-content>
    </ion-page>
  `;

  const estadoCarga = container.querySelector('.panel-metre__estado-carga');
  const lista = container.querySelector('.panel-metre__lista');
  const mensaje = container.querySelector('.panel-metre__mensaje');

  container.querySelector('.panel-metre__volver').addEventListener('click', () => {
    window.history.back();
  });

  // Se refresca junto con el listado completo en cada carga; no hace falta
  // que esté perfectamente al día entre medio: si dos metres asignan la
  // misma mesa casi a la vez, uq_estadia_activa_mesa hace fallar el segundo
  // insert (código 23505) y ese caso se atrapa en confirmarAsignacion.
  let mesasLibres = [];
  let puedeAsignar = false;

  function opcionesMesas() {
    return mesasLibres
      .map((mesa) => `<ion-select-option value="${mesa.id}">Mesa ${mesa.numero} · ${ETIQUETAS_TIPO_MESA[mesa.tipo] ?? mesa.tipo}</ion-select-option>`)
      .join('');
  }

  async function confirmarAsignacion(fila, entrada) {
    const select = fila.querySelector('.panel-metre__select-mesa');
    const mesa = mesasLibres.find((m) => m.id === select.value);
    if (!mesa) return;

    const alerta = document.createElement('ion-alert');
    alerta.cssClass = 'panel-metre-alerta';
    alerta.header = 'Confirmar asignación';
    alerta.message = `¿Asignar ${fila.dataset.nombre} a la mesa ${mesa.numero}?`;
    alerta.buttons = [
      { text: 'No', role: 'cancel' },
      {
        text: 'Sí',
        handler: async () => {
          const boton = fila.querySelector('.panel-metre__asignar');
          boton.disabled = true;

          try {
            await asignarMesa({
              clienteId: entrada.cliente_id,
              mesaId: mesa.id,
              listaEsperaId: entrada.id,
            });

            try {
              // Cubre el caso de que el cliente tenga la app en segundo plano
              // y el realtime no le llegue en el momento. La asignación real
              // (mesa ocupada + lista_espera 'asignado') ya la hizo el trigger.
              await enviarNotificacion({
                destinatario_id: entrada.cliente_id,
                titulo: 'Mesa asignada',
                cuerpo: `Te asignamos la mesa ${mesa.numero}.`,
                tipo: 'mesa_asignada',
              });
            } catch (errorNotif) {
              console.error('No se pudo registrar la notificación de mesa asignada.', errorNotif);
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
        },
      },
    ];

    document.body.append(alerta);
    await alerta.present();
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

        // El resto del staff puede mirar quién está esperando, pero asignar
        // una mesa crea una estadía y eso es del metre o de un jefe (policy
        // estadias_alta). Sin esto el insert fallaría recién contra la base.
        if (!puedeAsignar) {
          select.hidden = true;
          boton.hidden = true;
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

  window.addEventListener('hashchange', () => cancelarSuscripcion(), { once: true });
}
