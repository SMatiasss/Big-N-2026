import { crearLectorQr } from '../../../components/lector-qr/lector-qr.js';
import { obtenerMiEstadiaActiva } from '../../../services/estadias.service.js';
import { validarQrMesaAsignada } from '../../../services/mesa-cliente.service.js';
import { navegarA } from '../../../router.js';
import '../../productos/carta/index.css';

export async function render(container) {
  container.innerHTML = '<ion-content class="hu11"><main><button type="button" data-volver>Volver</button><h1>Tu mesa</h1><p role="status"></p><div data-lector></div></main></ion-content>';
  const raiz = container.firstElementChild;
  const estado = raiz.querySelector('[role="status"]');
  raiz.querySelector('[data-volver]').onclick = () => navegarA('/lista-espera');
  estado.textContent = 'Consultando la mesa asignada…';
  let ocupado = false;
  try {
    const estadia = await obtenerMiEstadiaActiva();
    if (!raiz.isConnected) return;
    if (!estadia) throw new Error('Todavía no tenés mesa asignada. Esperá la confirmación del metre.');
    estado.textContent = `Mesa asignada: ${estadia.mesa.numero}. Escaneá su QR para ver la carta.`;
    const lector = crearLectorQr({
      titulo: 'Escanear mesa', descripcion: 'Usá el QR de la mesa que te asignó el metre.',
      textoBoton: 'Escanear QR', nombreObjeto: 'QR de mesa', onLectura: validar,
    });
    raiz.querySelector('[data-lector]').append(lector.elemento);
    async function validar(contenido) {
      if (ocupado) return;
      ocupado = true;
      lector.establecerBloqueado(true);
      try {
        await validarQrMesaAsignada(contenido);
        if (raiz.isConnected) navegarA('/mesa/carta');
      } catch (error) {
        if (raiz.isConnected) estado.textContent = error.message;
      } finally { ocupado = false; lector.establecerBloqueado(false); }
    }
    // Sólo desarrollo web: prueba el mismo backend, NO certifica captura por cámara.
    if (import.meta.env.DEV) {
      const form = document.createElement('form');
      form.innerHTML = '<label>Prueba web: contenido del QR (no usa cámara)<input name="qr" required maxlength="80" autocomplete="off"></label><button type="submit">Validar QR de prueba</button>';
      form.onsubmit = event => { event.preventDefault(); void validar(form.elements.qr.value); };
      raiz.querySelector('[data-lector]').append(form);
    }
  } catch (error) { if (raiz.isConnected) estado.textContent = error.message; }
}
