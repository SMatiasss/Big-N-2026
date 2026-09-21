import { crearAppHeader } from '../../../components/app-header/app-header.js';
import { crearLectorQr } from '../../../components/lector-qr/lector-qr.js';
import { obtenerMiEstadiaActiva } from '../../../services/estadias.service.js';
import { validarQrMesaAsignada } from '../../../services/mesa-cliente.service.js';
import { navegarA } from '../../../router.js';
import '../../productos/carta/index.css';
import './index.css';

export async function render(container) {
  container.innerHTML = `<ion-content class="hu11 escanear-mesa"><div data-header></div><main>
    <div class="escanear-mesa__qr" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M8 8h18v18H8zM38 8h18v18H38zM8 38h18v18H8zM13 13h8v8h-8zM43 13h8v8h-8zM13 43h8v8h-8zM38 38h7v7h-7zM49 38h7v18H45v-7h-7v7"/></svg></div>
    <p role="status"></p><div data-lector></div>
  </main></ion-content>`;
  const raiz = container.firstElementChild;
  const estado = raiz.querySelector('[role="status"]');
  const header = crearAppHeader({
    titulo: 'Tu mesa',
    etiquetaVolver: 'Volver a la lista de espera',
    onVolver: () => navegarA('/lista-espera'),
  });
  raiz.querySelector('[data-header]').append(header);
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
