import './carrusel-imagenes.css';

// Una sola imagen por vez: no asoman fotos vecinas ni se mezcla texto encima.
export function crearCarruselImagenes(urls = [], nombre = 'Producto') {
  const el = document.createElement('div');
  el.className = 'carrusel-imagenes';
  el.innerHTML = '<div class="carrusel-imagenes__foto"></div><nav aria-label="Fotografías del producto"><button type="button" aria-label="Foto anterior">‹</button><span aria-live="polite"></span><button type="button" aria-label="Foto siguiente">›</button></nav>';
  const foto = el.querySelector('div');
  const contador = el.querySelector('span');
  let posicion = 0;
  function mostrar() {
    foto.textContent = 'Foto no disponible';
    contador.textContent = `${posicion + 1} / 3`;
    try {
      const url = new URL(urls[posicion]);
      if (!['https:', 'http:'].includes(url.protocol)) return;
      const img = document.createElement('img');
      img.src = url.href;
      img.alt = `${nombre}: foto ${posicion + 1}`;
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => { if (foto.contains(img)) foto.textContent = 'Foto no disponible'; });
      foto.replaceChildren(img);
    } catch { /* Se informa la ausencia sin reemplazarla por otra fotografía. */ }
  }
  const botones = el.querySelectorAll('button');
  botones[0].addEventListener('click', () => { posicion = (posicion + 2) % 3; mostrar(); });
  botones[1].addEventListener('click', () => { posicion = (posicion + 1) % 3; mostrar(); });
  mostrar();
  return el;
}
