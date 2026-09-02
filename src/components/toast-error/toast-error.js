import './toast-error.css';

export function mostrarToastError(mensaje) {
  const toast = document.createElement('div');

  toast.className = 'toast-error';
  toast.textContent = mensaje;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');

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
