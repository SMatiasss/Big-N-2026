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

  setTimeout(() => {
    toast.remove();
  }, 2000);
}