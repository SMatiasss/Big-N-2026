// punto 14/15
import { jugar } from '../../../services/juegos.service.js';
import { anguloFinalRuleta } from '../../../utils/juegos.js';
import { crearPantallaJuego, mostrarError, mostrarResultado } from '../juego-base.js';

function puntoPolar(angulo, radio) {
  const radianes = (angulo * Math.PI) / 180;
  return { x: 150 + radio * Math.cos(radianes), y: 150 + radio * Math.sin(radianes) };
}

function crearRuletaSvg() {
  const sectores = Array.from({ length: 8 }, (_, indice) => {
    const inicio = -90 + indice * 45;
    const fin = inicio + 45;
    const a = puntoPolar(inicio, 138);
    const b = puntoPolar(fin, 138);
    const relleno = indice % 2 === 0 ? '#dda15e' : '#283618';
    return `<path d="M150 150 L${a.x.toFixed(2)} ${a.y.toFixed(2)} A138 138 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)} Z" fill="${relleno}"/>`;
  }).join('');
  return `<svg class="ruleta-svg" viewBox="0 0 300 300" aria-hidden="true"><circle cx="150" cy="150" r="145" class="ruleta-svg__aro"/>${sectores}<circle cx="150" cy="150" r="39" class="ruleta-svg__centro"/></svg>`;
}

export function render(container) {
  const vista = crearPantallaJuego(container, { titulo: 'Rueda de la Fortuna', instrucciones: 'Girá la rueda. El marcador señalará el resultado.', tableroClase: 'juego-hu15__ruleta', tableroHtml: `<div class="juego-hu15__leyenda-ruleta"><span><i class="es-premio"></i>20% de descuento</span><span><i class="sin-premio"></i>Sin premio</span></div><div class="juego-hu15__ruleta-contenedor"><div class="juego-hu15__marcador" aria-hidden="true"></div><button class="juego-hu15__rueda" type="button" aria-label="Girar la Rueda de la Fortuna">${crearRuletaSvg()}<span class="juego-hu15__rueda-centro">Girar</span></button></div>` });
  const rueda = vista.tablero.querySelector('.juego-hu15__rueda');
  let ocupada = false;
  async function girar() {
    if (ocupada) return; ocupada = true; rueda.disabled = true;
    try {
      const resultado = await jugar({ juegoId: 3 });
      rueda.style.setProperty('--giro-final', `${anguloFinalRuleta(resultado.objetivo)}deg`);
      rueda.classList.add('girando');
      setTimeout(() => mostrarResultado(vista.resultado, resultado), 1200);
    }
    catch (error) { mostrarError(vista.resultado, error); }
    setTimeout(() => { vista.repetir.hidden = false; }, 1200);
  }
  rueda.addEventListener('click', girar);
  vista.repetir.addEventListener('click', () => {
    ocupada = false; rueda.disabled = false; vista.repetir.hidden = true;
    rueda.classList.add('reiniciando'); rueda.classList.remove('girando');
    rueda.style.removeProperty('--giro-final'); void rueda.offsetWidth;
    rueda.classList.remove('reiniciando');
    vista.resultado.textContent = 'Nueva partida recreativa lista.';
  });
}
