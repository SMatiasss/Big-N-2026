import './toast-error.css';
import { vibrarError } from '../../utils/vibracion.js';

export function mostrarToastError(mensaje) {
  const toast = document.createElement('div');

  toast.className = 'toast-error';
  toast.textContent = mensaje;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');

  // Requisito excluyente: "Vibraciones al detectarse un error (TODOS LOS
  // ERRORES)". Va acá, en el control que TODAS las pantallas usan para mostrar
  // un error, en vez de repetirlo pantalla por pantalla (donde es cuestión de
  // tiempo que alguna se olvide). vibrarError() ya ignora solo los entornos
  // sin Haptics, así que en el navegador no molesta.
  void vibrarError();

  document.body.append(toast);

  requestAnimationFrame(() => {
    toast.classList.add('toast-error--visible');
    requestAnimationFrame(() => {
      toast.classList.add('toast-error--visible');
    });
  });

  setTimeout(() => {
    toast.remove();
  }, 2000);
}
