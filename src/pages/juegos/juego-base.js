import './juego.css';
import { crearAppHeader } from '../../components/app-header/app-header.js';
import { navegarA } from '../../router.js';

export function crearPantallaJuego(container, { titulo, instrucciones, tableroClase, tableroHtml }) {
  container.innerHTML = `<ion-page class="juego-hu15"><ion-content scroll-y="false"><div data-header></div><main class="juego-hu15__main"><p class="juego-hu15__intro">${instrucciones}</p><section class="juego-hu15__tablero ${tableroClase}">${tableroHtml}</section><div class="juego-hu15__resultado" role="status">Tu primer intento es el único que puede otorgar el descuento.</div><button class="juego-hu15__repetir" type="button" hidden>Jugar otra vez</button></main></ion-content></ion-page>`;
  container.querySelector('[data-header]').append(crearAppHeader({ titulo, onVolver: () => navegarA('/juegos') }));
  return {
    tablero: container.querySelector('.juego-hu15__tablero'),
    resultado: container.querySelector('.juego-hu15__resultado'),
    repetir: container.querySelector('.juego-hu15__repetir'),
  };
}

export function mostrarResultado(elemento, resultado) {
  const titulo = resultado.gano ? '¡Ganaste!' : 'Esta vez no hubo premio';
  const detalle = resultado.premio_otorgado
    ? `Se aplicó un ${resultado.descuento_juego}% a tu estadía.`
    : resultado.descuento_aplicado > 0
      ? `Tu descuento vigente es ${resultado.descuento_aplicado}%. Podés seguir jugando libremente.`
      : resultado.intento_nro === 1
        ? 'El primer intento quedó registrado. Podés seguir jugando por diversión.'
        : 'Esta partida fue recreativa y no modifica tu cuenta.';
  elemento.innerHTML = `<strong>${titulo}</strong>${detalle}`;
}

export function mostrarError(elemento, error) {
  elemento.innerHTML = `<strong>No pudimos registrar la partida</strong>${error?.message ?? 'Intentá nuevamente.'}`;
}
