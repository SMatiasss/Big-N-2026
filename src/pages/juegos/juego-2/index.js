// punto 14/15
import { jugar } from '../../../services/juegos.service.js';
import { crearPantallaJuego, mostrarError, mostrarResultado } from '../juego-base.js';

const hamburguesa = '<span class="juego-hu15__hamburguesa" role="img" aria-label="Hamburguesa">🍔</span>';

export function render(container) {
  const vista = crearPantallaJuego(container, { titulo: 'Caja premiada', instrucciones: 'Elegí una caja. Solo una contiene el premio del 15%.', tableroClase: 'juego-hu15__cajas', tableroHtml: [1,2,3].map(i => `<button type="button" data-caja="${i}" aria-label="Caja ${i}">▣<small>${i}</small></button>`).join('') });
  let ocupada = false;
  async function elegir(boton) {
    if (ocupada) return; ocupada = true;
    vista.tablero.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try {
      const resultado = await jugar({ juegoId: 2, eleccion: Number(boton.dataset.caja) });
      vista.tablero.querySelectorAll('button').forEach((b, i) => {
        const esPremiada = i + 1 === resultado.objetivo;
        b.innerHTML = esPremiada ? hamburguesa : '<span aria-hidden="true">×</span>';
        b.classList.toggle('premiada', esPremiada);
        b.classList.toggle('elegida', b === boton);
      });
      mostrarResultado(vista.resultado, resultado);
    }
    catch (error) { mostrarError(vista.resultado, error); }
    vista.repetir.hidden = false;
  }
  vista.tablero.querySelectorAll('[data-caja]').forEach(b => b.addEventListener('click', () => elegir(b)));
  vista.repetir.addEventListener('click', () => { ocupada = false; vista.repetir.hidden = true; vista.resultado.textContent = 'Nueva partida recreativa lista.'; vista.tablero.querySelectorAll('button').forEach((b,i) => { b.disabled = false; b.classList.remove('premiada', 'elegida'); b.innerHTML = `▣<small>${i+1}</small>`; }); });
}
