import './lector-qr.css';
import { Capacitor } from '@capacitor/core';
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

// Lee QR y PDF417. Nació para el DNI argentino, pero se reutiliza para
// cualquier código QR (por ejemplo el de ingreso al local, punto 9) — los
// textos son configurables y quedan con el wording de DNI por default para
// no tocar el uso que ya tenía en alta-empleado.
export function crearLectorQr({
  onLectura = () => {},
  titulo = 'Escanear DNI',
  descripcion = 'Escaneá el código QR o PDF417 del DNI para completar los datos disponibles.',
  textoBoton = 'Leer DNI',
  nombreObjeto = 'DNI',
  variante = '',
} = {}) {
  const elemento = document.createElement('section');
  elemento.className = `lector-qr${variante ? ` lector-qr--${variante}` : ''}`;
  elemento.innerHTML = `
    ${variante === 'acceso' ? `<span class="lector-qr__icono" aria-hidden="true">
      <svg viewBox="0 0 64 64" focusable="false"><path d="M8 8h18v18H8zM38 8h18v18H38zM8 38h18v18H8zM13 13h8v8h-8zM43 13h8v8h-8zM13 43h8v8h-8zM38 38h7v7h-7zM49 38h7v18H45v-7h-7v7"/></svg>
    </span>` : ''}
    <h2>${titulo}</h2>
    <p>${descripcion}</p>
    <ion-button type="button" fill="outline" expand="block">${textoBoton}</ion-button>
    <ion-note color="danger" aria-live="polite"></ion-note>
  `;
  const boton = elemento.querySelector('ion-button');
  const mensaje = elemento.querySelector('ion-note');
  let bloqueado = false;

  function mostrarError(texto = '') { mensaje.textContent = texto; }

  async function escanear() {
    if (bloqueado) return;
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('BarcodeScanner')) {
      mostrarError(`La lectura del ${nombreObjeto} está disponible desde la aplicación instalada en un dispositivo.`);
      return;
    }
    boton.disabled = true;
    mostrarError('');
    try {
      const { supported } = await BarcodeScanner.isSupported();
      if (!supported) throw new Error(`Este dispositivo no tiene una cámara compatible para leer el ${nombreObjeto}.`);

      if (Capacitor.getPlatform() === 'android') {
        const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!available) {
          await BarcodeScanner.installGoogleBarcodeScannerModule();
          mostrarError('Se está preparando el lector. Cuando finalice la descarga, volvé a intentar.');
          return;
        }
      }

      const { barcodes } = await BarcodeScanner.scan({
        formats: [BarcodeFormat.Pdf417, BarcodeFormat.QrCode],
        autoZoom: true,
      });
      const contenido = barcodes[0]?.rawValue ?? barcodes[0]?.displayValue;
      if (!contenido) {
        mostrarError(`No se detectó un código válido. Intentá nuevamente con el ${nombreObjeto} completo y enfocado.`);
        return;
      }
      await onLectura(contenido);
    } catch (errorScan) {
      console.error(`No se pudo leer el ${nombreObjeto}.`, errorScan);
      mostrarError(errorScan.message ?? `No se pudo leer el ${nombreObjeto}. Revisá el permiso de cámara e intentá nuevamente.`);
    } finally {
      boton.disabled = bloqueado;
    }
  }

  boton.addEventListener('click', escanear);

  return {
    elemento,
    escanear,
    mostrarError,
    establecerBloqueado(valor) { bloqueado = Boolean(valor); boton.disabled = bloqueado; },
  };
}
