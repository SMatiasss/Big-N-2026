import './card-producto.css';

export function crearCardProducto(producto) {
  const el = document.createElement('div');
  el.className = 'card-producto';
  el.innerHTML = `
    <h3>${producto.nombre}</h3>
    <p>${producto.descripcion ?? ''}</p>
    <span class="precio">${producto.precio}</span>
  `;
  return el;
}
