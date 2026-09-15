// punto 14/15
import { jugar } from '../../../services/juegos.service.js';
import { PARES_MEMOTEST, revelarMemotest } from '../../../utils/juegos.js';
import { crearPantallaJuego, mostrarError, mostrarResultado } from '../juego-base.js';

export function render(container) {
  const vista = crearPantallaJuego(container, { titulo: 'Memotest', instrucciones: 'Encontrá uno de los dos pares. Tu primera elección puede darte el 10%.', tableroClase: 'juego-hu15__cartas', tableroHtml: [0,1,2,3].map(i => `<button type="button" data-carta="${i}" aria-label="Carta ${i+1}"><span>?</span></button>`).join('') });
  let elegidas = [];
  let ocupada = false;

  async function elegir(boton) {
    if (ocupada || boton.classList.contains('seleccionada')) return;
    boton.classList.add('seleccionada'); boton.querySelector('span').textContent = '•'; elegidas.push(Number(boton.dataset.carta));
    if (elegidas.length < 2) return;
    ocupada = true;
    const parElegido = [...elegidas].sort((a, b) => a - b);
    const indice = PARES_MEMOTEST.findIndex(par => par[0] === parElegido[0] && par[1] === parElegido[1]) + 1;
    try {
      const resultado = await jugar({ juegoId: 1, eleccion: indice });
      const simbolos = revelarMemotest(resultado.objetivo);
      vista.tablero.querySelectorAll('[data-carta]').forEach((carta, i) => {
        carta.querySelector('span').textContent = simbolos[i];
        carta.classList.toggle('acertada', resultado.gano && elegidas.includes(i));
      });
      mostrarResultado(vista.resultado, resultado);
    }
    catch (error) { mostrarError(vista.resultado, error); }
    vista.repetir.hidden = false;
  }
  vista.tablero.querySelectorAll('[data-carta]').forEach(b => b.addEventListener('click', () => elegir(b)));
  vista.repetir.addEventListener('click', () => { elegidas = []; ocupada = false; vista.repetir.hidden = true; vista.resultado.textContent = 'Nueva partida recreativa lista.'; vista.tablero.querySelectorAll('button').forEach(b => { b.classList.remove('seleccionada', 'acertada'); b.querySelector('span').textContent = '?'; }); });
}
