// QR de mesa leído por el personal (metre, mozo, dueño o supervisor): muestra
// la información de la mesa — número, cantidad de lugares, tipo y
// disponibilidad. Se llega escaneando el QR desde el home o tocando una mesa
// en la grilla de Mesas. La ruta es /mesa/<id> (ver rutasConParametro en
// router.js) y el permiso está en ROLES_POR_RUTA['/mesa/:id'].
import './index.css';
import { crearAppHeader } from '../../../components/app-header/app-header.js';
import { fijarAltoDisponible } from '../../../components/lista-ajustada/lista-ajustada.js';
import { ICONO_CAMARA_SVG } from '../../../components/cuadro-foto/cuadro-foto.js';
import { crearModalQrMesa } from '../../../components/modal-qr-mesa/modal-qr-mesa.js';
import { ESTADOS_MESA, ETIQUETAS_TIPO_MESA } from '../../../config/constantes.js';
import { obtenerMesa } from '../../../services/mesas.service.js';
import { compartirImagen, generarQR } from '../../../services/qr.service.js';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { contenidoQrMesa } from '../../../utils/hu11.js';

const ETIQUETAS_DISPONIBILIDAD = {
  [ESTADOS_MESA.LIBRE]: 'Vacía',
  [ESTADOS_MESA.OCUPADA]: 'Ocupada',
};

function dato(etiqueta, valor, modificador = '') {
  const tarjeta = document.createElement('div');
  tarjeta.className = `info-mesa__dato${modificador ? ` info-mesa__dato--${modificador}` : ''}`;
  const titulo = document.createElement('dt');
  titulo.textContent = etiqueta;
  const contenido = document.createElement('dd');
  contenido.textContent = valor;
  tarjeta.append(titulo, contenido);
  return tarjeta;
}

export function render(container, { id } = {}) {
  container.innerHTML = `
    <ion-page class="info-mesa">
      <ion-content>
        <div data-header></div>
        <main class="info-mesa__contenido">
          <p class="info-mesa__estado" role="status">Cargando la mesa…</p>
          <section class="info-mesa__ficha" hidden>
            <div class="info-mesa__foto">
              <span class="info-mesa__sin-foto">${ICONO_CAMARA_SVG}<span>Sin foto</span></span>
              <img alt="" hidden>
            </div>
            <p class="info-mesa__baja" hidden>Esta mesa está dada de baja.</p>
            <dl class="info-mesa__datos"></dl>
          </section>
        </main>
      </ion-content>
    </ion-page>
  `;

  // El botón de "ver QR" reusa el mismo glifo que ya representa un QR en
  // "Tu cuenta" (ver .cuenta .lector-qr::before), en vez de inventar otro.
  // Queda oculto hasta tener el qr_token de la mesa (ver más abajo).
  let mesaActual = null;
  let generandoQr = false;

  const header = crearAppHeader({
    titulo: 'Mesa',
    accion: {
      texto: '⌗',
      etiqueta: 'Ver QR de la mesa',
      onClick: () => void abrirQr(),
    },
  });
  container.querySelector('[data-header]').append(header);

  const botonQr = header.querySelector('.app-header__accion');
  botonQr.hidden = true;

  async function abrirQr() {
    if (!mesaActual || generandoQr) return;
    generandoQr = true;
    botonQr.disabled = true;
    try {
      const dataUrlQr = await generarQR(contenidoQrMesa(mesaActual.qr_token));
      if (!container.isConnected) return;
      crearModalQrMesa({
        numero: mesaActual.numero,
        dataUrlQr,
        onCompartir: () => compartirImagen(dataUrlQr, {
          nombreArchivo: `mesa-${mesaActual.numero}-qr.png`,
          titulo: `QR de la mesa ${mesaActual.numero}`,
          texto: `Código QR de la mesa ${mesaActual.numero} — Big N`,
        }).catch((error) => {
          console.error('No se pudo compartir el QR de la mesa.', error);
          mostrarToastError('No se pudo compartir el QR. Probá de nuevo.');
        }),
      }).presentar();
    } catch (error) {
      console.error('No se pudo generar el QR de la mesa.', error);
      mostrarToastError('No se pudo generar el QR de la mesa.');
    } finally {
      generandoQr = false;
      botonQr.disabled = false;
    }
  }

  const estado = container.querySelector('.info-mesa__estado');
  const ficha = container.querySelector('.info-mesa__ficha');
  const foto = container.querySelector('.info-mesa__foto img');

  // El contenido ocupa todo el alto bajo el header: los cuatro datos se
  // reparten lo que deja la foto, sin espacio libre abajo.
  const altoFijo = fijarAltoDisponible(container.querySelector('.info-mesa__contenido'));
  window.addEventListener('hashchange', () => altoFijo.destruir(), { once: true });

  // Si la imagen no carga, queda el recuadro "Sin foto" del mismo tamaño en
  // vez del ícono de imagen rota.
  foto.addEventListener('error', () => { foto.hidden = true; });
  foto.addEventListener('load', () => { foto.hidden = false; });

  obtenerMesa(id)
    .then((mesa) => {
      if (!container.isConnected) return;
      if (!mesa) {
        estado.textContent = 'No se encontró la mesa de este QR.';
        return;
      }

      header.querySelector('.app-header__titulo').textContent = `Mesa ${mesa.numero}`;
      mesaActual = mesa;
      botonQr.hidden = false;

      if (mesa.foto_url) {
        foto.alt = `Foto de la mesa ${mesa.numero}`;
        foto.src = mesa.foto_url;
      }
      container.querySelector('.info-mesa__baja').hidden = mesa.activa !== false;

      const lugares = mesa.cantidad_comensales;
      container.querySelector('.info-mesa__datos').append(
        dato('Número', mesa.numero, 'numero'),
        dato('Lugares', `${lugares} ${lugares === 1 ? 'persona' : 'personas'}`),
        dato('Tipo', ETIQUETAS_TIPO_MESA[mesa.tipo] ?? mesa.tipo),
        dato('Disponibilidad', ETIQUETAS_DISPONIBILIDAD[mesa.estado] ?? mesa.estado, mesa.estado),
      );

      estado.hidden = true;
      ficha.hidden = false;
    })
    .catch((error) => {
      if (!container.isConnected) return;
      estado.textContent = `No se pudo cargar la mesa: ${error.message ?? 'error desconocido'}`;
    });
}
