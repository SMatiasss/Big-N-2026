import './lector-qr.css';
import { Capacitor } from '@capacitor/core';
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

// Lee QR y PDF417, formato utilizado por el DNI argentino.
export function crearLectorQr({ onLectura = () => {} } = {}) {
  const elemento = document.createElement('section');
  elemento.className = 'lector-qr';
  elemento.innerHTML = `
    <h2>Datos desde DNI</h2>
    <p>Escaneá el código QR o PDF417 del DNI para completar los datos disponibles.</p>
    <ion-button type="button" fill="outline" expand="block">Leer DNI</ion-button>
    <ion-note color="danger" aria-live="polite"></ion-note>
  `;
  const boton = elemento.querySelector('ion-button');
  const mensaje = elemento.querySelector('ion-note');
  let bloqueado = false;

  function mostrarError(texto = '') { mensaje.textContent = texto; }

  boton.addEventListener('click', async () => {
    if (bloqueado) return;
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('BarcodeScanner')) {
      mostrarError('La lectura del DNI está disponible desde la aplicación instalada en un dispositivo.');
      return;
    }
    boton.disabled = true;
    mostrarError('');
    try {
      const { supported } = await BarcodeScanner.isSupported();
      if (!supported) throw new Error('Este dispositivo no tiene una cámara compatible para leer el DNI.');

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
        mostrarError('No se detectó un código válido. Intentá nuevamente con el DNI completo y enfocado.');
        return;
      }
      onLectura(contenido);
    } catch (errorScan) {
      console.error('No se pudo leer el DNI.', errorScan);
      mostrarError(errorScan.message ?? 'No se pudo leer el DNI. Revisá el permiso de cámara e intentá nuevamente.');
    } finally {
      boton.disabled = bloqueado;
    }
  });

  return { elemento, mostrarError, establecerBloqueado(valor) { bloqueado = Boolean(valor); boton.disabled = bloqueado; } };
}
