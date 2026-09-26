import './toast-normal.css';

export function mostrarToastNormal(mensaje) {
  const toast = document.createElement('div');

  toast.className = 'toast-normal';
  toast.textContent = mensaje;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  document.body.append(toast);

  requestAnimationFrame(() => {
    toast.classList.add('toast-normal--visible');
    requestAnimationFrame(() => {
      toast.classList.add('toast-normal--visible');
    });
  });

  // Pasado su tiempo en pantalla, sale por arriba con la misma transición con
  // la que entró (sacar --visible lo devuelve a translateY(-100%)), y recién
  // al terminar se borra. El segundo timeout es un respaldo por si la
  // transición no llega a correr (app en segundo plano, animaciones
  // desactivadas): el toast nunca queda colgado.
  setTimeout(() => {
    toast.classList.remove('toast-normal--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 600);
  }, 3000);
}