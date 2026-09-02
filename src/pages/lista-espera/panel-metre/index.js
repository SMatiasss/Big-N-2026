// Panel del metre: lista de espera en tiempo real + asignación de mesa
// (puntos 9 y 10).
import './index.css';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { ROLES } from '../../../config/constantes.js';
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
          ${esAnonimo ? '<ion-badge color="medium">Anónimo</ion-badge>' : ''}
        </p>
        <p class="panel-metre__comensales">${entrada.comensales} comensal${entrada.comensales === 1 ? '' : 'es'}</p>
      </div>
      <ion-select class="panel-metre__select-mesa" placeholder="Elegí una mesa" interface="popover" aria-label="Mesa a asignar"></ion-select>
      <ion-button class="panel-metre__asignar" disabled>Asignar mesa</ion-button>
    </li>
  `;
}

export function render(container) {
  container.innerHTML = `
    <ion-page class="ion-page panel-metre">
      <ion-header>
        <ion-toolbar color="primary">
          <ion-title>Lista de espera</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-content>
        <main class="panel-metre__contenido">
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

  // Se refresca junto con el listado completo en cada carga; no hace falta
  // que esté perfectamente al día entre medio: si dos metres asignan la
  // misma mesa casi a la vez, uq_estadia_activa_mesa hace fallar el segundo
  // insert (código 23505) y ese caso se atrapa en confirmarAsignacion.
  let mesasLibres = [];

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

        select.innerHTML = opcionesMesas();
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

  cargarListado();

  // Nuevos clientes en espera aparecen y los asignados desaparecen solos.
  const cancelarSuscripcion = suscribirseAListaEspera(() => cargarListado());

  window.addEventListener('hashchange', () => cancelarSuscripcion(), { once: true });
}
