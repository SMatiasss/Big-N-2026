import './capa-carga.css';
import { alPresionarAtras } from '../../router.js';

// Muestra la capa con el spinner y devuelve la función que la saca. Mientras
// está, el botón atrás de Android no hace nada (no se puede salir a mitad de
// una carga) y se saca el foco del campo activo para que no siga el teclado.
export function mostrarCapaCarga(etiqueta = 'Cargando') {
  const capa = document.createElement('div');
  capa.className = 'capa-carga';
  capa.setAttribute('role', 'status');
  capa.setAttribute('aria-label', etiqueta);
  capa.innerHTML = '<ion-spinner name="crescent" aria-hidden="true"></ion-spinner>';
  document.activeElement?.blur?.();
  document.body.append(capa);
  const soltarAtras = alPresionarAtras(() => {});
  return () => {
    soltarAtras();
    capa.remove();
  };
}

// Corre una tarea asíncrona con la capa encima; la saca siempre al terminar,
// salga bien, mal o se cancele.
export async function conCapaCarga(tarea, etiqueta) {
  const cerrar = mostrarCapaCarga(etiqueta);
  try {
    return await tarea();
  } finally {
    cerrar();
  }
}
